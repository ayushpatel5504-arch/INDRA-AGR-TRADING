import React, { useEffect, useRef, useState } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import {
  AboutPage,
  ContactPage,
  DirectorsPage,
  HomePage,
  LegalPage,
  NotFoundPage,
  ServicesPage,
} from './components/PublicPages';
import { CareersPage, JobDetailsPage } from './components/CareersPages';
import {
  ApplicationWizard,
  type CheckoutOutcomeResult,
} from './components/ApplicationWizard';
import { ApplicationStatusPage } from './components/ApplicationStatusPage';
import { AdminPanel, type AdminSection } from './components/AdminPanel';
import type { CheckoutActionType } from './components/PaymentCheckoutModal';
import {
  INITIAL_APPLICATIONS,
  INITIAL_DIRECTORS,
  INITIAL_INTERVIEWS,
  INITIAL_JOBS,
  INITIAL_PAYMENT_TRANSACTIONS,
  INITIAL_SETTINGS,
} from './data/initialData';
import type {
  ApplicationFormDraft,
  ApplicationStatus,
  InterviewRecord,
  JobStatus,
  JobVacancy,
  PaymentTransaction,
  SubmittedApplication,
  WebsiteSettings,
} from './types/recruitment';
import {
  formatApplicationNumber,
  transitionApplicationStatus,
} from './utils/recruitmentLogic';
import {
  computeGatewaySignature,
  createServerPaymentOrder,
  finalizePaidApplicationState,
  processGatewayRefund,
  processPaymentWebhook,
  verifyGatewayPayment,
} from './utils/paymentLogic';

// Server-side gateway test secrets (never exposed in WebsiteSettings or Admin UI)
const SERVER_TEST_API_SECRET = 'indraagr_test_api_secret_internal';
const SERVER_TEST_WEBHOOK_SECRET = 'indraagr_test_webhook_secret_internal';

function parseHashRoute(): { path: string; query: URLSearchParams } {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [pathPart, queryPart] = raw.split('?');
  return {
    path: pathPart || '/',
    query: new URLSearchParams(queryPart || ''),
  };
}

function currentIstTimestamp(): { date: string; time: string } {
  const now = new Date();
  const date = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const time =
    now.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }) + ' IST';
  return { date, time };
}

