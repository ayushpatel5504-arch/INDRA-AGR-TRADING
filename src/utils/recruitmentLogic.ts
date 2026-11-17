import type {
  ApplicationFormDraft,
  ApplicationStatus,
  OtpChallenge,
  SubmittedApplication,
} from '../types/recruitment';

export const ALLOWED_DOCUMENT_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Concurrency-safe style sequential formatter: INDRA-AGR-2026-000001
 */
export function formatApplicationNumber(year: number, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error('Sequence must be a positive integer.');
  }
  return `INDRA-AGR-${year}-${String(sequence).padStart(6, '0')}`;
}

/**
 * Deterministic lightweight hash for client-side verification tests.
 * (Production PHP backend uses password_hash / hash_hmac with server secret.)
 */
export function hashOtp(otp: string, salt: string): string {
  const input = `${salt}::${otp}`;
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `otp_${(h >>> 0).toString(16).padStart(8, '0')}`;
}

export function createOtpChallenge(
  channel: 'mobile' | 'email',
  recipient: string,
  otpCode: string,
  nowMs: number = Date.now()
): OtpChallenge {
  return {
    channel,
    recipient: recipient.trim(),
    codeHash: hashOtp(otpCode, `${channel}:${recipient.trim()}`),
    expiresAtMs: nowMs + 5 * 60 * 1000, // 5 minutes
    attempts: 0,
    maxAttempts: 5,
    resendAvailableAtMs: nowMs + 60 * 1000, // 60 seconds cooldown
    verified: false,
  };
}

export function verifyOtpChallenge(
  challenge: OtpChallenge,
  submittedOtp: string,
  nowMs: number = Date.now()
): { ok: boolean; error?: string; updated: OtpChallenge } {
  if (challenge.verified) {
    return { ok: true, updated: challenge };
  }
  if (nowMs > challenge.expiresAtMs) {
    return {
      ok: false,
      error: 'OTP has expired. Please request a new 6-digit OTP.',
      updated: challenge,
    };
  }
  if (challenge.attempts >= challenge.maxAttempts) {
    return {
      ok: false,
      error: 'Maximum verification attempts (5) exceeded. Request a new OTP.',
      updated: challenge,
    };
  }

  const nextAttempts = challenge.attempts + 1;
  const expectedHash = hashOtp(
    submittedOtp.trim(),
    `${challenge.channel}:${challenge.recipient}`
  );

  if (expectedHash !== challenge.codeHash) {
    return {
      ok: false,
      error: `Invalid OTP. ${challenge.maxAttempts - nextAttempts} attempt(s) remaining.`,
      updated: { ...challenge, attempts: nextAttempts },
    };
  }

  return {
    ok: true,
    updated: { ...challenge, attempts: nextAttempts, verified: true },
  };
}

export function validateUploadFile(
  fileName: string,
  mimeType: string,
  sizeBytes: number,
  isPhoto: boolean
): { ok: boolean; error?: string; storedFilename?: string } {
  const lower = fileName.toLowerCase();
  if (/\.(php|phtml|exe|sh|bat|js|html|svg)$/.test(lower)) {
    return { ok: false, error: 'Executable or script files are strictly prohibited.' };
  }
  if (!(ALLOWED_DOCUMENT_MIMES as readonly string[]).includes(mimeType)) {
    return { ok: false, error: 'Only PDF, JPG, JPEG, and PNG files are allowed.' };
  }
  const limit = isPhoto ? MAX_PHOTO_BYTES : MAX_DOCUMENT_BYTES;
  if (sizeBytes <= 0 || sizeBytes > limit) {
    return {
      ok: false,
      error: `File size must be under ${isPhoto ? '2 MB' : '5 MB'}.`,
    };
  }

  const ext = mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : 'jpg';
  const rand = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  return { ok: true, storedFilename: `doc_${rand}.${ext}` };
}

