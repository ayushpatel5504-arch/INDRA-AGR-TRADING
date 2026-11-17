import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  ApplicationFormDraft,
  PaymentSettings,
  PaymentTransaction,
  SubmittedApplication,
} from '../types/recruitment';
import {
  calculatePaymentKpis,
  computeGatewaySignature,
  createServerPaymentOrder,
  exportPaymentsToCsv,
  finalizePaidApplicationState,
  formatPaiseToInr,
  formatReceiptNumber,
  processGatewayRefund,
  processPaymentWebhook,
  verifyGatewayPayment,
} from './paymentLogic';

const TEST_SETTINGS: PaymentSettings = {
  gatewayEnabled: true,
  provider: 'razorpay',
  mode: 'test',
  applicationFeePaise: 25000, // ₹250.00
  currency: 'INR',
  paymentDescription: 'Application Fee',
  paymentInstructions: 'Pay via UPI',
  refundPolicy: 'Official refund policy',
  receiptPrefix: 'INDRA-REC',
  testKeyId: 'rzp_test_demo1234',
  hasTestSecretConfigured: true,
  hasTestWebhookSecretConfigured: true,
  liveKeyId: '',
  hasLiveSecretConfigured: false,
  hasLiveWebhookSecretConfigured: false,
};

const CANDIDATE = {
  fullName: 'Aarav Verma',
  emailAddress: 'aarav@example.com',
  mobileNumber: '9876543210',
  jobTitle: 'Agricultural Procurement Executive',
};

const SECRET = 'test_secret_key_xyz';
const WEBHOOK_SECRET = 'test_webhook_secret_abc';

test('1 & 12: Successful UPI payment verification and unique receipt number formatting', () => {
  const orderRes = createServerPaymentOrder(TEST_SETTINGS, CANDIDATE, [], 'draft_1');
  assert.equal(orderRes.ok, true);
  const order = orderRes.order!;
  assert.equal(order.amount, 25000);

  const paymentId = 'pay_upi_001';
  const sig = computeGatewaySignature(`${order.paymentOrderId}|${paymentId}`, SECRET);

  const verified = verifyGatewayPayment(
    order,
    {
      orderId: order.paymentOrderId,
      paymentId,
      signature: sig,
      gatewayStatus: 'captured',
      gatewayAmountPaise: 25000,
      gatewayCurrency: 'INR',
      upiReference: '432219881002',
    },
    SECRET,
    '2026-11-17',
    '10:00 IST'
  );

  assert.equal(verified.ok, true);
  assert.equal(verified.status, 'success');
  assert.equal(verified.updated.transactionReference, '432219881002');
  assert.equal(formatReceiptNumber('INDRA-REC', 2026, 1), 'INDRA-REC-2026-000001');
  assert.equal(formatPaiseToInr(25000), '250.00');
});

test('2, 3, 4 & 11: Failed, cancelled, pending payments and retry flow', () => {
  const order = createServerPaymentOrder(TEST_SETTINGS, CANDIDATE, [], 'draft_2').order!;

  const cancelled = verifyGatewayPayment(
    order,
    {
      orderId: order.paymentOrderId,
      paymentId: '',
      signature: '',
      gatewayStatus: 'cancelled',
      gatewayAmountPaise: 25000,
      gatewayCurrency: 'INR',
    },
    SECRET,
    '2026-11-17',
    '10:05 IST'
  );
  assert.equal(cancelled.ok, false);
  assert.equal(cancelled.status, 'cancelled');

  const pending = verifyGatewayPayment(
    order,
    {
      orderId: order.paymentOrderId,
      paymentId: 'pay_pend_1',
      signature: '',
      gatewayStatus: 'pending',
      gatewayAmountPaise: 25000,
      gatewayCurrency: 'INR',
    },
    SECRET,
    '2026-11-17',
    '10:06 IST'
  );
  assert.equal(pending.ok, false);
  assert.equal(pending.status, 'pending');

  const failed = verifyGatewayPayment(
    order,
    {
      orderId: order.paymentOrderId,
      paymentId: 'pay_fail_1',
      signature: '',
      gatewayStatus: 'failed',
      gatewayAmountPaise: 25000,
      gatewayCurrency: 'INR',
      failureReason: 'UPI bank server timeout',
    },
    SECRET,
    '2026-11-17',
    '10:07 IST'
  );
  assert.equal(failed.ok, false);
  assert.equal(failed.status, 'failed');

  // Retry succeeds with new order
  const retryOrder = createServerPaymentOrder(TEST_SETTINGS, CANDIDATE, [failed.updated], 'draft_2_retry').order!;
  const sig = computeGatewaySignature(`${retryOrder.paymentOrderId}|pay_retry_ok`, SECRET);
  const retryVerified = verifyGatewayPayment(
    retryOrder,
    {
      orderId: retryOrder.paymentOrderId,
      paymentId: 'pay_retry_ok',
      signature: sig,
      gatewayStatus: 'captured',
      gatewayAmountPaise: 25000,
      gatewayCurrency: 'INR',
    },
    SECRET,
    '2026-11-17',
    '10:09 IST'
  );
  assert.equal(retryVerified.ok, true);
});