export default function App() {
  const [route, setRoute] = useState(parseHashRoute);
  const [jobs, setJobs] = useState<JobVacancy[]>(INITIAL_JOBS);
  const [applications, setApplications] = useState<SubmittedApplication[]>(INITIAL_APPLICATIONS);
  const [interviews, setInterviews] = useState<InterviewRecord[]>(INITIAL_INTERVIEWS);
  const [paymentTransactions, setPaymentTransactions] = useState<PaymentTransaction[]>(
    INITIAL_PAYMENT_TRANSACTIONS
  );
  const [directors] = useState(INITIAL_DIRECTORS);
  const [settings, setSettings] = useState<WebsiteSettings>(INITIAL_SETTINGS);
  const [sequenceCounter, setSequenceCounter] = useState(INITIAL_APPLICATIONS.length);
  const [receiptCounter, setReceiptCounter] = useState(0);
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);

  const processedWebhookEventsRef = useRef<Set<string>>(new Set());
  const inFlightOrderIdsRef = useRef<Set<string>>(new Set());
  const transactionsRef = useRef<PaymentTransaction[]>(INITIAL_PAYMENT_TRANSACTIONS);
  const applicationsRef = useRef<SubmittedApplication[]>(INITIAL_APPLICATIONS);
  const sequenceCounterRef = useRef<number>(INITIAL_APPLICATIONS.length);
  const receiptCounterRef = useRef<number>(0);

  const syncTransactions = (next: PaymentTransaction[]) => {
    transactionsRef.current = next;
    setPaymentTransactions(next);
  };

  const syncApplications = (next: SubmittedApplication[]) => {
    applicationsRef.current = next;
    setApplications(next);
  };

  useEffect(() => {
    const onHashChange = () => {
      setRoute(parseHashRoute());
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (path: string) => {
    window.location.hash = path;
  };

  const finalizePaidApplication = (
    verifiedTx: PaymentTransaction,
    draft: ApplicationFormDraft
  ): { ok: boolean; error?: string; transaction: PaymentTransaction; application?: SubmittedApplication } => {
    const { date: istDate, time: istTime } = currentIstTimestamp();
    const job = jobs.find((j) => j.id === Number(draft.jobId));

    const result = finalizePaidApplicationState({
      verifiedTx,
      draft,
      jobTitle: job?.title ?? 'Published Position',
      receiptPrefix: settings.paymentSettings.receiptPrefix,
      transactions: transactionsRef.current,
      applications: applicationsRef.current,
      sequenceCounter: sequenceCounterRef.current,
      receiptCounter: receiptCounterRef.current,
      inFlightOrderIds: inFlightOrderIdsRef.current,
      istDate,
      istTime,
    });

    if (!result.ok || !result.application) {
      return {
        ok: false,
        error: result.error ?? 'Unable to finalize application.',
        transaction: result.transaction,
      };
    }

    sequenceCounterRef.current = result.sequenceCounter;
    receiptCounterRef.current = result.receiptCounter;
    setSequenceCounter(result.sequenceCounter);
    setReceiptCounter(result.receiptCounter);
    syncTransactions(result.transactions);
    syncApplications(result.applications);

    return {
      ok: true,
      transaction: result.transaction,
      application: result.application,
    };
  };

  const handleCreatePaymentOrder = (draft: ApplicationFormDraft) => {
    const job = jobs.find((j) => j.id === Number(draft.jobId));
    const res = createServerPaymentOrder(
      settings.paymentSettings,
      {
        fullName: draft.fullName,
        emailAddress: draft.emailAddress,
        mobileNumber: draft.mobileNumber,
        jobTitle: job?.title ?? 'Published Position',
      },
      transactionsRef.current,
      `draft_${Date.now()}`
    );
    if (res.ok && res.order) {
      syncTransactions([res.order, ...transactionsRef.current]);
    }
    return res;
  };

  const handleCompleteCheckout = (
    orderId: string,
    action: CheckoutActionType,
    upiApp: string,
    draft: ApplicationFormDraft
  ): CheckoutOutcomeResult => {
    const order = transactionsRef.current.find((t) => t.paymentOrderId === orderId);
    if (!order) {
      throw new Error('Payment order not found.');
    }

    // If a concurrent webhook already verified this order as success, finalize idempotently
    if (order.paymentStatus === 'success') {
      const finalized = finalizePaidApplication(order, draft);
      return {
        ok: finalized.ok,
        status: finalized.ok ? 'success' : finalized.transaction.paymentStatus,
        error: finalized.error,
        transaction: finalized.transaction,
        application: finalized.application,
      };
    }

    const { date: istDate, time: istTime } = currentIstTimestamp();
    const gwPayId =
      action === 'cancelled'
        ? ''
        : `pay_${order.gatewayProvider === 'cashfree' ? 'cf_' : 'rzp_'}${Math.random()
            .toString(36)
            .slice(2, 10)}`;
    const utr =
      action === 'success'
        ? `${Math.floor(400000000000 + Math.random() * 599999999999)}`
        : null;

    const validSignature = computeGatewaySignature(
      `${order.paymentOrderId}|${gwPayId}`,
      SERVER_TEST_API_SECRET
    );

    const payloadSignature =
      action === 'tampered_signature' ? 'sig_tampered_0000' : validSignature;
    const payloadAmount =
      action === 'tampered_amount' ? Math.max(0, order.amount - 100) : order.amount;
    const gatewayStatus =
      action === 'failed'
        ? 'failed'
        : action === 'cancelled'
        ? 'cancelled'
        : action === 'pending'
        ? 'pending'
        : 'captured';

    const verification = verifyGatewayPayment(
      { ...order, paymentMethod: `upi (${upiApp})` },
      {
        orderId: order.paymentOrderId,
        paymentId: gwPayId,
        signature: payloadSignature,
        gatewayStatus,
        gatewayAmountPaise: payloadAmount,
        gatewayCurrency: order.currency,
        upiReference: utr,
        failureReason:
          action === 'failed'
            ? `UPI payment declined via ${upiApp}.`
            : undefined,
      },
      SERVER_TEST_API_SECRET,
      istDate,
      istTime
    );

    // Re-check authoritative ref in case a webhook landed while verifying
    const latestOrder = transactionsRef.current.find((t) => t.id === order.id);
    if (latestOrder?.paymentStatus === 'success') {
      const finalized = finalizePaidApplication(latestOrder, draft);
      return {
        ok: finalized.ok,
        status: finalized.ok ? 'success' : finalized.transaction.paymentStatus,
        error: finalized.error,
        transaction: finalized.transaction,
        application: finalized.application,
      };
    }

    syncTransactions(
      transactionsRef.current.map((t) => (t.id === order.id ? verification.updated : t))
    );

    if (!verification.ok) {
      return {
        ok: false,
        status: verification.status,
        error: verification.error,
        transaction: verification.updated,
      };
    }

    const finalized = finalizePaidApplication(verification.updated, draft);
    return {
      ok: finalized.ok,
      status: finalized.ok ? 'success' : finalized.transaction.paymentStatus,
      error: finalized.error,
      transaction: finalized.transaction,
      application: finalized.application,
    };
  };

  const handleSimulatePendingWebhook = (
    orderId: string,
    draft: ApplicationFormDraft
  ): CheckoutOutcomeResult => {
    const order = transactionsRef.current.find((t) => t.paymentOrderId === orderId);
    if (!order) {
      throw new Error('Pending payment order not found.');
    }

    const { date: istDate, time: istTime } = currentIstTimestamp();
    const gwPayId =
      order.gatewayPaymentId || `pay_wh_${Math.random().toString(36).slice(2, 10)}`;
    const utr = `${Math.floor(400000000000 + Math.random() * 599999999999)}`;
    const eventId = `evt_${order.paymentOrderId}_captured`;
    const rawPayload = JSON.stringify({
      event: 'payment.captured',
      orderId: order.paymentOrderId,
      paymentId: gwPayId,
      amount: order.amount,
    });
    const sig = computeGatewaySignature(rawPayload, SERVER_TEST_WEBHOOK_SECRET);

    const whRes = processPaymentWebhook(
      eventId,
      order.gatewayProvider,
      rawPayload,
      sig,
      SERVER_TEST_WEBHOOK_SECRET,
      processedWebhookEventsRef.current,
      order,
      'captured',
      order.amount,
      gwPayId,
      utr,
      istDate,
      istTime
    );

    syncTransactions(
      transactionsRef.current.map((t) => (t.id === order.id ? whRes.updatedOrder : t))
    );

    if (!whRes.accepted || whRes.updatedOrder.paymentStatus !== 'success') {
      return {
        ok: false,
        status: whRes.updatedOrder.paymentStatus,
        error: whRes.error ?? 'Webhook verification failed.',
        transaction: whRes.updatedOrder,
      };
    }

    const finalized = finalizePaidApplication(whRes.updatedOrder, draft);
    return {
      ok: finalized.ok,
      status: finalized.ok ? 'success' : finalized.transaction.paymentStatus,
      error: finalized.error,
      transaction: finalized.transaction,
      application: finalized.application,
    };
  };

  const handleInitiateRefund = (txId: string, reason: string) => {
    const target = transactionsRef.current.find((t) => t.id === txId);
    if (!target) {
      return { ok: false, error: 'Payment transaction not found.' };
    }
    const res = processGatewayRefund(target, 'processed', reason);
    if (res.ok) {
      syncTransactions(
        transactionsRef.current.map((t) => (t.id === txId ? res.updated : t))
      );
    }
    return { ok: res.ok, error: res.error };
  };

  const handleAddJob = (jobData: Omit<JobVacancy, 'id' | 'createdAt'>) => {
    const newJob: JobVacancy = {
      ...jobData,
      id: Date.now(),
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setJobs((prev) => [newJob, ...prev]);
  };

  const handleUpdateJobStatus = (id: number, status: JobStatus) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status } : j)));
  };

  const handleUpdateAppStatus = (
    id: number,
    newStatus: ApplicationStatus,
    remarks: string
  ) => {
    const ts =
      new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
    syncApplications(
      applicationsRef.current.map((a) =>
        a.id === id
          ? transitionApplicationStatus(a, newStatus, 'Super Admin', remarks, ts)
          : a
      )
    );
  };

  const handleScheduleInterview = (record: Omit<InterviewRecord, 'id'>) => {
    setInterviews((prev) => [{ ...record, id: `int_${Date.now()}` }, ...prev]);
    const targetApp = applications.find(
      (a) => a.applicationNumber === record.applicationNumber
    );
    if (targetApp) {
      handleUpdateAppStatus(
        targetApp.id,
        'Interview Scheduled',
        `${record.mode} interview scheduled for ${record.interviewDate} at ${record.interviewTime} IST.`
      );
    }
  };

  const handleUpdateInterviewStatus = (
    id: string,
    status: InterviewRecord['status']
  ) => {
    setInterviews((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
  };

  const renderMain = () => {
    const { path, query } = route;

    if (path === '/') {
      return (
        <HomePage
          jobs={jobs}
          directors={directors}
          paymentSettings={settings.paymentSettings}
          onNavigate={navigate}
        />
      );
    }
    if (path === '/about') {
      return <AboutPage onNavigate={navigate} />;
    }
    if (path === '/directors') {
      return <DirectorsPage directors={directors} />;
    }
    if (path === '/services') {
      return <ServicesPage onNavigate={navigate} />;
    }
    if (path === '/careers') {
      return (
        <CareersPage
          jobs={jobs}
          paymentSettings={settings.paymentSettings}
          onNavigate={navigate}
        />
      );
    }
    if (path.startsWith('/jobs/')) {
      const slug = path.replace('/jobs/', '');
      const job = jobs.find((j) => j.slug === slug);
      return (
        <JobDetailsPage
          job={job}
          paymentSettings={settings.paymentSettings}
          onNavigate={navigate}
        />
      );
    }
    if (path === '/apply') {
      const preJob = query.get('job') ? Number(query.get('job')) : undefined;
      return (
        <ApplicationWizard
          jobs={jobs}
          preselectedJobId={preJob}
          smsConfigured={settings.smsConfigured}
          smtpConfigured={settings.smtpConfigured}
          paymentSettings={settings.paymentSettings}
          companyName={settings.companyName}
          onCreatePaymentOrder={handleCreatePaymentOrder}
          onCompleteCheckout={handleCompleteCheckout}
          onSimulatePendingWebhook={handleSimulatePendingWebhook}
          onNavigate={navigate}
        />
      );
    }
    if (path === '/application-status') {
      return (
        <ApplicationStatusPage
          applications={applications}
          interviews={interviews}
          paymentTransactions={paymentTransactions}
          companyName={settings.companyName}
        />
      );
    }
    if (path === '/contact') {
      return <ContactPage settings={settings} />;
    }
    if (path === '/privacy-policy') {
      return <LegalPage type="privacy" paymentSettings={settings.paymentSettings} />;
    }
    if (path === '/terms') {
      return <LegalPage type="terms" paymentSettings={settings.paymentSettings} />;
    }
    if (path === '/recruitment-disclaimer') {
      return <LegalPage type="disclaimer" paymentSettings={settings.paymentSettings} />;
    }
    if (path.startsWith('/admin')) {
      const initialSection: AdminSection =
        path === '/admin/payments'
          ? 'payments'
          : path === '/admin/payment-settings'
          ? 'payment-settings'
          : 'dashboard';
      return (
        <AdminPanel
          isAuthenticated={adminAuthenticated}
          initialSection={initialSection}
          onLogin={() => setAdminAuthenticated(true)}
          onLogout={() => {
            setAdminAuthenticated(false);
            navigate('/admin/login');
          }}
          jobs={jobs}
          onAddJob={handleAddJob}
          onUpdateJobStatus={handleUpdateJobStatus}
          applications={applications}
          onUpdateAppStatus={handleUpdateAppStatus}
          interviews={interviews}
          onScheduleInterview={handleScheduleInterview}
          onUpdateInterviewStatus={handleUpdateInterviewStatus}
          paymentTransactions={paymentTransactions}
          onInitiateRefund={handleInitiateRefund}
          directors={directors}
          settings={settings}
          onUpdateSettings={setSettings}
        />
      );
    }

    return <NotFoundPage onNavigate={navigate} />;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F4EC] text-[#1B2B22]">
      <Header currentPath={route.path} onNavigate={navigate} />
      <main className="flex-1">{renderMain()}</main>
      <Footer settings={settings} onNavigate={navigate} />
    </div>
  );
}