export function validateApplicationStep(
  step: number,
  draft: ApplicationFormDraft
): string[] {
  const errors: string[] = [];

  if (step === 1) {
    if (!draft.fullName.trim()) errors.push('Full Name is required.');
    if (!draft.dateOfBirth) errors.push('Date of Birth is required.');
    if (!draft.nationality.trim()) errors.push('Nationality is required.');
  }

  if (step === 2) {
    if (!/^[6-9]\d{9}$/.test(draft.mobileNumber.trim())) {
      errors.push('Enter a valid 10-digit Indian mobile number.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.emailAddress.trim())) {
      errors.push('Enter a valid email address.');
    }
    if (!draft.permanentAddress.trim()) errors.push('Permanent Address is required.');
    if (!draft.district.trim()) errors.push('District is required.');
    if (!draft.state.trim()) errors.push('State is required.');
    if (!/^\d{6}$/.test(draft.pinCode.trim())) {
      errors.push('Enter a valid 6-digit PIN Code.');
    }
  }

  if (step === 3) {
    if (!draft.tenthBoard.trim()) errors.push('10th Board is required.');
    if (!/^\d{4}$/.test(draft.tenthPassingYear.trim())) errors.push('10th Passing Year must be 4 digits.');
    if (!draft.tenthRollNumber.trim()) errors.push('10th Roll Number is required.');
    if (!draft.tenthMarksObtained || !draft.tenthTotalMarks) {
      errors.push('10th Marks Obtained and Total Marks are required.');
    }
    if (!draft.twelfthBoard.trim()) errors.push('12th Board is required.');
    if (!/^\d{4}$/.test(draft.twelfthPassingYear.trim())) errors.push('12th Passing Year must be 4 digits.');
    if (!draft.twelfthRollNumber.trim()) errors.push('12th Roll Number is required.');
    if (!draft.twelfthMarksObtained || !draft.twelfthTotalMarks) {
      errors.push('12th Marks Obtained and Total Marks are required.');
    }
    if (!draft.highestQualification.trim()) errors.push('Highest Qualification is required.');
  }

  if (step === 4) {
    if (!draft.jobId) errors.push('Please select a published Position Applied For.');
    if (!draft.preferredLocation.trim()) errors.push('Preferred Work Location is required.');
  }

  if (step === 5) {
    const hasResume = draft.documents.some((d) => d.type === 'resume');
    const hasPhoto = draft.documents.some((d) => d.type === 'photograph');
    if (!hasPhoto) errors.push('Candidate Photograph is required.');
    if (!hasResume) errors.push('Resume / CV is required.');
  }

  if (step === 6) {
    if (!draft.mobileVerified) errors.push('Mobile OTP verification is mandatory.');
    if (!draft.emailVerified) errors.push('Email OTP verification is mandatory.');
  }

  if (step === 7) {
    if (!draft.declarationAccepted) errors.push('You must accept the candidate declaration.');
    if (!draft.privacyConsentAccepted) errors.push('You must accept the Privacy Policy consent.');
  }

  return errors;
}

export function transitionApplicationStatus(
  app: SubmittedApplication,
  newStatus: ApplicationStatus,
  adminName: string,
  remarks: string,
  timestamp: string
): SubmittedApplication {
  return {
    ...app,
    status: newStatus,
    internalRemarks: remarks || app.internalRemarks,
    statusHistory: [
      ...app.statusHistory,
      {
        id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        previousStatus: app.status,
        newStatus,
        changedBy: adminName,
        remarks: remarks.trim() || `Status updated to ${newStatus}`,
        timestamp,
      },
    ],
  };
}

export function exportApplicationsToCsv(apps: SubmittedApplication[]): string {
  const headers = [
    'Application Number',
    'Candidate Name',
    'Mobile',
    'Email',
    'Position',
    'Location',
    'Experience',
    'Status',
    'Submitted Date',
  ];
  const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const rows = apps.map((a) =>
    [
      a.applicationNumber,
      a.fullName,
      a.mobileNumber,
      a.emailAddress,
      a.jobTitle,
      a.preferredLocation,
      a.experienceLevel,
      a.status,
      `${a.submittedDate} ${a.submittedTime}`,
    ]
      .map(escapeCsv)
      .join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}