test('5 & 6: Delayed webhook succeeds and duplicate webhook is idempotent', () => {
  const order = createServerPaymentOrder(TEST_SETTINGS, CANDIDATE, [], 'draft_3').order!;
  const processedEvents = new Set<string>();
  const raw = JSON.stringify({ event: 'payment.captured', order_id: order.paymentOrderId });
  const whSig = computeGatewaySignature(raw, WEBHOOK_SECRET);

  const first = processPaymentWebhook(
    'evt_001',
    'razorpay',
    raw,
    whSig,
    WEBHOOK_SECRET,
    processedEvents,
    order,
    'captured',
    25000,
    'pay_wh_1',
    'UTR999888',
    '2026-11-17',
    '10:15 IST'
  );
  assert.equal(first.accepted, true);
  assert.equal(first.duplicate, false);
  assert.equal(first.updatedOrder.paymentStatus, 'success');

  const dup = processPaymentWebhook(
    'evt_001',
    'razorpay',
    raw,
    whSig,
    WEBHOOK_SECRET,
    processedEvents,
    first.updatedOrder,
    'captured',
    25000,
    'pay_wh_1',
    'UTR999888',
    '2026-11-17',
    '10:15 IST'
  );
  assert.equal(dup.accepted, true);
  assert.equal(dup.duplicate, true);
});

test('7, 8, 9 & 10: Invalid signature, wrong amount, wrong order ID, and duplicate payment attempt rejected', () => {
  const order = createServerPaymentOrder(TEST_SETTINGS, CANDIDATE, [], 'draft_4').order!;

  const badSig = verifyGatewayPayment(
    order,
    {
      orderId: order.paymentOrderId,
      paymentId: 'pay_x',
      signature: 'sig_tampered_0000',
      gatewayStatus: 'captured',
      gatewayAmountPaise: 25000,
      gatewayCurrency: 'INR',
    },
    SECRET,
    '2026-11-17',
    '10:20 IST'
  );
  assert.equal(badSig.ok, false);
  assert.match(badSig.error ?? '', /signature/i);

  const validSig = computeGatewaySignature(`${order.paymentOrderId}|pay_x`, SECRET);
  const badAmt = verifyGatewayPayment(
    order,
    {
      orderId: order.paymentOrderId,
      paymentId: 'pay_x',
      signature: validSig,
      gatewayStatus: 'captured',
      gatewayAmountPaise: 100, // ₹1 instead of ₹250
      gatewayCurrency: 'INR',
    },
    SECRET,
    '2026-11-17',
    '10:20 IST'
  );
  assert.equal(badAmt.ok, false);
  assert.match(badAmt.error ?? '', /amount/i);

  const wrongOrder = verifyGatewayPayment(
    order,
    {
      orderId: 'order_different',
      paymentId: 'pay_x',
      signature: validSig,
      gatewayStatus: 'captured',
      gatewayAmountPaise: 25000,
      gatewayCurrency: 'INR',
    },
    SECRET,
    '2026-11-17',
    '10:20 IST'
  );
  assert.equal(wrongOrder.ok, false);

  // Duplicate paid order blocked
  const paidOrder: PaymentTransaction = { ...order, paymentStatus: 'success', gatewayPaymentId: 'pay_done' };
  const dupOrder = createServerPaymentOrder(TEST_SETTINGS, CANDIDATE, [paidOrder], 'draft_4_dup');
  assert.equal(dupOrder.ok, false);
});

test('15: Refund processing and KPI calculation only from verified success transactions', () => {
  const order = createServerPaymentOrder(TEST_SETTINGS, CANDIDATE, [], 'draft_5').order!;
  const paid: PaymentTransaction = {
    ...order,
    paymentStatus: 'success',
    gatewayPaymentId: 'pay_ref_test',
    receiptNumber: 'INDRA-REC-2026-000005',
  };
  const failed: PaymentTransaction = {
    ...order,
    id: 'tx_fail',
    paymentOrderId: 'order_fail',
    paymentStatus: 'failed',
  };

  const kpisBefore = calculatePaymentKpis([paid, failed]);
  assert.equal(kpisBefore.totalSuccessful, 1);
  assert.equal(kpisBefore.totalFailed, 1);
  assert.equal(kpisBefore.totalCollectedPaise, 25000);

  const refunded = processGatewayRefund(paid, 'processed', 'Duplicate debit');
  assert.equal(refunded.ok, true);
  assert.equal(refunded.updated.refundStatus, 'Refunded');
  assert.equal(refunded.updated.paymentStatus, 'refunded');

  const csv = exportPaymentsToCsv([refunded.updated]);
  assert.match(csv, /INDRA-REC-2026-000005/);
});

