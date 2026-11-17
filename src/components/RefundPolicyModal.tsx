import React, { useEffect } from 'react';
import { FileText, ShieldCheck, X } from 'lucide-react';
import type { PaymentSettings } from '../types/recruitment';
import { formatPaiseToInr } from '../utils/paymentLogic';

interface RefundPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
  paymentSettings: PaymentSettings;
}

export const RefundPolicyModal: React.FC<RefundPolicyModalProps> = ({
  isOpen,
  onClose,
  companyName,
  paymentSettings,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const policyText =
    paymentSettings.refundPolicy.trim() ||
    'No specific refund policy text has been configured by the administrator yet.';
  const feeActive =
    paymentSettings.gatewayEnabled && paymentSettings.applicationFeePaise > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="refund-policy-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-[#103B27]/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="w-full max-w-xl bg-white rounded-lg border border-[#174D32]/25 shadow-2xl overflow-hidden my-4">
        {/* Header */}
        <div className="bg-[#103B27] text-white px-6 py-4 flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-[11px] font-mono-data text-[#C7A65A] uppercase tracking-wider">
              {companyName} · PRE-PAYMENT DISCLOSURE
            </p>
            <h2
              id="refund-policy-modal-title"
              className="font-serif-display text-2xl font-bold text-white"
            >
              Application Fee Refund Policy
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close Refund Policy modal"
            onClick={onClose}
            className="p-1.5 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-sm text-[#1B2B22]">
          <div className="p-4 rounded-md bg-[#F6F4EC] border border-[#C7A65A]/70 space-y-2">
            <p className="text-xs font-semibold text-[#174D32] flex items-center gap-1.5">
              <FileText className="w-4 h-4 shrink-0" />
              Official Policy Text (Configured in Website Settings)
            </p>
            <p className="text-sm text-[#1B2B22] leading-relaxed whitespace-pre-line">
              {policyText}
            </p>
          </div>

          <div className="p-4 rounded-md bg-white border border-[#174D32]/15 space-y-2 text-xs text-[#1B2B22]/85">
            <p className="font-semibold text-[#174D32] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              Payment &amp; Gateway Transparency Summary
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div>
                <span className="text-[#1B2B22]/60">Configured Gateway: </span>
                <span className="font-semibold capitalize">
                  {paymentSettings.provider} ({paymentSettings.mode} mode)
                </span>
              </div>
              <div>
                <span className="text-[#1B2B22]/60">Application Fee: </span>
                <span className="font-mono-data font-semibold">
                  {feeActive
                    ? `${paymentSettings.currency} ${formatPaiseToInr(paymentSettings.applicationFeePaise)}`
                    : 'Not Configured'}
                </span>
              </div>
            </div>
            {paymentSettings.paymentInstructions.trim() && (
              <p className="pt-1 leading-relaxed text-[#1B2B22]/80">
                <strong>Payment Instructions:</strong>{' '}
                {paymentSettings.paymentInstructions}
              </p>
            )}
          </div>

          <div className="pt-2 border-t border-[#174D32]/12 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md transition-colors"
            >
              Close &amp; Return to Payment Summary
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
