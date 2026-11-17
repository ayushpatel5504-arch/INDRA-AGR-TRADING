import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  MailCheck,
  Printer,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import type {
  ApplicationFormDraft,
  JobVacancy,
  OtpChallenge,
  PaymentSettings,
  PaymentTransaction,
  SubmittedApplication,
  UploadedDocument,
} from '../types/recruitment';
import {
  createOtpChallenge,
  validateApplicationStep,
  validateUploadFile,
  verifyOtpChallenge,
} from '../utils/recruitmentLogic';
import { formatPaiseToInr } from '../utils/paymentLogic';
import {
  PaymentCheckoutModal,
  type CheckoutActionType,
} from './PaymentCheckoutModal';
import { PaymentReceiptView } from './PaymentReceiptView';
import { RefundPolicyModal } from './RefundPolicyModal';

const STEPS = [
  '1. Personal',
  '2. Contact',
  '3. Education',
  '4. Job Info',
  '5. Documents',
  '6. OTP Verify',
  '7. Preview',
  '8. Payment',
  '9. Confirmation',
];

const EMPTY_DRAFT: ApplicationFormDraft = {
  fullName: '',
  fatherName: '',
  dateOfBirth: '',
  gender: '',
  nationality: 'Indian',
  mobileNumber: '',
  emailAddress: '',
  permanentAddress: '',
  district: '',
  state: '',
  pinCode: '',
  tenthBoard: '',
  tenthPassingYear: '',
  tenthRollNumber: '',
  tenthMarksObtained: '',
  tenthTotalMarks: '500',
  twelfthBoard: '',
  twelfthPassingYear: '',
  twelfthRollNumber: '',
  twelfthMarksObtained: '',
  twelfthTotalMarks: '500',
  highestQualification: '',
  additionalQualifications: [],
  computerSkills: '',
  jobId: '',
  preferredLocation: '',
  experienceLevel: 'Fresher',
  previousEmployer: '',
  previousDesignation: '',
  expectedSalary: '',
  documents: [],
  mobileVerified: false,
  emailVerified: false,
  declarationAccepted: false,
  privacyConsentAccepted: false,
};

export interface CheckoutOutcomeResult {
  ok: boolean;
  status: PaymentTransaction['paymentStatus'];
  error?: string;
  transaction: PaymentTransaction;
  application?: SubmittedApplication;
}

interface ApplicationWizardProps {
  jobs: JobVacancy[];
  preselectedJobId?: number;
  smsConfigured: boolean;
  smtpConfigured: boolean;
  paymentSettings: PaymentSettings;
  companyName: string;
  onCreatePaymentOrder: (
    draft: ApplicationFormDraft
  ) => { ok: boolean; error?: string; order?: PaymentTransaction };
  onCompleteCheckout: (
    orderId: string,
    action: CheckoutActionType,
    upiApp: string,
    draft: ApplicationFormDraft
  ) => CheckoutOutcomeResult;
  onSimulatePendingWebhook: (
    orderId: string,
    draft: ApplicationFormDraft
  ) => CheckoutOutcomeResult;
  onNavigate: (path: string) => void;
}

