import type {
  ApplicationFormDraft,
  PaymentProvider,
  PaymentSettings,
  PaymentTransaction,
  RefundStatus,
  SubmittedApplication,
} from '../types/recruitment';
import { formatApplicationNumber } from './recruitmentLogic';

export function formatPaiseToInr(paise: number): string {
  const safe = Number.isFinite(paise) ? Math.max(0, paise) : 0;
  return (safe / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatReceiptNumber(
  prefix: string,
  year: number,
  sequence: number
): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error('Receipt sequence must be a positive integer.');
  }
  const cleanPrefix = prefix.toUpperCase().replace(/[^A-Z0-9-]/g, '') || 'INDRA-REC';
  return `${cleanPrefix}-${year}-${String(sequence).padStart(6, '0')}`;
}

/**
 * Deterministic HMAC-style signature generator/verifier for pure-logic unit tests
 * and test-mode gateway signature verification.
 */
export function computeGatewaySignature(payload: string, secret: string): string {
  const input = `${secret}::${payload}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 16777619);
    h2 ^= c + i;
    h2 = Math.imul(h2, 2246822519);
  }
  return `sig_${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0)
    .toString(16)
    .padStart(8, '0')}`;
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function createServerPaymentOrder(
  settings: PaymentSettings,
  candidate: {
    fullName: string;
    emailAddress: string;
    mobileNumber: string;
    jobTitle: string;
  },
  existingTransactions: PaymentTransaction[],
  draftId: string,
  nowIso: string = new Date().toISOString()
): { ok: boolean; error?: string; order?: PaymentTransaction } {
  if (!settings.gatewayEnabled) {
    return {
      ok: false,
      error: 'Payment gateway is currently disabled in Admin Payment Settings.',
    };
  }
  if (settings.applicationFeePaise <= 0) {
    return {
      ok: false,
      error: 'Application fee is not configured yet. Admin must set a valid INR fee in Payment Settings.',
    };
  }
  if (settings.currency !== 'INR') {
    return { ok: false, error: 'Only INR currency is supported.' };
  }

  const alreadyPaid = existingTransactions.some(
    (t) =>
      t.paymentStatus === 'success' &&
      t.candidateEmail.toLowerCase() === candidate.emailAddress.toLowerCase() &&
      t.jobTitle === candidate.jobTitle
  );
  if (alreadyPaid) {
    return {
      ok: false,
      error: 'A verified successful payment already exists for this candidate and position.',
    };
  }

  const prefix = settings.provider === 'cashfree' ? 'cf_ord_' : 'order_';
  const orderId = `${prefix}${draftId.slice(-6)}_${Math.random().toString(36).slice(2, 8)}`;

  const order: PaymentTransaction = {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    applicationNumber: null,
    candidateName: candidate.fullName,
    candidateEmail: candidate.emailAddress,
    candidateMobile: candidate.mobileNumber,
    jobTitle: candidate.jobTitle,
    receiptNumber: null,
    gatewayProvider: settings.provider,
    gatewayMode: settings.mode,
    paymentOrderId: orderId,
    gatewayPaymentId: null,
    gatewaySignature: null,
    amount: settings.applicationFeePaise,
    currency: 'INR',
    paymentMethod: 'upi',
    transactionReference: null,
    paymentStatus: 'created',
    refundStatus: 'Not Requested',
    refundId: null,
    refundReason: null,
    confirmationEmailSent: false,
    failureReason: null,
    paidAtDate: null,
    paidAtTime: null,
    createdAt: nowIso,
  };

  return { ok: true, order };
}

export interface GatewayVerificationInput {
  orderId: string;
  paymentId: string;
  signature: string;
  gatewayStatus: 'captured' | 'pending' | 'failed' | 'cancelled';
  gatewayAmountPaise: number;
  gatewayCurrency: string;
  upiReference?: string | null;
  failureReason?: string | null;
}

export function verifyGatewayPayment(
  order: PaymentTransaction,
  payload: GatewayVerificationInput,
  serverSecret: string,
  paidAtDate: string,
  paidAtTime: string
): { ok: boolean; status: PaymentTransaction['paymentStatus']; error?: string; updated: PaymentTransaction } {
  if (order.paymentStatus === 'refunded') {
    return {
      ok: false,
      status: 'refunded',
      error: 'Transaction has already been refunded.',
      updated: order,
    };
  }

  if (order.paymentStatus === 'success') {
    // Preserve verified success even if applicationNumber is still being finalized concurrently
    return { ok: true, status: 'success', updated: order };
  }

  if (payload.orderId !== order.paymentOrderId) {
    return {
      ok: false,
      status: 'failed',
      error: 'Order ID mismatch detected during server verification.',
      updated: {
        ...order,
        paymentStatus: 'failed',
        failureReason: 'Order ID mismatch.',
      },
    };
  }

  if (payload.gatewayStatus === 'cancelled') {
    return {
      ok: false,
      status: 'cancelled',
      error: 'Payment checkout was cancelled by candidate.',
      updated: {
        ...order,
        paymentStatus: 'cancelled',
        failureReason: 'Checkout cancelled before completion.',
      },
    };
  }

  if (payload.gatewayStatus === 'failed') {
    return {
      ok: false,
      status: 'failed',
      error: payload.failureReason || 'UPI payment was declined by bank/gateway.',
      updated: {
        ...order,
        gatewayPaymentId: payload.paymentId || null,
        paymentStatus: 'failed',
        failureReason: payload.failureReason || 'Payment declined.',
      },
    };
  }

  const amountOrCurrencyMismatch =
    payload.gatewayAmountPaise !== order.amount || payload.gatewayCurrency !== order.currency;

  if (payload.gatewayStatus === 'pending') {
    if (amountOrCurrencyMismatch) {
      return {
        ok: false,
        status: 'failed',
        error: 'Payment amount or currency does not match server order.',
        updated: {
          ...order,
          paymentStatus: 'failed',
          failureReason: 'Amount or currency mismatch.',
        },
      };
    }

    const hasSignature = Boolean(payload.signature);
    if (hasSignature) {
      if (!payload.paymentId) {
        return {
          ok: false,
          status: 'failed',
          error: 'Invalid gateway payment signature.',
          updated: {
            ...order,
            paymentStatus: 'failed',
            failureReason: 'Invalid cryptographic payment signature.',
          },
        };
      }
      const expectedPendingSig = computeGatewaySignature(
        `${payload.orderId}|${payload.paymentId}`,
        serverSecret
      );
      if (!constantTimeEqual(expectedPendingSig, payload.signature)) {
        return {
          ok: false,
          status: 'failed',
          error: 'Invalid gateway payment signature.',
          updated: {
            ...order,
            paymentStatus: 'failed',
            failureReason: 'Invalid cryptographic payment signature.',
          },
        };
      }
    }

    // Even when the signature is valid, a pending gateway status must NEVER settle as success
    return {
      ok: false,
      status: 'pending',
      error: hasSignature
        ? 'Gateway signature verified, but payment is still pending final capture / webhook confirmation.'
        : 'Payment is pending confirmation from the UPI network / webhook.',
      updated: {
        ...order,
        gatewayPaymentId: payload.paymentId || order.gatewayPaymentId,
        gatewaySignature: hasSignature ? payload.signature : order.gatewaySignature,
        transactionReference: payload.upiReference ?? order.transactionReference,
        paymentStatus: 'pending',
        failureReason: hasSignature
          ? 'Signature verified; awaiting final gateway capture.'
          : 'Awaiting final gateway confirmation.',
      },
    };
  }

  // Must pass paymentId, signature, amount, and currency checks for captured status
  if (!payload.paymentId) {
    return {
      ok: false,
      status: 'failed',
      error: 'Missing gateway payment identifier.',
      updated: {
        ...order,
        paymentStatus: 'failed',
        failureReason: 'Missing gateway payment ID.',
      },
    };
  }

  const expectedSig = computeGatewaySignature(
    `${payload.orderId}|${payload.paymentId}`,
    serverSecret
  );
  if (!constantTimeEqual(expectedSig, payload.signature)) {
    return {
      ok: false,
      status: 'failed',
      error: 'Invalid gateway payment signature.',
      updated: {
        ...order,
        paymentStatus: 'failed',
        failureReason: 'Invalid cryptographic payment signature.',
      },
    };
  }

  if (amountOrCurrencyMismatch) {
    return {
      ok: false,
      status: 'failed',
      error: 'Payment amount or currency does not match server order.',
      updated: {
        ...order,
        paymentStatus: 'failed',
        failureReason: 'Amount or currency mismatch.',
      },
    };
  }

  return {
    ok: true,
    status: 'success',
    updated: {
      ...order,
      gatewayPaymentId: payload.paymentId,
      gatewaySignature: payload.signature,
      transactionReference: payload.upiReference || null,
      paymentStatus: 'success',
      failureReason: null,
      paidAtDate,
      paidAtTime,
    },
  };
}

export function processPaymentWebhook(
  eventId: string,
  provider: PaymentProvider,
  rawPayload: string,
  signature: string,
  webhookSecret: string,
  processedEventIds: Set<string>,
  order: PaymentTransaction,
  gatewayStatus: 'captured' | 'failed',
  gatewayAmountPaise: number,
  paymentId: string,
  upiRef: string | null,
  paidAtDate: string,
  paidAtTime: string
): {
  accepted: boolean;
  duplicate: boolean;
  error?: string;
  updatedOrder: PaymentTransaction;
} {
  const dedupeKey = `${provider}:${eventId}`;
  if (processedEventIds.has(dedupeKey)) {
    return { accepted: true, duplicate: true, updatedOrder: order };
  }

  const expected = computeGatewaySignature(rawPayload, webhookSecret);
  if (!constantTimeEqual(expected, signature)) {
    return {
      accepted: false,
      duplicate: false,
      error: 'Invalid webhook signature.',
      updatedOrder: order,
    };
  }

  processedEventIds.add(dedupeKey);

  if (order.paymentStatus === 'success') {
    // Idempotent: already verified & finalized, never re-send email or duplicate
    return { accepted: true, duplicate: false, updatedOrder: order };
  }

  if (gatewayStatus === 'failed') {
    return {
      accepted: true,
      duplicate: false,
      updatedOrder: {
        ...order,
        paymentStatus: 'failed',
        failureReason: 'Gateway webhook reported payment failure.',
      },
    };
  }

  if (gatewayAmountPaise !== order.amount) {
    return {
      accepted: false,
      duplicate: false,
      error: 'Webhook amount mismatch.',
      updatedOrder: order,
    };
  }

  return {
    accepted: true,
    duplicate: false,
    updatedOrder: {
      ...order,
      gatewayPaymentId: paymentId,
      transactionReference: upiRef,
      paymentStatus: 'success',
      failureReason: null,
      paidAtDate,
      paidAtTime,
    },
  };
}

export function processGatewayRefund(
  tx: PaymentTransaction,
  gatewayResult: 'processed' | 'pending' | 'failed',
  reason: string
): { ok: boolean; error?: string; updated: PaymentTransaction } {
  if (tx.paymentStatus === 'refunded' || tx.refundStatus === 'Refunded') {
    return {
      ok: false,
      error: 'This transaction has already been refunded.',
      updated: tx,
    };
  }

  if (tx.refundStatus === 'Processing') {
    return {
      ok: false,
      error: 'A refund is already in progress for this transaction.',
      updated: tx,
    };
  }

  if (tx.paymentStatus === 'pending' || tx.paymentStatus === 'processing') {
    return {
      ok: false,
      error:
        'Cannot refund a pending transaction even if its signature is valid; await final gateway capture or webhook confirmation first.',
      updated: tx,
    };
  }

  if (tx.paymentStatus !== 'success' || !tx.gatewayPaymentId) {
    return {
      ok: false,
      error: 'Only verified successful transactions with a Gateway Payment ID can be refunded.',
      updated: tx,
    };
  }

  const refundId =
    gatewayResult === 'failed'
      ? tx.refundId
      : `rfnd_${Math.random().toString(36).slice(2, 10)}`;
  const refundStatus: RefundStatus =
    gatewayResult === 'processed'
      ? 'Refunded'
      : gatewayResult === 'pending'
      ? 'Processing'
      : 'Refund Failed';

  return {
    ok: gatewayResult !== 'failed',
    error: gatewayResult === 'failed' ? 'Gateway refund API rejected the request.' : undefined,
    updated: {
      ...tx,
      refundStatus,
      refundId,
      refundReason: reason.trim() || 'Authorized admin refund',
      paymentStatus: gatewayResult === 'processed' ? 'refunded' : tx.paymentStatus,
    },
  };
}

export interface FinalizeApplicationInput {
  verifiedTx: PaymentTransaction;
  draft: ApplicationFormDraft;
  jobTitle: string;
  receiptPrefix: string;
  transactions: PaymentTransaction[];
  applications: SubmittedApplication[];
  sequenceCounter: number;
  receiptCounter: number;
  inFlightOrderIds: Set<string>;
  istDate: string;
  istTime: string;
  year?: number;
}

export interface FinalizeApplicationResult {
  ok: boolean;
  alreadyFinalized: boolean;
  error?: string;
  transaction: PaymentTransaction;
  application?: SubmittedApplication;
  transactions: PaymentTransaction[];
  applications: SubmittedApplication[];
  sequenceCounter: number;
  receiptCounter: number;
}

export function finalizePaidApplicationState(
  input: FinalizeApplicationInput
): FinalizeApplicationResult {
  const {
    verifiedTx,
    draft,
    jobTitle,
    receiptPrefix,
    transactions,
    applications,
    sequenceCounter,
    receiptCounter,
    inFlightOrderIds,
    istDate,
    istTime,
    year = 2026,
  } = input;

  // Always inspect the authoritative transaction record in case a webhook updated it concurrently
  const authoritativeTx =
    transactions.find(
      (t) =>
        t.id === verifiedTx.id ||
        t.paymentOrderId === verifiedTx.paymentOrderId
    ) ?? verifiedTx;

  // Idempotency guard: check both transaction linkage and applicationNumber
  const existingApp = applications.find(
    (a) =>
      a.paymentTransactionId === authoritativeTx.id ||
      (authoritativeTx.applicationNumber !== null &&
        a.applicationNumber === authoritativeTx.applicationNumber) ||
      (verifiedTx.applicationNumber !== null &&
        a.applicationNumber === verifiedTx.applicationNumber)
  );

  if (existingApp) {
    const syncedTx: PaymentTransaction =
      authoritativeTx.applicationNumber === existingApp.applicationNumber &&
      authoritativeTx.receiptNumber === (existingApp.receiptNumber ?? authoritativeTx.receiptNumber)
        ? authoritativeTx
        : {
            ...authoritativeTx,
            applicationNumber: existingApp.applicationNumber,
            receiptNumber: existingApp.receiptNumber ?? authoritativeTx.receiptNumber,
            confirmationEmailSent: true,
          };

    return {
      ok: true,
      alreadyFinalized: true,
      transaction: syncedTx,
      application: existingApp,
      transactions: transactions.map((t) => (t.id === syncedTx.id ? syncedTx : t)),
      applications,
      sequenceCounter,
      receiptCounter,
    };
  }

  // Prevent concurrent finalization races for the same paymentOrderId
  if (inFlightOrderIds.has(authoritativeTx.paymentOrderId)) {
    return {
      ok: false,
      alreadyFinalized: false,
      error: 'Application finalization is already in progress for this payment order.',
      transaction: authoritativeTx,
      transactions,
      applications,
      sequenceCounter,
      receiptCounter,
    };
  }

  if (authoritativeTx.paymentStatus !== 'success') {
    return {
      ok: false,
      alreadyFinalized: false,
      error: `Cannot finalize application while payment status is '${authoritativeTx.paymentStatus}'.`,
      transaction: authoritativeTx,
      transactions,
      applications,
      sequenceCounter,
      receiptCounter,
    };
  }

  inFlightOrderIds.add(authoritativeTx.paymentOrderId);
  try {
    const nextAppSeq = sequenceCounter + 1;
    const nextRecSeq = receiptCounter + 1;
    const appNumber = formatApplicationNumber(year, nextAppSeq);
    const receiptNumber =
      authoritativeTx.receiptNumber ?? formatReceiptNumber(receiptPrefix, year, nextRecSeq);

    const finalizedTx: PaymentTransaction = {
      ...authoritativeTx,
      applicationNumber: appNumber,
      receiptNumber,
      confirmationEmailSent: true,
    };

    const record: SubmittedApplication = {
      ...draft,
      id: Date.now(),
      applicationNumber: appNumber,
      jobTitle,
      status: 'Submitted',
      submittedDate: istDate,
      submittedTime: istTime,
      internalRemarks: '',
      paymentTransactionId: finalizedTx.id,
      receiptNumber,
      feeAmountPaise: finalizedTx.amount,
      statusHistory: [
        {
          id: `hist_${Date.now()}_${nextAppSeq}`,
          previousStatus: null,
          newStatus: 'Submitted',
          changedBy: 'System',
          remarks: `Application submitted after verified UPI payment (${receiptNumber}).`,
          timestamp: `${istDate} ${istTime}`,
        },
      ],
    };

    const txExists = transactions.some((t) => t.id === finalizedTx.id);
    const nextTransactions = txExists
      ? transactions.map((t) => (t.id === finalizedTx.id ? finalizedTx : t))
      : [finalizedTx, ...transactions];

    return {
      ok: true,
      alreadyFinalized: false,
      transaction: finalizedTx,
      application: record,
      transactions: nextTransactions,
      applications: [record, ...applications],
      sequenceCounter: nextAppSeq,
      receiptCounter: nextRecSeq,
    };
  } finally {
    inFlightOrderIds.delete(authoritativeTx.paymentOrderId);
  }
}

export function calculatePaymentKpis(transactions: PaymentTransaction[]) {
  const successful = transactions.filter((t) => t.paymentStatus === 'success');
  const pending = transactions.filter((t) =>
    t.paymentStatus === 'created' ||
    t.paymentStatus === 'pending' ||
    t.paymentStatus === 'processing'
  );
  const failed = transactions.filter(
    (t) => t.paymentStatus === 'failed' || t.paymentStatus === 'cancelled'
  );
  const totalCollectedPaise = successful.reduce((sum, t) => sum + t.amount, 0);

  return {
    totalSuccessful: successful.length,
    totalPending: pending.length,
    totalFailed: failed.length,
    totalCollectedPaise,
  };
}

export function exportPaymentsToCsv(transactions: PaymentTransaction[]): string {
  const headers = [
    'Receipt Number',
    'Application Number',
    'Candidate Name',
    'Gateway',
    'Order ID',
    'Payment ID',
    'UPI Reference',
    'Amount (INR)',
    'Currency',
    'Payment Status',
    'Refund Status',
    'Paid At',
  ];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = transactions.map((t) =>
    [
      t.receiptNumber ?? '',
      t.applicationNumber ?? '',
      t.candidateName,
      t.gatewayProvider,
      t.paymentOrderId,
      t.gatewayPaymentId ?? '',
      t.transactionReference ?? '',
      (t.amount / 100).toFixed(2),
      t.currency,
      t.paymentStatus,
      t.refundStatus,
      t.paidAtDate ? `${t.paidAtDate} ${t.paidAtTime ?? ''}` : '',
    ]
      .map(esc)
      .join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}
