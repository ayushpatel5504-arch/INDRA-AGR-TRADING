import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  QrCode,
  ShieldAlert,
  Smartphone,
  X,
} from 'lucide-react';
import type { PaymentSettings, PaymentTransaction } from '../types/recruitment';
import { formatPaiseToInr } from '../utils/paymentLogic';

export type CheckoutActionType =
  | 'success'
  | 'failed'
  | 'pending'
  | 'cancelled'
  | 'tampered_signature'
  | 'tampered_amount';

interface PaymentCheckoutModalProps {
  order: PaymentTransaction;
  settings: PaymentSettings;
  onOutcome: (action: CheckoutActionType, selectedUpiApp: string) => void;
}

const UPI_APPS = [
  { id: 'Google Pay', label: 'Google Pay (GPay)' },
  { id: 'PhonePe', label: 'PhonePe' },
  { id: 'BHIM UPI', label: 'BHIM / Bank UPI' },
  { id: 'Paytm UPI', label: 'Paytm UPI' },
];

export const PaymentCheckoutModal: React.FC<PaymentCheckoutModalProps> = ({
  order,
  settings,
  onOutcome,
}) => {
  const [selectedApp, setSelectedApp] = useState(UPI_APPS[0].id);
  const [showSecurityChecks, setShowSecurityChecks] = useState(false);

  const providerName =
    settings.provider === 'cashfree' ? 'Cashfree Payments' : 'Razorpay';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gateway-checkout-title"
      className="fixed inset-0 z-50 bg-[#103B27]/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="w-full max-w-lg bg-white rounded-lg border border-[#174D32]/25 shadow-2xl overflow-hidden my-4">
        {/* Official Gateway Top Header */}
        <div className="bg-[#103B27] text-white px-6 py-4 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-[11px] font-mono-data text-[#C7A65A] uppercase tracking-wider">
              {providerName} · {settings.mode === 'live' ? 'LIVE' : 'TEST MODE'} UPI CHECKOUT
            </p>
            <h2 id="gateway-checkout-title" className="font-serif-display text-xl font-bold">
              INDRA AGR TRADING PVT. LTD.
            </h2>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-white/75">Payable Amount</p>
            <p className="font-mono-data text-lg font-bold text-[#C7A65A]">
              INR {formatPaiseToInr(order.amount)}
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Order Binding Metadata */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-[#F6F4EC] px-3.5 py-2.5 rounded border border-[#174D32]/15">
            <span className="font-mono-data text-[#1B2B22]">
              Order ID: <strong>{order.paymentOrderId}</strong>
            </span>
            <span className="inline-flex items-center gap-1 text-[#174D32] font-semibold">
              <Lock className="w-3.5 h-3.5" /> Server-Verified Amount
            </span>
          </div>

          {/* Dynamic Gateway UPI QR + Apps */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
            <div className="sm:col-span-5 p-4 rounded-md bg-[#F6F4EC] border border-[#174D32]/15 flex flex-col items-center text-center space-y-2">
              <div className="w-28 h-28 bg-white border border-[#174D32]/25 rounded flex flex-col items-center justify-center p-2">
                <QrCode className="w-20 h-20 text-[#174D32]" />
              </div>
              <p className="text-[11px] font-medium text-[#1B2B22]/80">
                Dynamic Gateway UPI QR
              </p>
              <p className="text-[10px] font-mono-data text-[#1B2B22]/60 break-all">
                {order.paymentOrderId}
              </p>
            </div>

            <div className="sm:col-span-7 space-y-2.5">
              <p className="text-xs font-semibold text-[#1B2B22] flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-[#174D32]" />
                Select UPI App ({settings.mode === 'live' ? 'Gateway' : 'Test Mode'})
              </p>
              <div className="grid grid-cols-1 gap-2">
                {UPI_APPS.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => setSelectedApp(app.id)}
                    className={`px-3 py-2 text-xs text-left rounded border transition-colors ${
                      selectedApp === app.id
                        ? 'border-[#174D32] bg-[#174D32]/8 font-semibold text-[#174D32]'
                        : 'border-[#174D32]/15 hover:bg-[#F6F4EC]'
                    }`}
                  >
                    {app.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-[#1B2B22]/75 leading-relaxed">
            {providerName} hosted UPI checkout handles authentication directly within your selected
            UPI app. This portal never collects your UPI PIN, bank password, or OTP.
          </p>

          {/* Gateway Checkout Actions */}
          <div className="space-y-2.5 pt-2 border-t border-[#174D32]/12">
            <button
              type="button"
              onClick={() => onOutcome('success', selectedApp)}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md inline-flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Complete UPI Payment via {selectedApp} (INR {formatPaiseToInr(order.amount)})
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onOutcome('failed', selectedApp)}
                className="py-2 px-3 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-md"
              >
                Simulate Failure
              </button>
              <button
                type="button"
                onClick={() => onOutcome('pending', selectedApp)}
                className="py-2 px-3 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-md"
              >
                Simulate Pending
              </button>
              <button
                type="button"
                onClick={() => onOutcome('cancelled', selectedApp)}
                className="py-2 px-3 text-xs font-semibold text-[#1B2B22] border border-[#174D32]/25 hover:bg-[#F6F4EC] rounded-md inline-flex items-center justify-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            </div>
          </div>

          {/* Optional Security Verification Tests for Sandbox QA */}
          {settings.mode === 'test' && (
            <div className="pt-2 border-t border-[#174D32]/10">
              <button
                type="button"
                onClick={() => setShowSecurityChecks((v) => !v)}
                className="text-[11px] font-semibold text-[#174D32] hover:underline inline-flex items-center gap-1"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                {showSecurityChecks
                  ? 'Hide Gateway Security Tamper Tests'
                  : 'Verify Tamper Protection (Test Mode QA)'}
              </button>

              {showSecurityChecks && (
                <div className="mt-2 p-3 rounded bg-[#F6F4EC] border border-[#174D32]/15 space-y-2">
                  <p className="text-[11px] text-[#1B2B22]/75 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                    Test how server verification blocks tampered callbacks before application submission.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onOutcome('tampered_signature', selectedApp)}
                      className="py-1.5 px-2.5 text-[11px] font-semibold text-red-800 bg-white border border-red-200 rounded hover:bg-red-50"
                    >
                      Test Invalid Signature
                    </button>
                    <button
                      type="button"
                      onClick={() => onOutcome('tampered_amount', selectedApp)}
                      className="py-1.5 px-2.5 text-[11px] font-semibold text-red-800 bg-white border border-red-200 rounded hover:bg-red-50"
                    >
                      Test Mismatched Amount
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
