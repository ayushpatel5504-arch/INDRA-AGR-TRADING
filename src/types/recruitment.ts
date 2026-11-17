export type ApplicationStatus =
  | 'Submitted'
  | 'Under Review'
  | 'Shortlisted'
  | 'Interview Scheduled'
  | 'Selected'
  | 'Rejected'
  | 'On Hold';

export type JobStatus = 'draft' | 'published' | 'closed' | 'archived';

export type EmploymentType =
  | 'Full-Time'
  | 'Part-Time'
  | 'Contract'
  | 'Internship'
  | 'Field Operations';

export type PaymentProvider = 'razorpay' | 'cashfree';
export type PaymentMode = 'test' | 'live';
export type PaymentStatus =
  | 'created'
  | 'pending'
  | 'processing'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'refunded';

export type RefundStatus =
  | 'Not Requested'
  | 'Requested'
  | 'Processing'
  | 'Refunded'
  | 'Refund Failed';

export interface PaymentSettings {
  gatewayEnabled: boolean;
  provider: PaymentProvider;
  mode: PaymentMode;
  applicationFeePaise: number;
  currency: 'INR';
  paymentDescription: string;
  paymentInstructions: string;
  refundPolicy: string;
  receiptPrefix: string;
  testKeyId: string;
  hasTestSecretConfigured: boolean;
  hasTestWebhookSecretConfigured: boolean;
  liveKeyId: string;
  hasLiveSecretConfigured: boolean;
  hasLiveWebhookSecretConfigured: boolean;
}

export interface PaymentTransaction {
  id: string;
  applicationNumber: string | null;
  candidateName: string;
  candidateEmail: string;
  candidateMobile: string;
  jobTitle: string;
  receiptNumber: string | null;
  gatewayProvider: PaymentProvider;
  gatewayMode: PaymentMode;
  paymentOrderId: string;
  gatewayPaymentId: string | null;
  gatewaySignature: string | null;
  amount: number; // paise
  currency: 'INR';
  paymentMethod: string;
  transactionReference: string | null; // UPI UTR / RRN
  paymentStatus: PaymentStatus;
  refundStatus: RefundStatus;
  refundId: string | null;
  refundReason: string | null;
  confirmationEmailSent: boolean;
  failureReason: string | null;
  paidAtDate: string | null;
  paidAtTime: string | null;
  createdAt: string;
}

export interface JobVacancy {
  id: number;
  title: string;
  slug: string;
  department: string;
  location: string;
  employmentType: EmploymentType;
  experienceRequired: string;
  qualifications: string;
  salaryRange: string;
  description: string;
  responsibilities: string[];
  applicationDeadline: string;
  status: JobStatus;
  createdAt: string;
}

export interface DirectorProfile {
  id: number;
  fullName: string;
  designation: string;
  bio: string;
  displayOrder: number;
}

export interface UploadedDocument {
  id: string;
  type:
    | 'photograph'
    | 'resume'
    | 'tenth_marksheet'
    | 'twelfth_marksheet'
    | 'highest_qualification'
    | 'other';
  label: string;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  verificationStatus: 'Pending' | 'Verified' | 'Re-upload Requested';
  uploadedAt: string;
}

export interface StatusHistoryEntry {
  id: string;
  previousStatus: ApplicationStatus | null;
  newStatus: ApplicationStatus;
  changedBy: string;
  remarks: string;
  timestamp: string;
}

export interface InterviewRecord {
  id: string;
  applicationNumber: string;
  candidateName: string;
  jobTitle: string;
  interviewDate: string;
  interviewTime: string;
  mode: 'Online' | 'Offline';
  locationOrLink: string;
  instructions: string;
  status: 'Scheduled' | 'Rescheduled' | 'Completed' | 'Cancelled';
}

export interface AdditionalQualification {
  degree: string;
  institution: string;
  year: string;
}

export interface ApplicationFormDraft {
  // Step 1: Personal
  fullName: string;
  fatherName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  // Step 2: Contact
  mobileNumber: string;
  emailAddress: string;
  permanentAddress: string;
  district: string;
  state: string;
  pinCode: string;
  // Step 3: Education
  tenthBoard: string;
  tenthPassingYear: string;
  tenthRollNumber: string;
  tenthMarksObtained: string;
  tenthTotalMarks: string;
  twelfthBoard: string;
  twelfthPassingYear: string;
  twelfthRollNumber: string;
  twelfthMarksObtained: string;
  twelfthTotalMarks: string;
  highestQualification: string;
  additionalQualifications: AdditionalQualification[];
  computerSkills: string;
  // Step 4: Job Info
  jobId: number | '';
  preferredLocation: string;
  experienceLevel: 'Fresher' | 'Experienced';
  previousEmployer: string;
  previousDesignation: string;
  expectedSalary: string;
  // Step 5: Documents
  documents: UploadedDocument[];
  // Step 6: Verification
  mobileVerified: boolean;
  emailVerified: boolean;
  // Step 7: Declaration
  declarationAccepted: boolean;
  privacyConsentAccepted: boolean;
}

export interface SubmittedApplication extends ApplicationFormDraft {
  id: number;
  applicationNumber: string;
  jobTitle: string;
  status: ApplicationStatus;
  submittedDate: string;
  submittedTime: string;
  internalRemarks: string;
  statusHistory: StatusHistoryEntry[];
  paymentTransactionId?: string | null;
  receiptNumber?: string | null;
  feeAmountPaise?: number;
}

export interface WebsiteSettings {
  companyName: string;
  tagline: string;
  values: string;
  officeAddress: string;
  contactEmail: string;
  contactPhone: string;
  smtpConfigured: boolean;
  smtpHost: string;
  smsConfigured: boolean;
  smsProvider: string;
  paymentSettings: PaymentSettings;
}

export interface OtpChallenge {
  channel: 'mobile' | 'email';
  recipient: string;
  codeHash: string;
  expiresAtMs: number;
  attempts: number;
  maxAttempts: number;
  resendAvailableAtMs: number;
  verified: boolean;
}
