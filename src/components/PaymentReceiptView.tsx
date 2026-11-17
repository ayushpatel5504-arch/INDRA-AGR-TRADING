import React from 'react';
import { Printer, X } from 'lucide-react';
import type { PaymentTransaction } from '../types/recruitment';
import { formatPaiseToInr } from '../utils/paymentLogic';

interface PaymentReceiptViewProps {
  transaction: PaymentTransaction;
  companyName: string;
  onClose?: () => void;
}

export const PaymentReceiptView: React.FC<PaymentReceiptViewProps> = ({
  transaction,
  companyName,
  onClose,
}) => {
  return (
    <div className="p-6 sm:p-8 bg-white rounded-lg border-2 border-[#174D32]/25 space-y-6">
      <div className="flex items-start justify-between gap-4 border-b-2 border-[#174D32] pb-4">
        <div>
          <p className="text-xs font-semibold tracking-wider text-[#174D32]">
            OFFICIAL APPLICATION FEE RECEIPT
          </p>
          <h3 className="font-serif-display text-2xl font-bold text-[#1B2B22] mt-0.5">
            {companyName}
          </h3>
          <p className="text-xs text-[#1B2B22]/70">
            Connecting Farmers, Growing Businesses. — Quality | Trust | Growth
          </p>
        </div>
        <div className="text-right space-y-1">
          <p className="text-xs text-[#1B2B22]/60">Receipt Number</p>
          <p className="font-mono-data text-sm font-bold text-[#174D32]">
            {transaction.receiptNumber ?? 'PENDING'}
          </p>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="no-print inline-flex items-center gap-1 text-xs text-[#1B2B22]/60 hover:text-[#1B2B22] pt-1"
            >
              <X className="w-3.5 h-3.5" /> Close Receipt
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-[#F6F4EC] p-5 rounded-md border border-[#174D32]/12">
        <div>
          <p className="text-xs text-[#1B2B22]/60">Candidate Name</p>
          <p className="font-semibold">{transaction.candidateName}</p>
        </div>
        <div>
          <p className="text-xs text-[#1B2B22]/60">Application Number</p>
          <p className="font-mono-data font-bold text-[#174D32]">
            {transaction.applicationNumber ?? '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-[#1B2B22]/60">Position Applied For</p>
          <p className="font-semibold">{transaction.jobTitle}</p>
        </div>
        <div>
          <p className="text-xs text-[#1B2B22]/60">Payment Status</p>
          <p className="font-mono-data font-bold text-[#174D32] uppercase">
            {transaction.paymentStatus}
          </p>
        </div>
        <div>
          <p className="text-xs text-[#1B2B22]/60">Amount Paid</p>
          <p className="font-mono-data font-bold text-base text-[#1B2B22]">
            {transaction.currency} {formatPaiseToInr(transaction.amount)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[#1B2B22]/60">Gateway &amp; Method</p>
          <p className="capitalize">
            {transaction.gatewayProvider} ({transaction.gatewayMode}) · {transaction.paymentMethod}
          </p>
        </div>
        <div>
          <p className="text-xs text-[#1B2B22]/60">Gateway Payment ID</p>
          <p className="font-mono-data text-xs break-all">
            {transaction.gatewayPaymentId ?? '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-[#1B2B22]/60">Order ID</p>
          <p className="font-mono-data text-xs break-all">{transaction.paymentOrderId}</p>
        </div>
        <div>
          <p className="text-xs text-[#1B2B22]/60">UPI Transaction Reference / UTR</p>
          <p className="font-mono-data text-xs">{transaction.transactionReference ?? 'Verified'}</p>
        </div>
        <div>
          <p className="text-xs text-[#1B2B22]/60">Payment Date &amp; Time (IST)</p>
          <p className="font-mono-data text-xs">
            {transaction.paidAtDate ?? '—'} {transaction.paidAtTime ?? ''}
          </p>
        </div>
      </div>

      <p className="text-[11px] text-[#1B2B22]/70 leading-relaxed">
        This is a computer-generated official recruitment application fee payment receipt issued
        by {companyName} upon server-side gateway verification. This document is an application
        payment receipt and is not a GST tax invoice.
      </p>

      <div className="no-print flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md"
        >
          <Printer className="w-3.5 h-3.5" />
          Print / Save Official Payment Receipt PDF
        </button>
      </div>
    </div>
  );
};