export const ApplicationWizard: React.FC<ApplicationWizardProps> = ({
  jobs,
  preselectedJobId,
  smsConfigured,
  smtpConfigured,
  paymentSettings,
  companyName,
  onCreatePaymentOrder,
  onCompleteCheckout,
  onSimulatePendingWebhook,
  onNavigate,
}) => {
  const publishedJobs = jobs.filter((j) => j.status === 'published');
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<ApplicationFormDraft>(() => ({
    ...EMPTY_DRAFT,
    jobId: preselectedJobId || (publishedJobs[0]?.id ?? ''),
  }));
  const [errors, setErrors] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState('');

  // OTP state
  const [mobileChallenge, setMobileChallenge] = useState<OtpChallenge | null>(null);
  const [emailChallenge, setEmailChallenge] = useState<OtpChallenge | null>(null);
  const [mobileInput, setMobileInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [mobileMsg, setMobileMsg] = useState('');
  const [emailMsg, setEmailMsg] = useState('');
  const [sandboxMobileCode, setSandboxMobileCode] = useState('');
  const [sandboxEmailCode, setSandboxEmailCode] = useState('');

  // Payment & Submission state
  const [activeOrder, setActiveOrder] = useState<PaymentTransaction | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentIssue, setPaymentIssue] = useState<{
    status: 'failed' | 'cancelled' | 'pending';
    orderId: string;
    message: string;
  } | null>(null);
  const [paymentOrderError, setPaymentOrderError] = useState('');
  const [verifiedTx, setVerifiedTx] = useState<PaymentTransaction | null>(null);
  const [submitted, setSubmitted] = useState<SubmittedApplication | null>(null);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [refundPolicyOpen, setRefundPolicyOpen] = useState(false);

  useEffect(() => {
    if (preselectedJobId) {
      setDraft((d) => ({ ...d, jobId: preselectedJobId }));
    }
  }, [preselectedJobId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const updateField = <K extends keyof ApplicationFormDraft>(
    key: K,
    value: ApplicationFormDraft[K]
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleNext = () => {
    const stepErrors = validateApplicationStep(step, draft);
    if (stepErrors.length > 0) {
      setErrors(stepErrors);
      return;
    }
    setErrors([]);
    if (step === 7) {
      setPaymentOrderError('');
      setStep(8);
      return;
    }
    setStep((s) => Math.min(8, s + 1));
  };

  const handlePrev = () => {
    setErrors([]);
    setPaymentIssue(null);
    setPaymentOrderError('');
    setStep((s) => Math.max(1, s - 1));
  };

  const handleFileUpload = (
    docType: UploadedDocument['type'],
    label: string,
    file: File | null
  ) => {
    if (!file) return;
    setUploadError('');
    const result = validateUploadFile(
      file.name,
      file.type,
      file.size,
      docType === 'photograph'
    );
    if (!result.ok || !result.storedFilename) {
      setUploadError(result.error ?? 'Invalid file.');
      return;
    }

    const newDoc: UploadedDocument = {
      id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: docType,
      label,
      originalFilename: file.name,
      storedFilename: result.storedFilename,
      mimeType: file.type,
      fileSizeBytes: file.size,
      verificationStatus: 'Pending',
      uploadedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST',
    };

    setDraft((prev) => ({
      ...prev,
      documents: [...prev.documents.filter((d) => d.type !== docType), newDoc],
    }));
  };

  const sendOtp = (channel: 'mobile' | 'email') => {
    if (channel === 'mobile' && !smsConfigured) {
      setMobileMsg('SMS provider is not configured. Configure SMS settings in Admin.');
      return;
    }
    if (channel === 'email' && !smtpConfigured) {
      setEmailMsg('SMTP email service is not configured. Configure SMTP settings in Admin.');
      return;
    }

    const now = Date.now();
    const existing = channel === 'mobile' ? mobileChallenge : emailChallenge;
    if (existing && now < existing.resendAvailableAtMs && !existing.verified) {
      const secs = Math.ceil((existing.resendAvailableAtMs - now) / 1000);
      const msg = `Please wait ${secs}s before requesting another OTP.`;
      if (channel === 'mobile') setMobileMsg(msg);
      else setEmailMsg(msg);
      return;
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const recipient = channel === 'mobile' ? draft.mobileNumber : draft.emailAddress;
    const challenge = createOtpChallenge(channel, recipient, code, now);

    if (channel === 'mobile') {
      setMobileChallenge(challenge);
      setSandboxMobileCode(code);
      setMobileMsg('6-digit OTP dispatched to your mobile number. Valid for 5 minutes.');
    } else {
      setEmailChallenge(challenge);
      setSandboxEmailCode(code);
      setEmailMsg('6-digit OTP dispatched to your email address. Valid for 5 minutes.');
    }
  };

  const verifyOtp = (channel: 'mobile' | 'email') => {
    const challenge = channel === 'mobile' ? mobileChallenge : emailChallenge;
    const input = channel === 'mobile' ? mobileInput : emailInput;
    if (!challenge) {
      if (channel === 'mobile') setMobileMsg('Request a Mobile OTP first.');
      else setEmailMsg('Request an Email OTP first.');
      return;
    }
    const res = verifyOtpChallenge(challenge, input, Date.now());
    if (channel === 'mobile') {
      setMobileChallenge(res.updated);
      if (res.ok) {
        updateField('mobileVerified', true);
        setMobileMsg('Mobile number verified successfully.');
      } else {
        setMobileMsg(res.error ?? 'Invalid OTP.');
      }
    } else {
      setEmailChallenge(res.updated);
      if (res.ok) {
        updateField('emailVerified', true);
        setEmailMsg('Email address verified successfully.');
      } else {
        setEmailMsg(res.error ?? 'Invalid OTP.');
      }
    }
  };

  const handlePayFeeClick = () => {
    setPaymentOrderError('');
    setPaymentIssue(null);
    const step7Errors = validateApplicationStep(7, draft);
    if (step7Errors.length > 0) {
      setErrors(step7Errors);
      return;
    }
    const orderRes = onCreatePaymentOrder(draft);
    if (!orderRes.ok || !orderRes.order) {
      setPaymentOrderError(orderRes.error ?? 'Unable to create payment order.');
      return;
    }
    setActiveOrder(orderRes.order);
    setCheckoutOpen(true);
  };

  const handleGatewayOutcome = (action: CheckoutActionType, upiApp: string) => {
    if (!activeOrder) return;
    setCheckoutOpen(false);
    const result = onCompleteCheckout(activeOrder.paymentOrderId, action, upiApp, draft);
    if (result.ok && result.status === 'success' && result.application) {
      setPaymentIssue(null);
      setVerifiedTx(result.transaction);
      setSubmitted(result.application);
      setStep(9);
      return;
    }

    setPaymentIssue({
      status:
        result.status === 'cancelled'
          ? 'cancelled'
          : result.status === 'pending'
          ? 'pending'
          : 'failed',
      orderId: result.transaction.paymentOrderId,
      message:
        result.error ||
        'Payment verification failed. Your application was not submitted.',
    });
  };

  const handleCheckWebhookForPending = () => {
    if (!paymentIssue) return;
    const result = onSimulatePendingWebhook(paymentIssue.orderId, draft);
    if (result.ok && result.status === 'success' && result.application) {
      setPaymentIssue(null);
      setVerifiedTx(result.transaction);
      setSubmitted(result.application);
      setStep(9);
    } else {
      setPaymentOrderError(result.error ?? 'Webhook confirmation unavailable.');
    }
  };

  const selectedJob = publishedJobs.find((j) => j.id === Number(draft.jobId));
  const feeConfigured =
    paymentSettings.gatewayEnabled && paymentSettings.applicationFeePaise > 0;
  const formattedFee = formatPaiseToInr(paymentSettings.applicationFeePaise);

  const inputClass =
    'w-full px-3.5 py-2.5 text-sm border border-[#174D32]/25 rounded-md bg-white focus:outline-2 focus:outline-[#174D32]';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="no-print space-y-3 border-b border-[#174D32]/15 pb-6">
        <p className="text-xs font-semibold tracking-wider text-[#174D32]">
          Online Job Application &amp; UPI Payment Portal
        </p>
        <h1 className="font-serif-display text-3xl sm:text-4xl font-bold text-[#1B2B22]">
          Apply to {companyName}
        </h1>
        <p className="text-xs text-[#1B2B22]/85 bg-white border border-[#C7A65A]/60 rounded-md px-4 py-2.5">
          {feeConfigured ? (
            <>
              <strong>Configured Application Fee:</strong>{' '}
              <span className="font-mono-data font-semibold">
                {paymentSettings.currency} {formattedFee}
              </span>{' '}
              payable exclusively via the official{' '}
              <span className="capitalize">{paymentSettings.provider}</span> UPI checkout in Step 8
              before final submission. Do not send funds to any personal QR code or unverified link.
            </>
          ) : (
            <>
              Online application fee collection is currently not configured/enabled by Admin. An
              administrator must configure the official fee amount (INR) and enable{' '}
              <span className="capitalize">{paymentSettings.provider}</span> in Admin Payment
              Settings before fee payments can proceed.
            </>
          )}
        </p>
      </div>

      {/* Step Indicator */}
      <nav aria-label="Application Progress" className="no-print overflow-x-auto pb-2">
        <ol className="flex items-center gap-2 min-w-max">
          {STEPS.map((label, idx) => {
            const num = idx + 1;
            const active = num === step;
            const done = num < step;
            return (
              <li
                key={label}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                  active
                    ? 'bg-[#174D32] text-white'
                    : done
                    ? 'bg-[#174D32]/12 text-[#174D32]'
                    : 'bg-white text-[#1B2B22]/55 border border-[#174D32]/10'
                }`}
              >
                {label}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <div
          role="alert"
          className="no-print p-4 rounded-md bg-red-50 border border-red-200 text-sm text-red-800 space-y-1"
        >
          <p className="font-semibold">Please correct the following before proceeding:</p>
          <ul className="list-disc pl-5 text-xs space-y-0.5">
            {errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Card */}
      <div className="p-6 sm:p-8 bg-white rounded-lg border border-[#174D32]/15 space-y-6">
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="font-serif-display text-2xl font-bold text-[#174D32]">
              Step 1 — Personal Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="app-fullname" className="block text-sm font-medium mb-1">
                  Full Name *
                </label>
                <input
                  id="app-fullname"
                  value={draft.fullName}
                  onChange={(e) => updateField('fullName', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="app-father" className="block text-sm font-medium mb-1">
                  Father&apos;s Name (optional)
                </label>
                <input
                  id="app-father"
                  value={draft.fatherName}
                  onChange={(e) => updateField('fatherName', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="app-dob" className="block text-sm font-medium mb-1">
                  Date of Birth *
                </label>
                <input
                  id="app-dob"
                  type="date"
                  value={draft.dateOfBirth}
                  onChange={(e) => updateField('dateOfBirth', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="app-gender" className="block text-sm font-medium mb-1">
                  Gender (optional)
                </label>
                <select
                  id="app-gender"
                  value={draft.gender}
                  onChange={(e) => updateField('gender', e.target.value)}
                  className={inputClass}
                >
                  <option value="">Prefer not to say</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label htmlFor="app-nationality" className="block text-sm font-medium mb-1">
                  Nationality *
                </label>
                <input
                  id="app-nationality"
                  value={draft.nationality}
                  onChange={(e) => updateField('nationality', e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h2 className="font-serif-display text-2xl font-bold text-[#174D32]">
              Step 2 — Contact Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="app-mobile" className="block text-sm font-medium mb-1">
                  Mobile Number (10 digits) *
                </label>
                <input
                  id="app-mobile"
                  inputMode="numeric"
                  maxLength={10}
                  value={draft.mobileNumber}
                  onChange={(e) => updateField('mobileNumber', e.target.value.replace(/\D/g, ''))}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="app-email" className="block text-sm font-medium mb-1">
                  Email Address *
                </label>
                <input
                  id="app-email"
                  type="email"
                  value={draft.emailAddress}
                  onChange={(e) => updateField('emailAddress', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="app-address" className="block text-sm font-medium mb-1">
                  Permanent Address *
                </label>
                <textarea
                  id="app-address"
                  rows={2}
                  value={draft.permanentAddress}
                  onChange={(e) => updateField('permanentAddress', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="app-district" className="block text-sm font-medium mb-1">
                  District *
                </label>
                <input
                  id="app-district"
                  value={draft.district}
                  onChange={(e) => updateField('district', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="app-state" className="block text-sm font-medium mb-1">
                  State *
                </label>
                <input
                  id="app-state"
                  value={draft.state}
                  onChange={(e) => updateField('state', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="app-pin" className="block text-sm font-medium mb-1">
                  PIN Code (6 digits) *
                </label>
                <input
                  id="app-pin"
                  inputMode="numeric"
                  maxLength={6}
                  value={draft.pinCode}
                  onChange={(e) => updateField('pinCode', e.target.value.replace(/\D/g, ''))}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h2 className="font-serif-display text-2xl font-bold text-[#174D32]">
              Step 3 — Educational Details
            </h2>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-[#1B2B22]">10th Standard *</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <input
                  aria-label="10th Board"
                  placeholder="10th Board *"
                  value={draft.tenthBoard}
                  onChange={(e) => updateField('tenthBoard', e.target.value)}
                  className={inputClass}
                />
                <input
                  aria-label="10th Passing Year"
                  placeholder="Passing Year (YYYY) *"
                  maxLength={4}
                  value={draft.tenthPassingYear}
                  onChange={(e) => updateField('tenthPassingYear', e.target.value)}
                  className={inputClass}
                />
                <input
                  aria-label="10th Roll Number"
                  placeholder="Roll Number *"
                  value={draft.tenthRollNumber}
                  onChange={(e) => updateField('tenthRollNumber', e.target.value)}
                  className={inputClass}
                />
                <input
                  aria-label="10th Marks Obtained"
                  placeholder="Marks Obtained *"
                  type="number"
                  value={draft.tenthMarksObtained}
                  onChange={(e) => updateField('tenthMarksObtained', e.target.value)}
                  className={inputClass}
                />
                <input
                  aria-label="10th Total Marks"
                  placeholder="Total Marks *"
                  type="number"
                  value={draft.tenthTotalMarks}
                  onChange={(e) => updateField('tenthTotalMarks', e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-[#174D32]/10">
              <h3 className="text-sm font-semibold text-[#1B2B22]">12th Standard *</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <input
                  aria-label="12th Board"
                  placeholder="12th Board *"
                  value={draft.twelfthBoard}
                  onChange={(e) => updateField('twelfthBoard', e.target.value)}
                  className={inputClass}
                />
                <input
                  aria-label="12th Passing Year"
                  placeholder="Passing Year (YYYY) *"
                  maxLength={4}
                  value={draft.twelfthPassingYear}
                  onChange={(e) => updateField('twelfthPassingYear', e.target.value)}
                  className={inputClass}
                />
                <input
                  aria-label="12th Roll Number"
                  placeholder="Roll Number *"
                  value={draft.twelfthRollNumber}
                  onChange={(e) => updateField('twelfthRollNumber', e.target.value)}
                  className={inputClass}
                />
                <input
                  aria-label="12th Marks Obtained"
                  placeholder="Marks Obtained *"
                  type="number"
                  value={draft.twelfthMarksObtained}
                  onChange={(e) => updateField('twelfthMarksObtained', e.target.value)}
                  className={inputClass}
                />
                <input
                  aria-label="12th Total Marks"
                  placeholder="Total Marks *"
                  type="number"
                  value={draft.twelfthTotalMarks}
                  onChange={(e) => updateField('twelfthTotalMarks', e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#174D32]/10">
              <div>
                <label htmlFor="app-highest" className="block text-sm font-medium mb-1">
                  Highest Qualification *
                </label>
                <input
                  id="app-highest"
                  placeholder="e.g., B.Sc. Agriculture, B.Com"
                  value={draft.highestQualification}
                  onChange={(e) => updateField('highestQualification', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="app-skills" className="block text-sm font-medium mb-1">
                  Computer Skills
                </label>
                <input
                  id="app-skills"
                  placeholder="e.g., MS Excel, Tally, Email"
                  value={draft.computerSkills}
                  onChange={(e) => updateField('computerSkills', e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <h2 className="font-serif-display text-2xl font-bold text-[#174D32]">
              Step 4 — Job Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="app-job" className="block text-sm font-medium mb-1">
                  Position Applied For *
                </label>
                <select
                  id="app-job"
                  value={draft.jobId}
                  onChange={(e) =>
                    updateField('jobId', e.target.value ? Number(e.target.value) : '')
                  }
                  className={inputClass}
                >
                  <option value="">Select published vacancy</option>
                  {publishedJobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title} ({j.location})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="app-pref-loc" className="block text-sm font-medium mb-1">
                  Preferred Work Location *
                </label>
                <input
                  id="app-pref-loc"
                  value={draft.preferredLocation}
                  onChange={(e) => updateField('preferredLocation', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="app-exp" className="block text-sm font-medium mb-1">
                  Experience Level *
                </label>
                <select
                  id="app-exp"
                  value={draft.experienceLevel}
                  onChange={(e) =>
                    updateField('experienceLevel', e.target.value as 'Fresher' | 'Experienced')
                  }
                  className={inputClass}
                >
                  <option value="Fresher">Fresher</option>
                  <option value="Experienced">Experienced</option>
                </select>
              </div>
              <div>
                <label htmlFor="app-salary" className="block text-sm font-medium mb-1">
                  Expected Salary (optional)
                </label>
                <input
                  id="app-salary"
                  value={draft.expectedSalary}
                  onChange={(e) => updateField('expectedSalary', e.target.value)}
                  className={inputClass}
                />
              </div>
              {draft.experienceLevel === 'Experienced' && (
                <>
                  <div>
                    <label htmlFor="app-employer" className="block text-sm font-medium mb-1">
                      Previous Employer (optional)
                    </label>
                    <input
                      id="app-employer"
                      value={draft.previousEmployer}
                      onChange={(e) => updateField('previousEmployer', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="app-desig" className="block text-sm font-medium mb-1">
                      Previous Designation (optional)
                    </label>
                    <input
                      id="app-desig"
                      value={draft.previousDesignation}
                      onChange={(e) => updateField('previousDesignation', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-serif-display text-2xl font-bold text-[#174D32]">
                Step 5 — Photograph &amp; Document Upload
              </h2>
              <p className="text-xs text-[#1B2B22]/70 mt-1">
                Allowed formats: PDF, JPG, JPEG, PNG. Max 2 MB for photograph, 5 MB for documents.
                Stored securely outside public web directories with randomized filenames.
              </p>
            </div>

            {uploadError && (
              <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 p-3 rounded-md">
                {uploadError}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(
                [
                  ['photograph', 'Candidate Photograph *'],
                  ['resume', 'Resume / CV *'],
                  ['tenth_marksheet', '10th Marksheet (optional)'],
                  ['twelfth_marksheet', '12th Marksheet (optional)'],
                  ['highest_qualification', 'Highest Qualification Certificate (optional)'],
                  ['other', 'Other Relevant Document (optional)'],
                ] as const
              ).map(([docType, label]) => {
                const uploaded = draft.documents.find((d) => d.type === docType);
                return (
                  <div
                    key={docType}
                    className="p-4 rounded-md bg-[#F6F4EC] border border-[#174D32]/15 space-y-2"
                  >
                    <p className="text-sm font-medium text-[#1B2B22]">{label}</p>
                    {uploaded ? (
                      <div className="flex items-center justify-between gap-2 text-xs text-[#174D32] bg-white p-2.5 rounded border border-[#174D32]/15">
                        <span className="truncate flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 shrink-0" />
                          {uploaded.originalFilename}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${label}`}
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              documents: prev.documents.filter((d) => d.type !== docType),
                            }))
                          }
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#174D32] bg-white border border-[#174D32]/25 rounded-md cursor-pointer hover:bg-[#174D32]/5">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Choose File</span>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="sr-only"
                          onChange={(e) =>
                            handleFileUpload(docType, label, e.target.files?.[0] ?? null)
                          }
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif-display text-2xl font-bold text-[#174D32]">
                Step 6 — Mandatory Mobile &amp; Email OTP Verification
              </h2>
              <p className="text-xs text-[#1B2B22]/75 mt-1">
                Both 6-digit OTP verifications are mandatory (5-minute expiry, max 5 attempts,
                60-second resend cooldown).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Mobile OTP */}
              <div className="p-5 rounded-lg bg-[#F6F4EC] border border-[#174D32]/15 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#1B2B22]">
                    Mobile OTP ({draft.mobileNumber})
                  </h3>
                  {draft.mobileVerified && (
                    <span className="text-xs font-semibold text-[#174D32] inline-flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4" /> Verified
                    </span>
                  )}
                </div>

                {!draft.mobileVerified && (
                  <>
                    <button
                      type="button"
                      onClick={() => sendOtp('mobile')}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md"
                    >
                      Send Mobile OTP
                    </button>
                    {sandboxMobileCode && (
                      <p className="text-xs font-mono-data text-[#103B27] bg-white px-2.5 py-1.5 rounded border border-[#C7A65A]/50">
                        Preview OTP Dispatch: {sandboxMobileCode}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <input
                        aria-label="Enter Mobile OTP"
                        placeholder="6-digit OTP"
                        maxLength={6}
                        value={mobileInput}
                        onChange={(e) => setMobileInput(e.target.value.replace(/\D/g, ''))}
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() => verifyOtp('mobile')}
                        className="px-4 py-2 text-xs font-semibold text-[#174D32] border border-[#174D32] rounded-md hover:bg-white whitespace-nowrap"
                      >
                        Verify
                      </button>
                    </div>
                  </>
                )}
                {mobileMsg && <p className="text-xs text-[#1B2B22]/80">{mobileMsg}</p>}
              </div>

              {/* Email OTP */}
              <div className="p-5 rounded-lg bg-[#F6F4EC] border border-[#174D32]/15 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#1B2B22] truncate">
                    Email OTP ({draft.emailAddress})
                  </h3>
                  {draft.emailVerified && (
                    <span className="text-xs font-semibold text-[#174D32] inline-flex items-center gap-1 shrink-0">
                      <ShieldCheck className="w-4 h-4" /> Verified
                    </span>
                  )}
                </div>

                {!draft.emailVerified && (
                  <>
                    <button
                      type="button"
                      onClick={() => sendOtp('email')}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md"
                    >
                      Send Email OTP
                    </button>
                    {sandboxEmailCode && (
                      <p className="text-xs font-mono-data text-[#103B27] bg-white px-2.5 py-1.5 rounded border border-[#C7A65A]/50">
                        Preview OTP Dispatch: {sandboxEmailCode}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <input
                        aria-label="Enter Email OTP"
                        placeholder="6-digit OTP"
                        maxLength={6}
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value.replace(/\D/g, ''))}
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() => verifyOtp('email')}
                        className="px-4 py-2 text-xs font-semibold text-[#174D32] border border-[#174D32] rounded-md hover:bg-white whitespace-nowrap"
                      >
                        Verify
                      </button>
                    </div>
                  </>
                )}
                {emailMsg && <p className="text-xs text-[#1B2B22]/80">{emailMsg}</p>}
              </div>
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-6">
            <h2 className="font-serif-display text-2xl font-bold text-[#174D32]">
              Step 7 — Application Preview &amp; Declaration
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-[#F6F4EC] p-5 rounded-lg border border-[#174D32]/12">
              <div>
                <p className="text-xs text-[#1B2B22]/60">Candidate Name</p>
                <p className="font-semibold">{draft.fullName}</p>
              </div>
              <div>
                <p className="text-xs text-[#1B2B22]/60">Position Applied For</p>
                <p className="font-semibold">{selectedJob?.title ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-[#1B2B22]/60">Verified Mobile &amp; Email</p>
                <p className="font-mono-data text-xs">
                  {draft.mobileNumber} · {draft.emailAddress}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#1B2B22]/60">Highest Qualification</p>
                <p>{draft.highestQualification}</p>
              </div>
              <div>
                <p className="text-xs text-[#1B2B22]/60">10th / 12th Marks</p>
                <p className="font-mono-data text-xs">
                  10th: {draft.tenthMarksObtained}/{draft.tenthTotalMarks} ({draft.tenthBoard}) ·
                  12th: {draft.twelfthMarksObtained}/{draft.twelfthTotalMarks} ({draft.twelfthBoard})
                </p>
              </div>
              <div>
                <p className="text-xs text-[#1B2B22]/60">Uploaded Documents</p>
                <p>{draft.documents.length} file(s) attached</p>
              </div>
            </div>

            <div className="p-4 rounded-md bg-[#F6F4EC] border border-[#C7A65A]/70 text-xs space-y-1.5">
              <p className="font-semibold text-[#174D32]">
                Step 8 Payment Disclosure (Required Before Final Submission)
              </p>
              <p className="text-[#1B2B22]/85">
                {feeConfigured
                  ? `Application Fee: ${paymentSettings.currency} ${formattedFee} via official ${paymentSettings.provider.toUpperCase()} UPI checkout. Final submission and Application Number generation occur only after verified payment.`
                  : 'Application fee is currently INR 0.00 / disabled in Admin Payment Settings.'}
              </p>
              <p className="text-[#1B2B22]/75">
                <strong>Refund Policy:</strong> {paymentSettings.refundPolicy}
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-3 text-sm text-[#1B2B22]/85 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.declarationAccepted}
                  onChange={(e) => updateField('declarationAccepted', e.target.checked)}
                  className="mt-1 accent-[#174D32]"
                />
                <span>
                  I declare that all information provided in this application is true and correct
                  to the best of my knowledge. I understand that incorrect information may affect
                  my application.
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm text-[#1B2B22]/85 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.privacyConsentAccepted}
                  onChange={(e) => updateField('privacyConsentAccepted', e.target.checked)}
                  className="mt-1 accent-[#174D32]"
                />
                <span>
                  I consent to {companyName} processing my recruitment data in accordance with the{' '}
                  <button
                    type="button"
                    onClick={() => onNavigate('/privacy-policy')}
                    className="text-[#174D32] underline font-medium"
                  >
                    Privacy Policy
                  </button>{' '}
                  and{' '}
                  <button
                    type="button"
                    onClick={() => onNavigate('/recruitment-disclaimer')}
                    className="text-[#174D32] underline font-medium"
                  >
                    Payment &amp; Refund Policy
                  </button>
                  .
                </span>
              </label>
            </div>
          </div>
        )}

        {step === 8 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <p className="text-xs font-semibold tracking-wider text-[#174D32]">
                STEP 8 — SECURE UPI PAYMENT SUMMARY
              </p>
              <h2 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#1B2B22]">
                Application Fee Payment Summary
              </h2>
              <p className="text-xs text-[#1B2B22]/75">
                Complete payment using the official payment gateway UPI checkout. Your final
                application will be submitted automatically once payment is cryptographically verified.
              </p>
            </div>

            {/* Dedicated Payment Failure / Cancellation View */}
            {paymentIssue && (paymentIssue.status === 'failed' || paymentIssue.status === 'cancelled') && (
              <div
                role="alert"
                className="p-6 rounded-lg bg-red-50 border border-red-200 space-y-4"
              >
                <div className="flex items-start gap-3 text-red-900">
                  <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h3 className="font-serif-display text-xl font-bold">
                      Payment {paymentIssue.status === 'cancelled' ? 'Cancelled' : 'Failed'} — Application Not Submitted
                    </h3>
                    <p className="text-xs font-mono-data">
                      Order Reference: {paymentIssue.orderId} · Status: {paymentIssue.status.toUpperCase()}
                    </p>
                    <p className="text-sm text-red-800">{paymentIssue.message}</p>
                    <p className="text-xs text-red-700 pt-1">
                      Your form details, uploaded documents, and verified OTPs remain safely preserved.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handlePayFeeClick}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry Payment
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentIssue(null);
                      setStep(7);
                    }}
                    className="px-5 py-2.5 text-xs font-semibold text-[#174D32] bg-white border border-[#174D32]/30 hover:bg-[#F6F4EC] rounded-md"
                  >
                    Return to Application
                  </button>
                </div>
              </div>
            )}

            {/* Pending Payment View */}
            {paymentIssue && paymentIssue.status === 'pending' && (
              <div
                role="status"
                className="p-6 rounded-lg bg-amber-50 border border-amber-300 space-y-4"
              >
                <div className="flex items-start gap-3 text-amber-900">
                  <Clock className="w-6 h-6 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h3 className="font-serif-display text-xl font-bold">
                      Payment Pending Gateway / Webhook Confirmation
                    </h3>
                    <p className="text-xs font-mono-data">
                      Order ID: {paymentIssue.orderId} · Status: PENDING
                    </p>
                    <p className="text-sm">
                      {paymentIssue.message} Final application submission is held until server
                      webhook or gateway verification confirms capture.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleCheckWebhookForPending}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Verify via Signed Gateway Webhook (Test Mode)
                  </button>
                  <button
                    type="button"
                    onClick={handlePayFeeClick}
                    className="px-4 py-2.5 text-xs font-semibold text-[#1B2B22] bg-white border border-[#174D32]/30 rounded-md"
                  >
                    Create Fresh Payment Order
                  </button>
                </div>
              </div>
            )}

            {paymentOrderError && (
              <p role="alert" className="text-xs text-red-800 bg-red-50 border border-red-200 p-3 rounded-md">
                {paymentOrderError}
              </p>
            )}

            {/* Order Summary Breakdown */}
            <div className="p-5 bg-[#F6F4EC] rounded-lg border border-[#174D32]/15 divide-y divide-[#174D32]/10 text-sm">
              <div className="py-2.5 flex justify-between gap-4">
                <span className="text-[#1B2B22]/70">Candidate Name</span>
                <span className="font-semibold">{draft.fullName}</span>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <span className="text-[#1B2B22]/70">Position Applied For</span>
                <span className="font-semibold">{selectedJob?.title ?? '—'}</span>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <span className="text-[#1B2B22]/70">Payment Gateway</span>
                <span className="font-semibold capitalize">
                  {paymentSettings.provider} ({paymentSettings.mode} mode)
                </span>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <span className="text-[#1B2B22]/70">Supported Methods</span>
                <span className="font-medium">UPI QR Code &amp; UPI Apps</span>
              </div>
              <div className="pt-3 flex justify-between gap-4 text-base font-bold text-[#174D32]">
                <span>Application Fee Payable</span>
                <span className="font-mono-data">
                  {feeConfigured ? `${paymentSettings.currency} ${formattedFee}` : 'Not Configured'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-md bg-white border border-[#C7A65A] text-xs text-[#1B2B22]/85 space-y-2">
              <p>
                <strong>Payment Description:</strong> {paymentSettings.paymentDescription}
              </p>
              <p>
                <strong>Instructions:</strong> {paymentSettings.paymentInstructions}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#174D32]/10">
                <span>
                  Please review our official Refund Policy prior to initiating UPI payment.
                </span>
                <button
                  type="button"
                  onClick={() => setRefundPolicyOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#174D32] hover:underline"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Read Full Refund Policy
                </button>
              </div>
            </div>

            {!feeConfigured ? (
              <div className="p-5 rounded-md bg-amber-50 border border-amber-300 space-y-3">
                <p className="text-sm font-semibold text-amber-950">
                  Payment Gateway Disabled or Fee Not Configured
                </p>
                <p className="text-xs text-amber-900">
                  No fee amount has been configured or enabled by the Super Admin yet. Configure an
                  INR fee and enable Razorpay or Cashfree in Admin Payment Settings to accept UPI
                  payments.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => onNavigate('/admin/payment-settings')}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md"
                  >
                    Open Admin Payment Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefundPolicyOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#174D32] bg-white border border-[#174D32]/30 hover:bg-[#F6F4EC] rounded-md"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    View Refund Policy
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-1 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handlePayFeeClick}
                  className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md shadow-xs"
                >
                  <CreditCard className="w-4 h-4" />
                  Pay Application Fee ({paymentSettings.currency} {formattedFee})
                </button>
                <button
                  type="button"
                  onClick={() => setRefundPolicyOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-3.5 text-sm font-semibold text-[#174D32] bg-[#F6F4EC] border border-[#174D32]/30 hover:bg-white rounded-md"
                >
                  <FileText className="w-4 h-4" />
                  Refund Policy
                </button>
              </div>
            )}
          </div>
        )}

        {step === 9 && submitted && verifiedTx && (
          <div className="space-y-6">
            <div className="flex items-start gap-3 text-[#174D32]">
              <CheckCircle2 className="w-8 h-8 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-mono-data uppercase tracking-wider text-[#174D32]">
                  PAYMENT STATUS: SUCCESS · APPLICATION CONFIRMED
                </p>
                <h2 className="font-serif-display text-3xl font-bold text-[#1B2B22]">
                  Payment Verified &amp; Application Submitted
                </h2>
                <p className="text-xs text-[#1B2B22]/75 mt-1">
                  {companyName} — Save your Application Number and Official Payment Receipt for
                  future verification.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6 bg-[#F6F4EC] rounded-lg border border-[#174D32]/15 text-sm">
              <div>
                <p className="text-xs text-[#1B2B22]/60">Company Name</p>
                <p className="font-semibold">{companyName}</p>
              </div>
              <div>
                <p className="text-xs text-[#1B2B22]/60">Application Number</p>
                <p className="font-mono-data font-bold text-[#174D32] text-base">
                  {submitted.applicationNumber}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#1B2B22]/60">Receipt Number</p>
                <p className="font-mono-data font-bold text-[#174D32]">
                  {verifiedTx.receiptNumber}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#1B2B22]/60">Candidate Name</p>
                <p className="font-semibold">{submitted.fullName}</p>
              </div>
              <div>
                <p className="text-xs text-[#1B2B22]/60">Position Applied For</p>
                <p className="font-semibold">{submitted.jobTitle}</p>
              </div>
              <div>
                <p className="text-xs text-[#1B2B22]/60">Application Fee Paid</p>
                <p className="font-mono-data font-bold text-[#1B2B22]">
                  {verifiedTx.currency} {formatPaiseToInr(verifiedTx.amount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#1B2B22]/60">Gateway Payment ID</p>
                <p className="font-mono-data text-xs break-all">
                  {verifiedTx.gatewayPaymentId}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#1B2B22]/60">Order ID</p>
                <p className="font-mono-data text-xs break-all">
                  {verifiedTx.paymentOrderId}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#1B2B22]/60">UPI Reference / UTR</p>
                <p className="font-mono-data text-xs">
                  {verifiedTx.transactionReference ?? 'Verified'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#1B2B22]/60">Payment Date</p>
                <p className="font-mono-data">{verifiedTx.paidAtDate}</p>
              </div>
              <div>
                <p className="text-xs text-[#1B2B22]/60">Payment Time (Asia/Kolkata)</p>
                <p className="font-mono-data">{verifiedTx.paidAtTime}</p>
              </div>
              <div>
                <p className="text-xs text-[#1B2B22]/60">Payment Status</p>
                <p className="font-mono-data font-bold text-[#174D32]">SUCCESS</p>
              </div>
            </div>

            <div className="p-4 rounded-md bg-white border border-[#174D32]/20 text-xs text-[#1B2B22]/85 flex items-start gap-2.5">
              <MailCheck className="w-4 h-4 text-[#174D32] shrink-0 mt-0.5" />
              <div>
                <strong>Confirmation Email Prepared:</strong> Subject{' '}
                <span className="font-mono-data">
                  &ldquo;INDRA AGR – Application Payment Confirmation&rdquo;
                </span>{' '}
                to <span className="font-mono-data">{submitted.emailAddress}</span> with both the
                Application Form PDF ({submitted.applicationNumber}.pdf) and Official Payment
                Receipt PDF ({verifiedTx.receiptNumber}.pdf) attached.
              </div>
            </div>

            <div className="no-print flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md"
              >
                <Printer className="w-4 h-4" />
                Download / Print Application PDF
              </button>
              <button
                type="button"
                onClick={() => setShowReceiptPreview((v) => !v)}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-[#174D32] bg-[#F6F4EC] border border-[#174D32]/30 hover:bg-white rounded-md"
              >
                <Receipt className="w-4 h-4" />
                {showReceiptPreview
                  ? 'Hide Official Payment Receipt'
                  : 'Download / View Payment Receipt'}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/application-status')}
                className="px-5 py-2.5 text-sm font-semibold text-[#174D32] border border-[#174D32]/30 hover:bg-[#F6F4EC] rounded-md"
              >
                Track Application Status
              </button>
            </div>

            {showReceiptPreview && (
              <PaymentReceiptView
                transaction={verifiedTx}
                companyName={companyName}
                onClose={() => setShowReceiptPreview(false)}
              />
            )}
          </div>
        )}

        {/* Navigation Footer */}
        {step < 8 && (
          <div className="no-print pt-6 border-t border-[#174D32]/12 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={handlePrev}
              disabled={step === 1}
              className="px-5 py-2.5 text-sm font-semibold text-[#174D32] border border-[#174D32]/30 rounded-md hover:bg-[#F6F4EC] disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md"
            >
              {step === 7 ? 'Proceed to Payment Summary' : 'Save & Continue'}
            </button>
          </div>
        )}

        {step === 8 && (
          <div className="no-print pt-6 border-t border-[#174D32]/12 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={handlePrev}
              className="px-5 py-2.5 text-sm font-semibold text-[#174D32] border border-[#174D32]/30 rounded-md hover:bg-[#F6F4EC]"
            >
              Back to Application Preview
            </button>
          </div>
        )}
      </div>

      {checkoutOpen && activeOrder && (
        <PaymentCheckoutModal
          order={activeOrder}
          settings={paymentSettings}
          onOutcome={handleGatewayOutcome}
        />
      )}

      <RefundPolicyModal
        isOpen={refundPolicyOpen}
        onClose={() => setRefundPolicyOpen(false)}
        companyName={companyName}
        paymentSettings={paymentSettings}
      />
    </div>
  );
};