test('16: verifyGatewayPayment & processGatewayRefund handle pending status with valid signature safely', () => {
  const order = createServerPaymentOrder(TEST_SETTINGS, CANDIDATE, [], 'draft_pending_sig').order!;
  const pendingPayId = 'pay_pend_signed_001';
  const validSig = computeGatewaySignature(`${order.paymentOrderId}|${pendingPayId}`, SECRET);

  // Pending with valid signature MUST remain pending (never auto-success) and store signature
  const pendingValidSig = verifyGatewayPayment(
    order,
    {
      orderId: order.paymentOrderId,
      paymentId: pendingPayId,
      signature: validSig,
      gatewayStatus: 'pending',
      gatewayAmountPaise: 25000,
      gatewayCurrency: 'INR',
      upiReference: 'UTR_PEND_01',
    },
    SECRET,
    '2026-11-17',
    '10:30 IST'
  );
  assert.equal(pendingValidSig.ok, false);
  assert.equal(pendingValidSig.status, 'pending');
  assert.equal(pendingValidSig.updated.paymentStatus, 'pending');
  assert.equal(pendingValidSig.updated.gatewaySignature, validSig);
  assert.equal(pendingValidSig.updated.gatewayPaymentId, pendingPayId);

  // Pending with tampered signature MUST fail rather than stay pending
  const pendingBadSig = verifyGatewayPayment(
    order,
    {
      orderId: order.paymentOrderId,
      paymentId: pendingPayId,
      signature: 'sig_tampered_pending',
      gatewayStatus: 'pending',
      gatewayAmountPaise: 25000,
      gatewayCurrency: 'INR',
    },
    SECRET,
    '2026-11-17',
    '10:30 IST'
  );
  assert.equal(pendingBadSig.ok, false);
  assert.equal(pendingBadSig.status, 'failed');

  // Refund MUST be blocked for pending transactions even when gatewaySignature and paymentId exist
  const refundPending = processGatewayRefund(pendingValidSig.updated, 'processed', 'Candidate requested');
  assert.equal(refundPending.ok, false);
  assert.match(refundPending.error ?? '', /pending/i);
  assert.equal(refundPending.updated.paymentStatus, 'pending');

  // Late pending callback cannot overwrite an already-verified success (even before applicationNumber is assigned)
  const webhookSuccessOrder: PaymentTransaction = {
    ...order,
    paymentStatus: 'success',
    gatewayPaymentId: pendingPayId,
    applicationNumber: null,
  };
  const latePendingCheck = verifyGatewayPayment(
    webhookSuccessOrder,
    {
      orderId: order.paymentOrderId,
      paymentId: pendingPayId,
      signature: validSig,
      gatewayStatus: 'pending',
      gatewayAmountPaise: 25000,
      gatewayCurrency: 'INR',
    },
    SECRET,
    '2026-11-17',
    '10:31 IST'
  );
  assert.equal(latePendingCheck.ok, true);
  assert.equal(latePendingCheck.status, 'success');

  // Duplicate refund blocked & failed refund does not assign refundId
  const settled: PaymentTransaction = { ...webhookSuccessOrder, receiptNumber: 'INDRA-REC-2026-000010' };
  const failedRefund = processGatewayRefund(settled, 'failed', 'Gateway down');
  assert.equal(failedRefund.ok, false);
  assert.equal(failedRefund.updated.refundId, null);

  const okRefund = processGatewayRefund(settled, 'processed', 'Valid refund');
  assert.equal(okRefund.ok, true);
  const dupRefund = processGatewayRefund(okRefund.updated, 'processed', 'Duplicate click');
  assert.equal(dupRefund.ok, false);
  assert.match(dupRefund.error ?? '', /already been refunded/i);
});

