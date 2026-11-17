import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Calendar,
  CreditCard,
  Download,
  FileCheck,
  LayoutDashboard,
  Lock,
  LogOut,
  PlusCircle,
  Receipt,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type {
  ApplicationStatus,
  DirectorProfile,
  EmploymentType,
  InterviewRecord,
  JobStatus,
  JobVacancy,
  PaymentProvider,
  PaymentSettings,
  PaymentTransaction,
  SubmittedApplication,
  WebsiteSettings,
} from '../types/recruitment';
import { exportApplicationsToCsv } from '../utils/recruitmentLogic';
import {
  calculatePaymentKpis,
  exportPaymentsToCsv,
  formatPaiseToInr,
} from '../utils/paymentLogic';
import { PaymentReceiptView } from './PaymentReceiptView';

const STATUSES: ApplicationStatus[] = [
  'Submitted',
  'Under Review',
  'Shortlisted',
  'Interview Scheduled',
  'Selected',
  'Rejected',
  'On Hold',
];

export type AdminSection =
  | 'dashboard'
  | 'jobs'
  | 'add-job'
  | 'applications'
  | 'interviews'
  | 'payments'
  | 'payment-settings'
  | 'directors'
  | 'settings';

interface AdminPanelProps {
  isAuthenticated: boolean;
  initialSection?: AdminSection;
  onLogin: (email: string) => void;
  onLogout: () => void;
  jobs: JobVacancy[];
  onAddJob: (job: Omit<JobVacancy, 'id' | 'createdAt'>) => void;
  onUpdateJobStatus: (id: number, status: JobStatus) => void;
  applications: SubmittedApplication[];
  onUpdateAppStatus: (id: number, status: ApplicationStatus, remarks: string) => void;
  interviews: InterviewRecord[];
  onScheduleInterview: (record: Omit<InterviewRecord, 'id'>) => void;
  onUpdateInterviewStatus: (id: string, status: InterviewRecord['status']) => void;
  paymentTransactions: PaymentTransaction[];
  onInitiateRefund: (
    txId: string,
    reason: string
  ) => { ok: boolean; error?: string };
  directors: DirectorProfile[];
  settings: WebsiteSettings;
  onUpdateSettings: (next: WebsiteSettings) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isAuthenticated,
  initialSection = 'dashboard',
  onLogin,
  onLogout,
  jobs,
  onAddJob,
  onUpdateJobStatus,
  applications,
  onUpdateAppStatus,
  interviews,
  onScheduleInterview,
  onUpdateInterviewStatus,
  paymentTransactions,
  onInitiateRefund,
  directors,
  settings,
  onUpdateSettings,
}) => {
  const [loginEmail, setLoginEmail] = useState('admin@indraagr.local');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [section, setSection] = useState<AdminSection>(initialSection);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);
  const [newStatus, setNewStatus] = useState<ApplicationStatus>('Under Review');
  const [statusRemarks, setStatusRemarks] = useState('');

  // Add Job form
  const [jobTitle, setJobTitle] = useState('');
  const [jobDept, setJobDept] = useState('Procurement & Operations');
  const [jobLoc, setJobLoc] = useState('');
  const [jobType, setJobType] = useState<EmploymentType>('Full-Time');
  const [jobExp, setJobExp] = useState('1–2 Years');
  const [jobQual, setJobQual] = useState('Graduate');
  const [jobSalary, setJobSalary] = useState('As per company policy');
  const [jobDeadline, setJobDeadline] = useState('2026-12-31');
  const [jobDesc, setJobDesc] = useState('');
  const [jobResp, setJobResp] = useState('');
  const [jobPublishNow, setJobPublishNow] = useState(true);

  // Schedule Interview form
  const [intAppNo, setIntAppNo] = useState('');
  const [intDate, setIntDate] = useState('2026-11-28');
  const [intTime, setIntTime] = useState('11:00');
  const [intMode, setIntMode] = useState<'Online' | 'Offline'>('Online');
  const [intLocation, setIntLocation] = useState('');
  const [intNotes, setIntNotes] = useState('');

  // Payment Management state
  const [paySearch, setPaySearch] = useState('');
  const [payStatusFilter, setPayStatusFilter] = useState('All');
  const [selectedReceiptTx, setSelectedReceiptTx] = useState<PaymentTransaction | null>(null);
  const [refundTargetTx, setRefundTargetTx] = useState<PaymentTransaction | null>(null);
  const [refundReason, setRefundReason] = useState('Authorized duplicate/administrative refund');
  const [refundNotice, setRefundNotice] = useState('');

  // Settings & Payment Settings drafts (secrets remain write-only masked inputs)
  const [settingsDraft, setSettingsDraft] = useState<WebsiteSettings>(settings);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [payDraft, setPayDraft] = useState<PaymentSettings>(settings.paymentSettings);
  const [feeInrInput, setFeeInrInput] = useState<string>(
    (settings.paymentSettings.applicationFeePaise / 100).toFixed(2)
  );
  const [secretRotateInput, setSecretRotateInput] = useState('');
  const [webhookRotateInput, setWebhookRotateInput] = useState('');
  const [paySavedMsg, setPaySavedMsg] = useState('');

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    setSettingsDraft(settings);
    setPayDraft(settings.paymentSettings);
    setFeeInrInput((settings.paymentSettings.applicationFeePaise / 100).toFixed(2));
  }, [settings]);

  const filteredApps = useMemo(() => {
    if (statusFilter === 'All') return applications;
    return applications.filter((a) => a.status === statusFilter);
  }, [applications, statusFilter]);

  const filteredPayments = useMemo(() => {
    const q = paySearch.trim().toLowerCase();
    return paymentTransactions.filter((t) => {
      const matchQ =
        !q ||
        (t.gatewayPaymentId ?? '').toLowerCase().includes(q) ||
        t.paymentOrderId.toLowerCase().includes(q) ||
        (t.applicationNumber ?? '').toLowerCase().includes(q) ||
        t.candidateName.toLowerCase().includes(q) ||
        (t.receiptNumber ?? '').toLowerCase().includes(q);
      const matchSt = payStatusFilter === 'All' || t.paymentStatus === payStatusFilter;
      return matchQ && matchSt;
    });
  }, [paymentTransactions, paySearch, payStatusFilter]);

  const paymentKpis = useMemo(
    () => calculatePaymentKpis(paymentTransactions),
    [paymentTransactions]
  );

  const selectedApp = applications.find((a) => a.id === selectedAppId) ?? null;

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-20">
        <div className="p-8 bg-white rounded-lg border border-[#174D32]/15 space-y-6">
          <div className="space-y-1">
            <p className="text-xs font-semibold tracking-wider text-[#174D32]">
              Super Admin Access
            </p>
            <h1 className="font-serif-display text-3xl font-bold text-[#1B2B22]">
              Admin Portal Login
            </h1>
            <p className="text-xs text-[#1B2B22]/70">
              Restricted to authorized INDRA AGR TRADING PVT. LTD. Super Admin.
            </p>
          </div>

          {loginError && (
            <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 p-3 rounded-md">
              {loginError}
            </p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!loginEmail.includes('@') || loginPassword.length < 6) {
                setLoginError('Enter a valid admin email and password (minimum 6 characters).');
                return;
              }
              setLoginError('');
              onLogin(loginEmail);
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="admin-email" className="block text-sm font-medium mb-1">
                Admin Email
              </label>
              <input
                id="admin-email"
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-[#174D32]/25 rounded-md"
              />
            </div>
            <div>
              <label htmlFor="admin-pass" className="block text-sm font-medium mb-1">
                Password
              </label>
              <input
                id="admin-pass"
                type="password"
                required
                placeholder="Enter Super Admin password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-[#174D32]/25 rounded-md"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 text-sm font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md"
            >
              Sign In to Admin Panel
            </button>
          </form>
        </div>
      </div>
    );
  }

  const handleDownloadCsv = () => {
    const csv = exportApplicationsToCsv(filteredApps);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `indra-agr-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPaymentsCsv = () => {
    const csv = exportPaymentsToCsv(filteredPayments);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `indra-agr-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const kpis = [
    { label: 'Total Applications', value: applications.length },
    { label: 'New / Submitted', value: applications.filter((a) => a.status === 'Submitted').length },
    { label: 'Shortlisted', value: applications.filter((a) => a.status === 'Shortlisted').length },
    {
      label: 'Interviews Scheduled',
      value: applications.filter((a) => a.status === 'Interview Scheduled').length,
    },
    { label: 'Verified Payments', value: paymentKpis.totalSuccessful },
    {
      label: 'Fee Collected (INR)',
      value: formatPaiseToInr(paymentKpis.totalCollectedPaise),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar */}
        <aside className="no-print lg:col-span-3 bg-[#103B27] text-white rounded-lg p-5 space-y-6 h-fit">
          <div className="border-b border-white/15 pb-4">
            <p className="text-xs text-[#C7A65A] font-semibold">Super Admin Panel</p>
            <h2 className="font-serif-display text-xl font-bold mt-0.5">
              INDRA AGR TRADING
            </h2>
          </div>

          <nav aria-label="Admin Navigation" className="space-y-1">
            {(
              [
                ['dashboard', 'Dashboard', LayoutDashboard],
                ['jobs', 'Job Management', Briefcase],
                ['add-job', 'Add Job Vacancy', PlusCircle],
                ['applications', 'Applications & Docs', FileCheck],
                ['payments', 'Payment Management', Receipt],
                ['payment-settings', 'Payment Settings', CreditCard],
                ['interviews', 'Interview Management', Calendar],
                ['directors', 'Directors Management', Users],
                ['settings', 'Email, SMS & Settings', Settings],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSection(key)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md text-sm font-medium transition-colors text-left ${
                  section === key
                    ? 'bg-[#C7A65A] text-[#103B27] font-semibold'
                    : 'text-white/80 hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <div className="pt-4 border-t border-white/15">
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-md"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* Main Workspace */}
        <div className="lg:col-span-9 space-y-6">
          {section === 'dashboard' && (
            <div className="space-y-6">
              <h1 className="font-serif-display text-3xl font-bold text-[#1B2B22]">
                Recruitment Dashboard
              </h1>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {kpis.map((k) => (
                  <div
                    key={k.label}
                    className="p-5 bg-white rounded-lg border border-[#174D32]/12"
                  >
                    <p className="text-xs text-[#1B2B22]/65">{k.label}</p>
                    <p className="font-mono-data text-3xl font-bold text-[#174D32] mt-1">
                      {k.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="p-6 bg-white rounded-lg border border-[#174D32]/12 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-serif-display text-2xl font-bold text-[#1B2B22]">
                    Recent Applications
                  </h2>
                  <button
                    type="button"
                    onClick={() => setSection('applications')}
                    className="text-xs font-semibold text-[#174D32] hover:underline"
                  >
                    Manage all
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#174D32]/12 text-xs text-[#1B2B22]/65">
                        <th className="py-2.5 pr-4">Application No.</th>
                        <th className="py-2.5 pr-4">Candidate</th>
                        <th className="py-2.5 pr-4">Position</th>
                        <th className="py-2.5 pr-4">Status</th>
                        <th className="py-2.5">Submitted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#174D32]/10">
                      {applications.slice(0, 6).map((a) => (
                        <tr key={a.id}>
                          <td className="py-3 pr-4 font-mono-data text-xs font-semibold text-[#174D32]">
                            {a.applicationNumber}
                          </td>
                          <td className="py-3 pr-4 font-medium">{a.fullName}</td>
                          <td className="py-3 pr-4 text-xs">{a.jobTitle}</td>
                          <td className="py-3 pr-4 text-xs font-semibold">{a.status}</td>
                          <td className="py-3 font-mono-data text-xs text-[#1B2B22]/70">
                            {a.submittedDate}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {section === 'jobs' && (
            <div className="p-6 bg-white rounded-lg border border-[#174D32]/12 space-y-5">
              <div className="flex items-center justify-between gap-4">
                <h1 className="font-serif-display text-3xl font-bold text-[#1B2B22]">
                  Job Vacancies
                </h1>
                <button
                  type="button"
                  onClick={() => setSection('add-job')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#174D32] rounded-md"
                >
                  Add New Job
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#174D32]/12 text-xs text-[#1B2B22]/65">
                      <th className="py-2.5 pr-4">Title</th>
                      <th className="py-2.5 pr-4">Location</th>
                      <th className="py-2.5 pr-4">Deadline</th>
                      <th className="py-2.5 pr-4">Status</th>
                      <th className="py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#174D32]/10">
                    {jobs.map((j) => (
                      <tr key={j.id}>
                        <td className="py-3 pr-4 font-medium">{j.title}</td>
                        <td className="py-3 pr-4 text-xs">{j.location}</td>
                        <td className="py-3 pr-4 font-mono-data text-xs">
                          {j.applicationDeadline}
                        </td>
                        <td className="py-3 pr-4 text-xs font-semibold capitalize">{j.status}</td>
                        <td className="py-3">
                          <select
                            aria-label={`Change status for ${j.title}`}
                            value={j.status}
                            onChange={(e) =>
                              onUpdateJobStatus(j.id, e.target.value as JobStatus)
                            }
                            className="text-xs border border-[#174D32]/25 rounded px-2 py-1 bg-white"
                          >
                            <option value="draft">Draft</option>
                            <option value="published">Published</option>
                            <option value="closed">Closed</option>
                            <option value="archived">Archived</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {section === 'add-job' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!jobTitle.trim() || !jobLoc.trim() || !jobDesc.trim()) return;
                onAddJob({
                  title: jobTitle.trim(),
                  slug: jobTitle
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-'),
                  department: jobDept.trim(),
                  location: jobLoc.trim(),
                  employmentType: jobType,
                  experienceRequired: jobExp.trim(),
                  qualifications: jobQual.trim(),
                  salaryRange: jobSalary.trim(),
                  description: jobDesc.trim(),
                  responsibilities: jobResp
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
                  applicationDeadline: jobDeadline,
                  status: jobPublishNow ? 'published' : 'draft',
                });
                setJobTitle('');
                setJobLoc('');
                setJobDesc('');
                setJobResp('');
                setSection('jobs');
              }}
              className="p-6 bg-white rounded-lg border border-[#174D32]/12 space-y-5"
            >
              <h1 className="font-serif-display text-3xl font-bold text-[#1B2B22]">
                Add New Job Vacancy
              </h1>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  required
                  placeholder="Job Title *"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="px-3.5 py-2.5 text-sm border border-[#174D32]/25 rounded-md"
                />
                <input
                  required
                  placeholder="Department *"
                  value={jobDept}
                  onChange={(e) => setJobDept(e.target.value)}
                  className="px-3.5 py-2.5 text-sm border border-[#174D32]/25 rounded-md"
                />
                <input
                  required
                  placeholder="Job Location *"
                  value={jobLoc}
                  onChange={(e) => setJobLoc(e.target.value)}
                  className="px-3.5 py-2.5 text-sm border border-[#174D32]/25 rounded-md"
                />
                <select
                  value={jobType}
                  onChange={(e) => setJobType(e.target.value as EmploymentType)}
                  className="px-3.5 py-2.5 text-sm border border-[#174D32]/25 rounded-md bg-white"
                >
                  <option value="Full-Time">Full-Time</option>
                  <option value="Part-Time">Part-Time</option>
                  <option value="Contract">Contract</option>
                  <option value="Internship">Internship</option>
                  <option value="Field Operations">Field Operations</option>
                </select>
                <input
                  placeholder="Experience Required"
                  value={jobExp}
                  onChange={(e) => setJobExp(e.target.value)}
                  className="px-3.5 py-2.5 text-sm border border-[#174D32]/25 rounded-md"
                />
                <input
                  placeholder="Qualifications"
                  value={jobQual}
                  onChange={(e) => setJobQual(e.target.value)}
                  className="px-3.5 py-2.5 text-sm border border-[#174D32]/25 rounded-md"
                />
                <input
                  placeholder="Salary Range"
                  value={jobSalary}
                  onChange={(e) => setJobSalary(e.target.value)}
                  className="px-3.5 py-2.5 text-sm border border-[#174D32]/25 rounded-md"
                />
                <input
                  type="date"
                  value={jobDeadline}
                  onChange={(e) => setJobDeadline(e.target.value)}
                  className="px-3.5 py-2.5 text-sm border border-[#174D32]/25 rounded-md"
                />
              </div>
              <textarea
                required
                rows={3}
                placeholder="Job Description *"
                value={jobDesc}
                onChange={(e) => setJobDesc(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-[#174D32]/25 rounded-md"
              />
              <textarea
                rows={3}
                placeholder="Responsibilities (one per line)"
                value={jobResp}
                onChange={(e) => setJobResp(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-[#174D32]/25 rounded-md"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={jobPublishNow}
                  onChange={(e) => setJobPublishNow(e.target.checked)}
                  className="accent-[#174D32]"
                />
                <span>Publish immediately on Careers page</span>
              </label>
              <button
                type="submit"
                className="px-6 py-2.5 text-sm font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md"
              >
                Save Vacancy
              </button>
            </form>
          )}

          {section === 'applications' && (
            <div className="space-y-6">
              <div className="p-6 bg-white rounded-lg border border-[#174D32]/12 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <h1 className="font-serif-display text-3xl font-bold text-[#1B2B22]">
                    Applications Management
                  </h1>
                  <div className="flex items-center gap-3">
                    <select
                      aria-label="Filter applications by status"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="text-xs border border-[#174D32]/25 rounded-md px-3 py-2 bg-white"
                    >
                      <option value="All">All Statuses</option>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleDownloadCsv}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#174D32] border border-[#174D32]/30 rounded-md hover:bg-[#F6F4EC]"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export CSV
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#174D32]/12 text-xs text-[#1B2B22]/65">
                        <th className="py-2.5 pr-4">App No.</th>
                        <th className="py-2.5 pr-4">Candidate</th>
                        <th className="py-2.5 pr-4">Position</th>
                        <th className="py-2.5 pr-4">Status</th>
                        <th className="py-2.5">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#174D32]/10">
                      {filteredApps.map((a) => (
                        <tr key={a.id}>
                          <td className="py-3 pr-4 font-mono-data text-xs font-semibold text-[#174D32]">
                            {a.applicationNumber}
                          </td>
                          <td className="py-3 pr-4 font-medium">{a.fullName}</td>
                          <td className="py-3 pr-4 text-xs">{a.jobTitle}</td>
                          <td className="py-3 pr-4 text-xs font-semibold">{a.status}</td>
                          <td className="py-3">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAppId(a.id);
                                setNewStatus(a.status);
                                setStatusRemarks('');
                              }}
                              className="text-xs font-semibold text-[#174D32] hover:underline"
                            >
                              Review / Update
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedApp && (
                <div className="p-6 bg-white rounded-lg border border-[#174D32]/20 space-y-5">
                  <div className="flex items-center justify-between border-b border-[#174D32]/10 pb-3">
                    <div>
                      <h2 className="font-serif-display text-2xl font-bold text-[#1B2B22]">
                        {selectedApp.fullName} ({selectedApp.applicationNumber})
                      </h2>
                      <p className="text-xs text-[#1B2B22]/70">
                        {selectedApp.jobTitle} · {selectedApp.mobileNumber} ·{' '}
                        {selectedApp.emailAddress}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedAppId(null)}
                      className="text-xs text-[#1B2B22]/60 hover:text-[#1B2B22]"
                    >
                      Close
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-[#F6F4EC] p-4 rounded-md">
                    <p>
                      <strong>Highest Qualification:</strong> {selectedApp.highestQualification}
                    </p>
                    <p>
                      <strong>Experience:</strong> {selectedApp.experienceLevel}
                    </p>
                    <p>
                      <strong>10th Marks:</strong> {selectedApp.tenthMarksObtained}/
                      {selectedApp.tenthTotalMarks} ({selectedApp.tenthBoard})
                    </p>
                    <p>
                      <strong>12th Marks:</strong> {selectedApp.twelfthMarksObtained}/
                      {selectedApp.twelfthTotalMarks} ({selectedApp.twelfthBoard})
                    </p>
                    {selectedApp.receiptNumber && (
                      <p className="sm:col-span-2 font-mono-data">
                        <strong>Verified Payment Receipt:</strong> {selectedApp.receiptNumber} ·{' '}
                        Fee: INR {formatPaiseToInr(selectedApp.feeAmountPaise ?? 0)}
                      </p>
                    )}
                    <p className="sm:col-span-2">
                      <strong>Private Stored Documents:</strong>{' '}
                      {selectedApp.documents.map((d) => `${d.label} (${d.storedFilename})`).join(', ')}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block text-xs font-medium mb-1">Update Status</label>
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value as ApplicationStatus)}
                        className="w-full px-3 py-2 text-sm border border-[#174D32]/25 rounded-md bg-white"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Internal Remarks</label>
                      <input
                        value={statusRemarks}
                        onChange={(e) => setStatusRemarks(e.target.value)}
                        placeholder="Optional status remarks"
                        className="w-full px-3 py-2 text-sm border border-[#174D32]/25 rounded-md"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateAppStatus(selectedApp.id, newStatus, statusRemarks);
                        setStatusRemarks('');
                      }}
                      className="px-4 py-2 text-sm font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md"
                    >
                      Save Status Update
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {section === 'interviews' && (
            <div className="space-y-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const app = applications.find((a) => a.applicationNumber === intAppNo);
                  if (!app || !intLocation.trim()) return;
                  onScheduleInterview({
                    applicationNumber: app.applicationNumber,
                    candidateName: app.fullName,
                    jobTitle: app.jobTitle,
                    interviewDate: intDate,
                    interviewTime: intTime,
                    mode: intMode,
                    locationOrLink: intLocation.trim(),
                    instructions: intNotes.trim(),
                    status: 'Scheduled',
                  });
                  setIntLocation('');
                  setIntNotes('');
                }}
                className="p-6 bg-white rounded-lg border border-[#174D32]/12 space-y-4"
              >
                <h1 className="font-serif-display text-3xl font-bold text-[#1B2B22]">
                  Schedule Interview
                </h1>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <select
                    required
                    value={intAppNo}
                    onChange={(e) => setIntAppNo(e.target.value)}
                    className="px-3.5 py-2.5 text-sm border border-[#174D32]/25 rounded-md bg-white"
                  >
                    <option value="">Select Candidate Application *</option>
                    {applications.map((a) => (
                      <option key={a.id} value={a.applicationNumber}>
                        {a.applicationNumber} — {a.fullName}
                      </option>
                    ))}
                  </select>
                  <select
                    value={intMode}
                    onChange={(e) => setIntMode(e.target.value as 'Online' | 'Offline')}
                    className="px-3.5 py-2.5 text-sm border border-[#174D32]/25 rounded-md bg-white"
                  >
                    <option value="Online">Online</option>
                    <option value="Offline">Offline</option>
                  </select>
                  <input
                    type="date"
                    required
                    value={intDate}
                    onChange={(e) => setIntDate(e.target.value)}
                    className="px-3.5 py-2.5 text-sm border border-[#174D32]/25 rounded-md"
                  />
                  <input
                    type="time"
                    required
                    value={intTime}
                    onChange={(e) => setIntTime(e.target.value)}
                    className="px-3.5 py-2.5 text-sm border border-[#174D32]/25 rounded-md"
                  />
                  <input
                    required
                    placeholder="Meeting Link or Office Location *"
                    value={intLocation}
                    onChange={(e) => setIntLocation(e.target.value)}
                    className="sm:col-span-2 px-3.5 py-2.5 text-sm border border-[#174D32]/25 rounded-md"
                  />
                  <input
                    placeholder="Interview Instructions (optional)"
                    value={intNotes}
                    onChange={(e) => setIntNotes(e.target.value)}
                    className="sm:col-span-2 px-3.5 py-2.5 text-sm border border-[#174D32]/25 rounded-md"
                  />
                </div>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-sm font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md"
                >
                  Schedule Interview
                </button>
              </form>

              <div className="p-6 bg-white rounded-lg border border-[#174D32]/12 space-y-4">
                <h2 className="font-serif-display text-2xl font-bold text-[#1B2B22]">
                  Scheduled Interviews
                </h2>
                <div className="space-y-3">
                  {interviews.map((i) => (
                    <div
                      key={i.id}
                      className="p-4 rounded-md bg-[#F6F4EC] border border-[#174D32]/12 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-[#1B2B22]">
                          {i.candidateName} ({i.applicationNumber}) — {i.jobTitle}
                        </p>
                        <p className="text-xs font-mono-data text-[#1B2B22]/75">
                          {i.interviewDate} at {i.interviewTime} IST · {i.mode} · {i.locationOrLink}
                        </p>
                      </div>
                      <select
                        value={i.status}
                        onChange={(e) =>
                          onUpdateInterviewStatus(
                            i.id,
                            e.target.value as InterviewRecord['status']
                          )
                        }
                        className="text-xs border border-[#174D32]/25 rounded px-2.5 py-1.5 bg-white"
                      >
                        <option value="Scheduled">Scheduled</option>
                        <option value="Rescheduled">Rescheduled</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {section === 'payments' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-serif-display text-3xl font-bold text-[#1B2B22]">
                    Payment Management
                  </h1>
                  <p className="text-xs text-[#1B2B22]/70 mt-1">
                    Totals reflect server-verified successful transactions only. Unverified or
                    failed records cannot be forced to success.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadPaymentsCsv}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#174D32] bg-white border border-[#174D32]/30 rounded-md hover:bg-[#F6F4EC]"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Payments CSV
                </button>
              </div>

              {/* 4 KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 bg-white rounded-lg border border-[#174D32]/12">
                  <p className="text-xs text-[#1B2B22]/65">Total Successful Payments</p>
                  <p className="font-mono-data text-3xl font-bold text-[#174D32] mt-1">
                    {paymentKpis.totalSuccessful}
                  </p>
                </div>
                <div className="p-5 bg-white rounded-lg border border-[#174D32]/12">
                  <p className="text-xs text-[#1B2B22]/65">Total Pending Payments</p>
                  <p className="font-mono-data text-3xl font-bold text-amber-700 mt-1">
                    {paymentKpis.totalPending}
                  </p>
                </div>
                <div className="p-5 bg-white rounded-lg border border-[#174D32]/12">
                  <p className="text-xs text-[#1B2B22]/65">Total Failed Payments</p>
                  <p className="font-mono-data text-3xl font-bold text-red-700 mt-1">
                    {paymentKpis.totalFailed}
                  </p>
                </div>
                <div className="p-5 bg-white rounded-lg border border-[#174D32]/12">
                  <p className="text-xs text-[#1B2B22]/65">Total Collected (Verified INR)</p>
                  <p className="font-mono-data text-2xl font-bold text-[#174D32] mt-1">
                    INR {formatPaiseToInr(paymentKpis.totalCollectedPaise)}
                  </p>
                </div>
              </div>

              {refundNotice && (
                <div
                  role="status"
                  className="p-3.5 rounded-md bg-[#F6F4EC] border border-[#174D32]/25 text-xs text-[#174D32] font-medium"
                >
                  {refundNotice}
                </div>
              )}

              {/* Search & Filter */}
              <div className="p-6 bg-white rounded-lg border border-[#174D32]/12 space-y-5">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-[#1B2B22]/45 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      aria-label="Search payment transactions"
                      placeholder="Search by Payment ID, Order ID, Application No, or Candidate..."
                      value={paySearch}
                      onChange={(e) => setPaySearch(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2 text-sm border border-[#174D32]/25 rounded-md"
                    />
                  </div>
                  <select
                    aria-label="Filter payments by status"
                    value={payStatusFilter}
                    onChange={(e) => setPayStatusFilter(e.target.value)}
                    className="px-3.5 py-2 text-sm border border-[#174D32]/25 rounded-md bg-white"
                  >
                    <option value="All">All Statuses</option>
                    <option value="success">Success</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>

                {filteredPayments.length === 0 ? (
                  <div className="p-8 text-center bg-[#F6F4EC] rounded-md text-sm text-[#1B2B22]/70">
                    No payment transactions match your current filter. Transactions appear here
                    once candidates initiate UPI checkout orders.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#174D32]/12 text-[#1B2B22]/65">
                          <th className="py-2.5 pr-3">Receipt / App No</th>
                          <th className="py-2.5 pr-3">Candidate</th>
                          <th className="py-2.5 pr-3">Order &amp; Payment ID</th>
                          <th className="py-2.5 pr-3">Amount</th>
                          <th className="py-2.5 pr-3">Status</th>
                          <th className="py-2.5 pr-3">Refund</th>
                          <th className="py-2.5">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#174D32]/10">
                        {filteredPayments.map((t) => (
                          <tr key={t.id}>
                            <td className="py-3 pr-3 font-mono-data">
                              <div className="font-semibold text-[#174D32]">
                                {t.receiptNumber ?? '—'}
                              </div>
                              <div className="text-[#1B2B22]/70">
                                {t.applicationNumber ?? 'Not Submitted'}
                              </div>
                            </td>
                            <td className="py-3 pr-3">
                              <div className="font-semibold">{t.candidateName}</div>
                              <div className="text-[#1B2B22]/65">{t.jobTitle}</div>
                            </td>
                            <td className="py-3 pr-3 font-mono-data">
                              <div>Ord: {t.paymentOrderId}</div>
                              <div className="text-[#1B2B22]/75">
                                Pay: {t.gatewayPaymentId ?? '—'}
                              </div>
                              {t.transactionReference && (
                                <div className="text-[#174D32]">
                                  UTR: {t.transactionReference}
                                </div>
                              )}
                            </td>
                            <td className="py-3 pr-3 font-mono-data font-semibold whitespace-nowrap">
                              {t.currency} {formatPaiseToInr(t.amount)}
                            </td>
                            <td className="py-3 pr-3">
                              <span
                                className={`font-mono-data font-bold uppercase ${
                                  t.paymentStatus === 'success'
                                    ? 'text-[#174D32]'
                                    : t.paymentStatus === 'pending' ||
                                      t.paymentStatus === 'created'
                                    ? 'text-amber-700'
                                    : 'text-red-700'
                                }`}
                              >
                                {t.paymentStatus}
                              </span>
                              {t.paidAtDate && (
                                <div className="font-mono-data text-[11px] text-[#1B2B22]/60">
                                  {t.paidAtDate} {t.paidAtTime}
                                </div>
                              )}
                            </td>
                            <td className="py-3 pr-3">
                              <div className="font-medium">{t.refundStatus}</div>
                              {t.refundId && (
                                <div className="font-mono-data text-[11px] text-[#1B2B22]/60">
                                  {t.refundId}
                                </div>
                              )}
                            </td>
                            <td className="py-3 space-y-1.5">
                              {t.receiptNumber && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedReceiptTx(t)}
                                  className="block text-[#174D32] font-semibold hover:underline"
                                >
                                  View / Print Receipt
                                </button>
                              )}
                              {t.paymentStatus === 'success' && t.gatewayPaymentId && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRefundTargetTx(t);
                                    setRefundNotice('');
                                  }}
                                  className="inline-flex items-center gap-1 text-red-700 font-semibold hover:underline"
                                >
                                  <RotateCcw className="w-3 h-3" /> Issue Refund
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {refundTargetTx && (
                <div className="p-6 bg-white rounded-lg border border-red-300 space-y-4">
                  <h2 className="font-serif-display text-xl font-bold text-red-900">
                    Initiate Official Gateway Refund ({refundTargetTx.gatewayProvider.toUpperCase()})
                  </h2>
                  <p className="text-xs text-[#1B2B22]/80">
                    Transaction: <span className="font-mono-data">{refundTargetTx.gatewayPaymentId}</span>{' '}
                    · Candidate: <strong>{refundTargetTx.candidateName}</strong> · Amount:{' '}
                    <span className="font-mono-data font-bold">
                      INR {formatPaiseToInr(refundTargetTx.amount)}
                    </span>
                  </p>
                  <div>
                    <label htmlFor="refund-reason-input" className="block text-xs font-semibold mb-1">
                      Refund Reason *
                    </label>
                    <input
                      id="refund-reason-input"
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-[#174D32]/25 rounded-md"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const res = onInitiateRefund(refundTargetTx.id, refundReason);
                        setRefundNotice(
                          res.ok
                            ? `Official gateway refund processed for ${refundTargetTx.paymentOrderId}.`
                            : res.error ?? 'Refund failed.'
                        );
                        setRefundTargetTx(null);
                      }}
                      className="px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-md"
                    >
                      Confirm Gateway Refund
                    </button>
                    <button
                      type="button"
                      onClick={() => setRefundTargetTx(null)}
                      className="px-4 py-2 text-xs font-semibold text-[#1B2B22] border border-[#174D32]/25 rounded-md"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {selectedReceiptTx && (
                <PaymentReceiptView
                  transaction={selectedReceiptTx}
                  companyName={settings.companyName}
                  onClose={() => setSelectedReceiptTx(null)}
                />
              )}
            </div>
          )}

          {section === 'payment-settings' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const parsedInr = Number.parseFloat(feeInrInput);
                const feePaise =
                  Number.isFinite(parsedInr) && parsedInr >= 0
                    ? Math.round(parsedInr * 100)
                    : 0;

                const isLive = payDraft.mode === 'live';
                const nextPaySettings: PaymentSettings = {
                  ...payDraft,
                  currency: 'INR',
                  applicationFeePaise: feePaise,
                  receiptPrefix:
                    payDraft.receiptPrefix
                      .toUpperCase()
                      .replace(/[^A-Z0-9-]/g, '') || 'INDRA-REC',
                  hasTestSecretConfigured:
                    !isLive && secretRotateInput.trim().length > 0
                      ? true
                      : payDraft.hasTestSecretConfigured,
                  hasTestWebhookSecretConfigured:
                    !isLive && webhookRotateInput.trim().length > 0
                      ? true
                      : payDraft.hasTestWebhookSecretConfigured,
                  hasLiveSecretConfigured:
                    isLive && secretRotateInput.trim().length > 0
                      ? true
                      : payDraft.hasLiveSecretConfigured,
                  hasLiveWebhookSecretConfigured:
                    isLive && webhookRotateInput.trim().length > 0
                      ? true
                      : payDraft.hasLiveWebhookSecretConfigured,
                };

                onUpdateSettings({
                  ...settings,
                  paymentSettings: nextPaySettings,
                });
                // Clear sensitive inputs immediately after saving so secrets are never exposed
                setSecretRotateInput('');
                setWebhookRotateInput('');
                setPaySavedMsg(
                  `Payment settings saved (${nextPaySettings.provider.toUpperCase()}, ${nextPaySettings.mode.toUpperCase()} mode, Fee: INR ${formatPaiseToInr(feePaise)}).`
                );
              }}
              className="p-6 bg-white rounded-lg border border-[#174D32]/12 space-y-6"
            >
              <div className="space-y-1 border-b border-[#174D32]/10 pb-4">
                <h1 className="font-serif-display text-3xl font-bold text-[#1B2B22]">
                  Payment Gateway &amp; Fee Settings
                </h1>
                <p className="text-xs text-[#1B2B22]/75">
                  Configure Razorpay or Cashfree UPI integration, application fee (INR), and policy
                  copy. API secrets and webhook secrets are write-only and never displayed after
                  saving.
                </p>
              </div>

              {paySavedMsg && (
                <div
                  role="status"
                  className="p-3.5 rounded-md bg-[#F6F4EC] border border-[#174D32]/30 text-xs font-semibold text-[#174D32] flex items-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>{paySavedMsg}</span>
                </div>
              )}

              <div className="p-4 rounded-md bg-[#F6F4EC] border border-[#174D32]/15 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#1B2B22]">
                    Enable Application Fee Payment Gateway
                  </p>
                  <p className="text-xs text-[#1B2B22]/70">
                    When enabled with a fee &gt; INR 0.00, candidates must complete verified UPI
                    payment at Step 8 before final submission.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#174D32] cursor-pointer">
                  <input
                    id="pay-gateway-enabled"
                    type="checkbox"
                    checked={payDraft.gatewayEnabled}
                    onChange={(e) =>
                      setPayDraft({ ...payDraft, gatewayEnabled: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#174D32]"
                  />
                  <span>Enabled</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="pay-provider" className="block text-xs font-semibold mb-1">
                    Payment Gateway Provider
                  </label>
                  <select
                    id="pay-provider"
                    value={payDraft.provider}
                    onChange={(e) =>
                      setPayDraft({
                        ...payDraft,
                        provider: e.target.value as PaymentProvider,
                      })
                    }
                    className="w-full px-3.5 py-2 text-sm border border-[#174D32]/25 rounded-md bg-white"
                  >
                    <option value="razorpay">Razorpay (UPI QR &amp; UPI Apps)</option>
                    <option value="cashfree">Cashfree Payments (UPI QR &amp; UPI Apps)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="pay-mode" className="block text-xs font-semibold mb-1">
                    Gateway Environment Mode
                  </label>
                  <select
                    id="pay-mode"
                    value={payDraft.mode}
                    onChange={(e) =>
                      setPayDraft({
                        ...payDraft,
                        mode: e.target.value as 'test' | 'live',
                      })
                    }
                    className="w-full px-3.5 py-2 text-sm border border-[#174D32]/25 rounded-md bg-white"
                  >
                    <option value="test">Test / Sandbox Mode</option>
                    <option value="live">Live Production Mode</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="pay-fee-inr" className="block text-xs font-semibold mb-1">
                    Application Fee Amount (INR)
                  </label>
                  <input
                    id="pay-fee-inr"
                    type="number"
                    step="0.01"
                    min="0"
                    value={feeInrInput}
                    onChange={(e) => setFeeInrInput(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm font-mono-data border border-[#174D32]/25 rounded-md"
                  />
                </div>

                <div>
                  <label htmlFor="pay-currency" className="block text-xs font-semibold mb-1">
                    Payment Currency
                  </label>
                  <input
                    id="pay-currency"
                    value="INR"
                    readOnly
                    className="w-full px-3.5 py-2 text-sm font-mono-data border border-[#174D32]/25 rounded-md bg-[#F6F4EC]"
                  />
                </div>

                <div>
                  <label htmlFor="pay-key-id" className="block text-xs font-semibold mb-1">
                    {payDraft.mode === 'live' ? 'Live' : 'Test'} API Key / App ID (Public)
                  </label>
                  <input
                    id="pay-key-id"
                    value={payDraft.mode === 'live' ? payDraft.liveKeyId : payDraft.testKeyId}
                    onChange={(e) =>
                      setPayDraft(
                        payDraft.mode === 'live'
                          ? { ...payDraft, liveKeyId: e.target.value }
                          : { ...payDraft, testKeyId: e.target.value }
                      )
                    }
                    placeholder={
                      payDraft.provider === 'razorpay' ? 'rzp_test_...' : 'cf_app_id_...'
                    }
                    className="w-full px-3.5 py-2 text-sm font-mono-data border border-[#174D32]/25 rounded-md"
                  />
                </div>

                <div>
                  <label htmlFor="pay-prefix" className="block text-xs font-semibold mb-1">
                    Receipt Prefix
                  </label>
                  <input
                    id="pay-prefix"
                    value={payDraft.receiptPrefix}
                    onChange={(e) =>
                      setPayDraft({ ...payDraft, receiptPrefix: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm font-mono-data border border-[#174D32]/25 rounded-md"
                  />
                </div>

                <div>
                  <label htmlFor="pay-api-secret" className="block text-xs font-semibold mb-1">
                    API Key Secret (Write-Only, Masked)
                  </label>
                  <input
                    id="pay-api-secret"
                    type="password"
                    autoComplete="new-password"
                    value={secretRotateInput}
                    onChange={(e) => setSecretRotateInput(e.target.value)}
                    placeholder={
                      (payDraft.mode === 'live'
                        ? payDraft.hasLiveSecretConfigured
                        : payDraft.hasTestSecretConfigured)
                        ? 'Configured (hidden for security) — enter to rotate'
                        : 'Enter server API secret'
                    }
                    className="w-full px-3.5 py-2 text-sm border border-[#174D32]/25 rounded-md"
                  />
                  <p className="text-[11px] text-[#174D32] mt-1 inline-flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    {(payDraft.mode === 'live'
                      ? payDraft.hasLiveSecretConfigured
                      : payDraft.hasTestSecretConfigured)
                      ? 'Secret configured in server environment (never exposed).'
                      : 'Not configured yet.'}
                  </p>
                </div>

                <div>
                  <label htmlFor="pay-webhook-secret" className="block text-xs font-semibold mb-1">
                    Webhook Signing Secret (Write-Only, Masked)
                  </label>
                  <input
                    id="pay-webhook-secret"
                    type="password"
                    autoComplete="new-password"
                    value={webhookRotateInput}
                    onChange={(e) => setWebhookRotateInput(e.target.value)}
                    placeholder={
                      (payDraft.mode === 'live'
                        ? payDraft.hasLiveWebhookSecretConfigured
                        : payDraft.hasTestWebhookSecretConfigured)
                        ? 'Configured (hidden for security) — enter to rotate'
                        : 'Enter webhook signing secret'
                    }
                    className="w-full px-3.5 py-2 text-sm border border-[#174D32]/25 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="pay-description" className="block text-xs font-semibold mb-1">
                  Payment Description
                </label>
                <input
                  id="pay-description"
                  value={payDraft.paymentDescription}
                  onChange={(e) =>
                    setPayDraft({ ...payDraft, paymentDescription: e.target.value })
                  }
                  className="w-full px-3.5 py-2 text-sm border border-[#174D32]/25 rounded-md"
                />
              </div>

              <div>
                <label htmlFor="pay-instructions" className="block text-xs font-semibold mb-1">
                  Payment Instructions Shown Before Checkout
                </label>
                <textarea
                  id="pay-instructions"
                  rows={2}
                  value={payDraft.paymentInstructions}
                  onChange={(e) =>
                    setPayDraft({ ...payDraft, paymentInstructions: e.target.value })
                  }
                  className="w-full px-3.5 py-2 text-sm border border-[#174D32]/25 rounded-md"
                />
              </div>

              <div>
                <label htmlFor="pay-refund-policy" className="block text-xs font-semibold mb-1">
                  Refund Policy Disclosure
                </label>
                <textarea
                  id="pay-refund-policy"
                  rows={2}
                  value={payDraft.refundPolicy}
                  onChange={(e) =>
                    setPayDraft({ ...payDraft, refundPolicy: e.target.value })
                  }
                  className="w-full px-3.5 py-2 text-sm border border-[#174D32]/25 rounded-md"
                />
              </div>

              <div className="p-4 rounded-md bg-[#F6F4EC] border border-[#C7A65A]/70 text-xs text-[#1B2B22]/85 space-y-1.5">
                <p className="font-semibold text-[#174D32]">
                  Webhook URL &amp; Gateway Setup Instructions
                </p>
                <p>
                  <strong>Webhook Endpoint:</strong>{' '}
                  <span className="font-mono-data">/webhooks/payment</span> (HMAC-SHA256 signature
                  verified against server `.env` secret, deduplicated via unique provider event ID).
                </p>
                <p>
                  <strong>Local XAMPP Testing:</strong> Use Razorpay/Cashfree Test Mode credentials
                  in <code>/indra-agr/.env</code> and tunnel port 80/443 via ngrok to test live
                  webhooks locally before switching to production HTTPS.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="submit"
                  className="px-6 py-2.5 text-sm font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md"
                >
                  Save Payment Settings
                </button>
                {paySavedMsg && (
                  <span className="text-xs font-semibold text-[#174D32]">{paySavedMsg}</span>
                )}
              </div>
            </form>
          )}

          {section === 'directors' && (
            <div className="p-6 bg-white rounded-lg border border-[#174D32]/12 space-y-4">
              <h1 className="font-serif-display text-3xl font-bold text-[#1B2B22]">
                Board of Directors
              </h1>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {directors.map((d) => (
                  <div
                    key={d.id}
                    className="p-5 rounded-md bg-[#F6F4EC] border border-[#174D32]/12 space-y-1.5"
                  >
                    <h2 className="font-serif-display text-2xl font-bold text-[#174D32]">
                      {d.fullName}
                    </h2>
                    <p className="text-xs font-semibold">{d.designation}</p>
                    <p className="text-xs text-[#1B2B22]/80">{d.bio}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'settings' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onUpdateSettings(settingsDraft);
                setSettingsSaved(true);
                setTimeout(() => setSettingsSaved(false), 3000);
              }}
              className="p-6 bg-white rounded-lg border border-[#174D32]/12 space-y-5"
            >
              <h1 className="font-serif-display text-3xl font-bold text-[#1B2B22]">
                Website, Email &amp; SMS Settings
              </h1>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Verified Office Address
                  </label>
                  <input
                    value={settingsDraft.officeAddress}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, officeAddress: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm border border-[#174D32]/25 rounded-md"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Official Email</label>
                    <input
                      value={settingsDraft.contactEmail}
                      onChange={(e) =>
                        setSettingsDraft({ ...settingsDraft, contactEmail: e.target.value })
                      }
                      className="w-full px-3.5 py-2 text-sm border border-[#174D32]/25 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Official Phone</label>
                    <input
                      value={settingsDraft.contactPhone}
                      onChange={(e) =>
                        setSettingsDraft({ ...settingsDraft, contactPhone: e.target.value })
                      }
                      className="w-full px-3.5 py-2 text-sm border border-[#174D32]/25 rounded-md"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-6 pt-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settingsDraft.smtpConfigured}
                      onChange={(e) =>
                        setSettingsDraft({ ...settingsDraft, smtpConfigured: e.target.checked })
                      }
                      className="accent-[#174D32]"
                    />
                    <span>SMTP Email Provider Active</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settingsDraft.smsConfigured}
                      onChange={(e) =>
                        setSettingsDraft({ ...settingsDraft, smsConfigured: e.target.checked })
                      }
                      className="accent-[#174D32]"
                    />
                    <span>SMS OTP Provider Active</span>
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  className="px-6 py-2.5 text-sm font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md"
                >
                  Save Settings
                </button>
                {settingsSaved && (
                  <span className="text-xs font-semibold text-[#174D32]">Settings saved.</span>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
