import React, { useMemo, useState } from 'react';
import { ArrowLeft, Briefcase, Calendar, MapPin, Search } from 'lucide-react';
import type { JobVacancy, PaymentSettings } from '../types/recruitment';
import { formatPaiseToInr } from '../utils/paymentLogic';

interface CareersPageProps {
  jobs: JobVacancy[];
  paymentSettings: PaymentSettings;
  onNavigate: (path: string) => void;
}

export const CareersPage: React.FC<CareersPageProps> = ({
  jobs,
  paymentSettings,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const feeActive =
    paymentSettings.gatewayEnabled && paymentSettings.applicationFeePaise > 0;

  const publishedJobs = useMemo(
    () => jobs.filter((j) => j.status === 'published'),
    [jobs]
  );

  const locations = useMemo(
    () => ['All', ...Array.from(new Set(publishedJobs.map((j) => j.location)))],
    [publishedJobs]
  );

  const types = useMemo(
    () => ['All', ...Array.from(new Set(publishedJobs.map((j) => j.employmentType)))],
    [publishedJobs]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return publishedJobs.filter((j) => {
      const matchesQ =
        !q ||
        j.title.toLowerCase().includes(q) ||
        j.department.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q);
      const matchesLoc = locationFilter === 'All' || j.location === locationFilter;
      const matchesType = typeFilter === 'All' || j.employmentType === typeFilter;
      return matchesQ && matchesLoc && matchesType;
    });
  }, [publishedJobs, query, locationFilter, typeFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-10">
      <div className="space-y-3 border-b border-[#174D32]/15 pb-8">
        <p className="text-xs font-semibold tracking-wider text-[#174D32]">Careers Portal</p>
        <h1 className="font-serif-display text-4xl sm:text-5xl font-bold text-[#1B2B22]">
          Current Job Openings
        </h1>
        <p className="text-sm text-[#1B2B22]/75 max-w-2xl">
          {feeActive
            ? `Configured Application Fee: ${paymentSettings.currency} ${formatPaiseToInr(paymentSettings.applicationFeePaise)} (payable exclusively via official ${paymentSettings.provider.toUpperCase()} UPI checkout inside the portal).`
            : 'Apply directly through our official recruitment portal. Beware of unauthorized intermediaries or personal UPI payment requests.'}
        </p>
      </div>

      {/* Search & Filters */}
      <div className="p-5 bg-white rounded-lg border border-[#174D32]/12 grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-5 relative">
          <label htmlFor="career-search" className="sr-only">
            Search vacancies
          </label>
          <Search className="w-4 h-4 text-[#1B2B22]/45 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="career-search"
            type="text"
            placeholder="Search by job title or department..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-[#174D32]/20 rounded-md focus:outline-2 focus:outline-[#174D32]"
          />
        </div>

        <div className="md:col-span-4">
          <label htmlFor="career-location" className="sr-only">
            Filter by location
          </label>
          <select
            id="career-location"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm border border-[#174D32]/20 rounded-md bg-white focus:outline-2 focus:outline-[#174D32]"
          >
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                Location: {loc}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label htmlFor="career-type" className="sr-only">
            Filter by employment type
          </label>
          <select
            id="career-type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm border border-[#174D32]/20 rounded-md bg-white focus:outline-2 focus:outline-[#174D32]"
          >
            {types.map((t) => (
              <option key={t} value={t}>
                Type: {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-lg border border-[#174D32]/12">
          <p className="text-sm text-[#1B2B22]/75">
            No published vacancies match your current search criteria.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((job) => (
            <article
              key={job.id}
              className="p-6 sm:p-7 bg-white rounded-lg border border-[#174D32]/12 flex flex-col lg:flex-row lg:items-center justify-between gap-6"
            >
              <div className="space-y-2.5 max-w-3xl">
                <p className="text-xs text-[#1B2B22]/65">
                  {job.department} · {job.employmentType} ·{' '}
                  <span className="font-mono-data">Deadline: {job.applicationDeadline}</span>
                </p>
                <h2 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#1B2B22]">
                  {job.title}
                </h2>
                <p className="text-sm text-[#1B2B22]/80 leading-relaxed">{job.description}</p>
                <div className="flex flex-wrap gap-5 pt-1 text-xs text-[#1B2B22]/75">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#174D32]" />
                    {job.location}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-[#174D32]" />
                    {job.experienceRequired}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => onNavigate(`/jobs/${job.slug}`)}
                  className="px-4 py-2.5 text-sm font-semibold text-[#174D32] border border-[#174D32]/30 hover:bg-[#F6F4EC] rounded-md whitespace-nowrap"
                >
                  View Details
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate(`/apply?job=${job.id}`)}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md whitespace-nowrap"
                >
                  Apply Now
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

interface JobDetailsPageProps {
  job: JobVacancy | undefined;
  paymentSettings: PaymentSettings;
  onNavigate: (path: string) => void;
}

export const JobDetailsPage: React.FC<JobDetailsPageProps> = ({
  job,
  paymentSettings,
  onNavigate,
}) => {
  const feeActive =
    paymentSettings.gatewayEnabled && paymentSettings.applicationFeePaise > 0;
  if (!job || job.status !== 'published') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="font-serif-display text-3xl font-bold text-[#1B2B22]">
          Vacancy Not Available
        </h1>
        <p className="text-sm text-[#1B2B22]/75">
          This job opening may have been closed or archived.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('/careers')}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-[#174D32] rounded-md"
        >
          Back to Careers
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-8">
      <button
        type="button"
        onClick={() => onNavigate('/careers')}
        className="inline-flex items-center gap-2 text-sm font-medium text-[#174D32] hover:underline"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to all vacancies
      </button>

      <div className="p-8 bg-white rounded-lg border border-[#174D32]/15 space-y-6">
        <div className="space-y-3 border-b border-[#174D32]/10 pb-6">
          <p className="text-xs text-[#1B2B22]/65">
            {job.department} · {job.employmentType}
          </p>
          <h1 className="font-serif-display text-4xl font-bold text-[#1B2B22]">{job.title}</h1>
          <div className="flex flex-wrap gap-6 text-sm text-[#1B2B22]/80">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#174D32]" />
              {job.location}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-[#174D32]" />
              {job.experienceRequired}
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono-data">
              <Calendar className="w-4 h-4 text-[#174D32]" />
              Apply by {job.applicationDeadline}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="font-serif-display text-2xl font-bold text-[#174D32]">Role Overview</h2>
          <p className="text-sm text-[#1B2B22]/85 leading-relaxed">{job.description}</p>
        </div>

        <div className="space-y-2">
          <h2 className="font-serif-display text-2xl font-bold text-[#174D32]">
            Key Responsibilities
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-[#1B2B22]/85">
            {job.responsibilities.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-md bg-[#F6F4EC] border border-[#174D32]/10">
            <p className="text-xs font-semibold text-[#174D32]">Required Qualifications</p>
            <p className="text-sm text-[#1B2B22] mt-1">{job.qualifications}</p>
          </div>
          <div className="p-4 rounded-md bg-[#F6F4EC] border border-[#174D32]/10">
            <p className="text-xs font-semibold text-[#174D32]">Compensation</p>
            <p className="text-sm text-[#1B2B22] mt-1">{job.salaryRange}</p>
          </div>
        </div>

        <div className="p-4 rounded-md bg-[#F6F4EC] border border-[#C7A65A]/50 text-xs text-[#1B2B22]/85">
          {feeActive
            ? `Application Processing Fee: ${paymentSettings.currency} ${formatPaiseToInr(paymentSettings.applicationFeePaise)} payable via official ${paymentSettings.provider.toUpperCase()} UPI checkout before final submission.`
            : 'Apply directly via the official portal. Never pay unauthorized recruiters or personal UPI accounts.'}
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => onNavigate(`/apply?job=${job.id}`)}
            className="px-7 py-3.5 text-sm font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md"
          >
            Apply for this Position
          </button>
        </div>
      </div>
    </div>
  );
};
