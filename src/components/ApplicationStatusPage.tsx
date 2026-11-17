import React, { useState } from 'react';
import { Calendar, Printer, Receipt, ShieldCheck } from 'lucide-react';
import type {
  InterviewRecord,
  OtpChallenge,
  PaymentTransaction,
  SubmittedApplication,
} from '../types/recruitment';
import { createOtpChallenge, verifyOtpChallenge } from '../utils/recruitmentLogic';
import { formatPaiseToInr } from '../utils/paymentLogic';
import { PaymentReceiptView } from './PaymentReceiptView';

interface ApplicationStatusPageProps {
  applications: SubmittedApplication[];
  interviews: InterviewRecord[];
  paymentTransactions: PaymentTransaction[];
  companyName: string;
}

export const ApplicationStatusPage: React.FC<ApplicationStatusPageProps> = ({
  applications,
  interviews,
  paymentTransactions,
  companyName,
}) => {
  const [appNumber, setAppNumber] = useState('');
  const [contact, setContact] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [previewOtp, setPreviewOtp] = useState('');
  const [error, setError] = useState('');
  const [verifiedApp, setVerifiedApp] = useState<SubmittedApplication | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const handleRequestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const matched = applications.find(
      (a) =>
        a.applicationNumber.toLowerCase() === appNumber.trim().toLowerCase() &&
        (a.mobileNumber === contact.trim() ||
          a.emailAddress.toLowerCase() === contact.trim().toLowerCase())
    );
    if (!matched) {
      setError('No matching application found for this Application Number and registered contact.');
      return;
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    setChallenge(createOtpChallenge('mobile', matched.mobileNumber, code, Date.now()));
    setPreviewOtp(code);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!challenge) return;
    const res = verifyOtpChallenge(challenge, otpInput, Date.now());
    setChallenge(res.updated);
    if (!res.ok) {
      setError(res.error ?? 'Invalid OTP.');
      return;
    }
    const matched = applications.find(
      (a) => a.applicationNumber.toLowerCase() === appNumber.trim().toLowerCase()
    );
    if (matched) setVerifiedApp(matched);
  };

  const interview = verifiedApp
    ? interviews.find((i) => i.applicationNumber === verifiedApp.applicationNumber)
    : undefined;
  const verifiedTx = verifiedApp?.paymentTransactionId
    ? paymentTransactions.find((t) => t.id === verifiedApp.paymentTransactionId)
    : verifiedApp
    ? paymentTransactions.find(
        (t) =>
          t.applicationNumber === verifiedApp.applicationNumber &&
          t.paymentStatus === 'success'
      )
    : undefined;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-8">
      <div className="no-print space-y-2 border-b border-[#174D32]/15 pb-6">
        <p className="text-xs font-semibold tracking-wider text-[#174D32]">
          Candidate Self-Service
        </p>
        <h1 className="font-serif-display text-4xl font-bold text-[#1B2B22]">
          Application Status Tracking
        </h1>
        <p className="text-sm text-[#1B2B22]/75">
          Verify your identity with your Application Number and registered Mobile/Email OTP to view
          your private recruitment timeline.
        </p>
      </div>

      {!verifiedApp ? (
        <div className="p-6 sm:p-8 bg-white rounded-lg border border-[#174D32]/15 space-y-6">
          {error && (
            <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 p-3 rounded-md">
              {error}
            </p>
          )}

          {!challenge ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label htmlFor="status-app-no" className="block text-sm font-medium mb-1">
                  Application Number *
                </label>
                <input
                  id="status-app-no"
                  required
                  placeholder="e.g., INDRA-AGR-2026-000001"
                  value={appNumber}
                  onChange={(e) => setAppNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono-data border border-[#174D32]/25 rounded-md"
                />
              </div>
              <div>
                <label htmlFor="status-contact" className="block text-sm font-medium mb-1">
                  Registered Mobile Number or Email *
                </label>
                <input
                  id="status-contact"
                  required
                  placeholder="e.g., 9876543210 or rohan.sharma@example.com"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#174D32]/25 rounded-md"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-2.5 text-sm font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md"
              >
                Send Verification OTP
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <p className="text-sm text-[#1B2B22]/80">
                Enter the 6-digit OTP sent to your registered contact for{' '}
                <span className="font-mono-data font-semibold">{appNumber}</span>.
              </p>
              {previewOtp && (
                <p className="text-xs font-mono-data text-[#103B27] bg-[#F6F4EC] px-3 py-2 rounded border border-[#C7A65A]/50">
                  Preview OTP Dispatch: {previewOtp}
                </p>
              )}
              <input
                aria-label="Enter 6-digit Status OTP"
                maxLength={6}
                required
                placeholder="6-digit OTP"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                className="w-full max-w-xs px-3.5 py-2.5 text-sm font-mono-data border border-[#174D32]/25 rounded-md"
              />
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-6 py-2.5 text-sm font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md"
                >
                  Verify &amp; View Status
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChallenge(null);
                    setOtpInput('');
                    setPreviewOtp('');
                  }}
                  className="px-4 py-2.5 text-sm font-medium text-[#174D32] border border-[#174D32]/25 rounded-md"
                >
                  Reset
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <div className="p-6 sm:p-8 bg-white rounded-lg border border-[#174D32]/15 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#174D32]/12 pb-5">
            <div>
              <p className="text-xs font-semibold text-[#174D32] inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Identity Verified
              </p>
              <h2 className="font-serif-display text-3xl font-bold text-[#1B2B22] mt-1">
                {verifiedApp.fullName}
              </h2>
              <p className="text-xs font-mono-data text-[#1B2B22]/70 mt-0.5">
                {verifiedApp.applicationNumber} · {verifiedApp.jobTitle}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#1B2B22]/60">Current Status</p>
              <p className="text-base font-bold text-[#174D32]">{verifiedApp.status}</p>
            </div>
          </div>

          {interview && (
            <div className="p-5 rounded-lg bg-[#F6F4EC] border border-[#C7A65A]/60 space-y-2">
              <h3 className="text-sm font-semibold text-[#174D32] flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Scheduled Interview ({interview.status})
              </h3>
              <p className="text-sm font-mono-data">
                Date: {interview.interviewDate} · Time: {interview.interviewTime} IST · Mode:{' '}
                {interview.mode}
              </p>
              <p className="text-xs text-[#1B2B22]/85">
                Location / Link: {interview.locationOrLink}
              </p>
              {interview.instructions && (
                <p className="text-xs text-[#1B2B22]/75">Instructions: {interview.instructions}</p>
              )}
            </div>
          )}

          <div className="space-y-3">
            <h3 className="font-serif-display text-2xl font-bold text-[#1B2B22]">
              Status Timeline
            </h3>
            <ol className="space-y-3">
              {verifiedApp.statusHistory.map((h) => (
                <li
                  key={h.id}
                  className="p-4 rounded-md bg-[#F6F4EC] border border-[#174D32]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#174D32]">{h.newStatus}</p>
                    <p className="text-xs text-[#1B2B22]/75">{h.remarks}</p>
                  </div>
                  <span className="text-xs font-mono-data text-[#1B2B22]/60 shrink-0">
                    {h.timestamp}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {verifiedTx && (
            <div className="p-4 rounded-md bg-[#F6F4EC] border border-[#174D32]/15 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-semibold text-[#174D32]">
                  Verified Fee Payment — Receipt {verifiedTx.receiptNumber}
                </p>
                <p className="font-mono-data text-[#1B2B22]/75">
                  Payment ID: {verifiedTx.gatewayPaymentId} · Amount: {verifiedTx.currency}{' '}
                  {formatPaiseToInr(verifiedTx.amount)} · Status: {verifiedTx.paymentStatus.toUpperCase()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReceipt((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#174D32] bg-white border border-[#174D32]/30 rounded-md hover:bg-[#174D32]/5"
              >
                <Receipt className="w-3.5 h-3.5" />
                {showReceipt ? 'Hide Payment Receipt' : 'View / Print Payment Receipt'}
              </button>
            </div>
          )}

          {showReceipt && verifiedTx && (
            <PaymentReceiptView
              transaction={verifiedTx}
              companyName={companyName}
              onClose={() => setShowReceipt(false)}
            />
          )}

          <div className="no-print flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md"
            >
              <Printer className="w-4 h-4" />
              Print / Download Application PDF
            </button>
            <button
              type="button"
              onClick={() => {
                setVerifiedApp(null);
                setChallenge(null);
                setOtpInput('');
                setShowReceipt(false);
              }}
              className="px-4 py-2.5 text-sm font-medium text-[#174D32] border border-[#174D32]/25 rounded-md"
            >
              Check Another Application
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