test('17: finalizePaidApplicationState prevents duplicate submission during concurrent webhook/checkout race', () => {
  const order = createServerPaymentOrder(TEST_SETTINGS, CANDIDATE, [], 'draft_race').order!;
  const paidTx: PaymentTransaction = {
    ...order,
    paymentStatus: 'success',
    gatewayPaymentId: 'pay_race_01',
    transactionReference: '445566778899',
  };
  const draft: ApplicationFormDraft = {
    fullName: CANDIDATE.fullName,
    fatherName: '',
    dateOfBirth: '1998-05-10',
    gender: 'Male',
    nationality: 'Indian',
    mobileNumber: CANDIDATE.mobileNumber,
    emailAddress: CANDIDATE.emailAddress,
    permanentAddress: '12 Agri Road',
    district: 'Indore',
    state: 'Madhya Pradesh',
    pinCode: '452001',
    tenthBoard: 'CBSE',
    tenthPassingYear: '2014',
    tenthRollNumber: '101',
    tenthMarksObtained: '420',
    tenthTotalMarks: '500',
    twelfthBoard: 'CBSE',
    twelfthPassingYear: '2016',
    twelfthRollNumber: '202',
    twelfthMarksObtained: '430',
    twelfthTotalMarks: '500',
    highestQualification: 'B.Sc Agriculture',
    additionalQualifications: [],
    computerSkills: 'MS Excel',
    jobId: 1,
    preferredLocation: 'Indore',
    experienceLevel: 'Fresher',
    previousEmployer: '',
    previousDesignation: '',
    expectedSalary: '',
    documents: [],
    mobileVerified: true,
    emailVerified: true,
    declarationAccepted: true,
    privacyConsentAccepted: true,
  };

  const inFlight = new Set<string>();
  const apps: SubmittedApplication[] = [];

  // Pending transaction cannot finalize
  const pendingAttempt = finalizePaidApplicationState({
    verifiedTx: { ...paidTx, paymentStatus: 'pending' },
    draft,
    jobTitle: CANDIDATE.jobTitle,
    receiptPrefix: 'INDRA-REC',
    transactions: [order],
    applications: apps,
    sequenceCounter: 2,
    receiptCounter: 0,
    inFlightOrderIds: inFlight,
    istDate: '2026-11-17',
    istTime: '11:00 IST',
  });
  assert.equal(pendingAttempt.ok, false);
  assert.equal(pendingAttempt.applications.length, 0);

  // In-flight lock blocks concurrent re-entry for the same order
  inFlight.add(paidTx.paymentOrderId);
  const lockedAttempt = finalizePaidApplicationState({
    verifiedTx: paidTx,
    draft,
    jobTitle: CANDIDATE.jobTitle,
    receiptPrefix: 'INDRA-REC',
    transactions: [paidTx],
    applications: apps,
    sequenceCounter: 2,
    receiptCounter: 0,
    inFlightOrderIds: inFlight,
    istDate: '2026-11-17',
    istTime: '11:00 IST',
  });
  assert.equal(lockedAttempt.ok, false);
  assert.match(lockedAttempt.error ?? '', /already in progress/i);
  inFlight.delete(paidTx.paymentOrderId);

  // First caller (e.g. webhook) finalizes
  const first = finalizePaidApplicationState({
    verifiedTx: paidTx,
    draft,
    jobTitle: CANDIDATE.jobTitle,
    receiptPrefix: 'INDRA-REC',
    transactions: [paidTx],
    applications: apps,
    sequenceCounter: 2,
    receiptCounter: 0,
    inFlightOrderIds: inFlight,
    istDate: '2026-11-17',
    istTime: '11:00 IST',
  });
  assert.equal(first.ok, true);
  assert.equal(first.alreadyFinalized, false);
  assert.equal(first.applications.length, 1);
  assert.equal(first.sequenceCounter, 3);
  assert.equal(first.receiptCounter, 1);

  // Second caller (e.g. checkout callback with stale verifiedTx where applicationNumber was still null)
  const second = finalizePaidApplicationState({
    verifiedTx: paidTx, // stale copy without applicationNumber
    draft,
    jobTitle: CANDIDATE.jobTitle,
    receiptPrefix: 'INDRA-REC',
    transactions: first.transactions,
    applications: first.applications,
    sequenceCounter: first.sequenceCounter,
    receiptCounter: first.receiptCounter,
    inFlightOrderIds: inFlight,
    istDate: '2026-11-17',
    istTime: '11:00 IST',
  });
  assert.equal(second.ok, true);
  assert.equal(second.alreadyFinalized, true);
  assert.equal(second.applications.length, 1);
  assert.equal(second.sequenceCounter, 3);
  assert.equal(second.receiptCounter, 1);
  assert.equal(second.application?.applicationNumber, first.application?.applicationNumber);
  assert.equal(second.transaction.receiptNumber, first.transaction.receiptNumber);
});
