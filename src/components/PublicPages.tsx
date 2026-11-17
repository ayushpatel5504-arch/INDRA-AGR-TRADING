import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, MapPin, Briefcase, Calendar } from 'lucide-react';
import type {
  DirectorProfile,
  JobVacancy,
  PaymentSettings,
  WebsiteSettings,
} from '../types/recruitment';
import { formatPaiseToInr } from '../utils/paymentLogic';

const HERO_IMG = '/src/assets/images/hero_wheat_fields_1794903225659.jpg';
const GRAIN_IMG = '/src/assets/images/agri_grain_quality_1794903226795.jpg';
const SUPPLY_IMG = '/src/assets/images/agri_supply_chain_1794903226947.jpg';

const RECRUITMENT_STEPS = [
  { num: '01', title: 'Explore Jobs', desc: 'Browse verified, currently published openings across our operations.' },
  { num: '02', title: 'Apply Online', desc: 'Complete the multi-step digital application form with accurate academic records.' },
  { num: '03', title: 'Verify Contact Details', desc: 'Confirm both your mobile number and email address via 6-digit OTP.' },
  { num: '04', title: 'Application Review', desc: 'Our recruitment team reviews qualifications and uploaded documents.' },
  { num: '05', title: 'Interview', desc: 'Shortlisted candidates receive official online or offline interview details.' },
  { num: '06', title: 'Final Decision', desc: 'Selection outcomes are communicated transparently through official channels.' },
];

interface HomePageProps {
  jobs: JobVacancy[];
  directors: DirectorProfile[];
  paymentSettings: PaymentSettings;
  onNavigate: (path: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  jobs,
  directors,
  paymentSettings,
  onNavigate,
}) => {
  const publishedJobs = jobs.filter((j) => j.status === 'published').slice(0, 3);
  const feeActive =
    paymentSettings.gatewayEnabled && paymentSettings.applicationFeePaise > 0;

  return (
    <div>
      {/* Section 2: Hero */}
      <section className="relative bg-[#103B27] text-white overflow-hidden">
        <img
          src={HERO_IMG}
          alt="Golden wheat fields at sunrise representing Indian agricultural trading"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#103B27]/95 via-[#103B27]/75 to-[#103B27]/35" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-40">
          <div className="max-w-2xl space-y-6">
            <p className="text-sm font-medium tracking-widest text-[#C7A65A]">
              Quality · Trust · Growth
            </p>
            <h1 className="font-serif-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.08] text-white [text-wrap:balance]">
              Connecting Farmers, Growing Businesses.
            </h1>
            <p className="text-base sm:text-lg text-white/85 leading-relaxed max-w-xl">
              INDRA AGR TRADING PVT. LTD. builds dependable agricultural trading channels
              grounded in quality verification, transparent procurement, and enduring partnerships.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onNavigate('/careers')}
                className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-[#103B27] bg-[#C7A65A] hover:bg-[#d6b66b] rounded-md transition-colors whitespace-nowrap"
              >
                Explore Careers
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/about')}
                className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-white border border-white/40 hover:bg-white/10 rounded-md transition-colors whitespace-nowrap"
              >
                About Our Company
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: About Company */}
      <section className="py-20 bg-[#F6F4EC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center space-y-5">
            <p className="text-xs font-semibold tracking-wider text-[#174D32]">
              About INDRA AGR TRADING PVT. LTD.
            </p>
            <h2 className="font-serif-display text-3xl sm:text-4xl font-bold text-[#1B2B22] [text-wrap:balance]">
              Rooted in Agricultural Integrity and Transparent Trade
            </h2>
            <p className="text-base text-[#1B2B22]/80 leading-relaxed">
              INDRA AGR TRADING PVT. LTD. operates at the intersection of rural agricultural
              production and commercial enterprise demand. Our focus is straightforward:
              respect the hard work of farmers while delivering reliable, quality-checked
              agricultural commodities to business partners.
            </p>
            <p className="text-base text-[#1B2B22]/80 leading-relaxed">
              Guided by our core values of Quality, Trust, and Growth, we maintain disciplined
              procurement standards and build long-term relationships across every link of the
              agricultural value chain.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onNavigate('/about')}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#174D32] hover:text-[#103B27]"
              >
                Read our full company overview
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-full min-h-[320px] rounded-lg overflow-hidden border border-[#174D32]/15 bg-[#103B27]">
              <img
                src={GRAIN_IMG}
                alt="Quality inspection of golden wheat grains"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Our Business */}
      <section className="py-20 bg-white border-y border-[#174D32]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12 space-y-3">
            <p className="text-xs font-semibold tracking-wider text-[#174D32]">Our Business</p>
            <h2 className="font-serif-display text-3xl sm:text-4xl font-bold text-[#1B2B22]">
              Bridging Farmers and Commercial Markets
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-5 rounded-lg overflow-hidden border border-[#174D32]/15 bg-[#103B27]">
              <img
                src={SUPPLY_IMG}
                alt="Modern agricultural grain trading and storage facility"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover min-h-[280px]"
              />
            </div>
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                {
                  num: '01. Agricultural Commodity Trading',
                  text: 'Structured sourcing and trading of verified agricultural produce with consistent grading standards.',
                },
                {
                  num: '02. Farmer-Business Connectivity',
                  text: 'Direct coordination between agricultural producers and enterprise buyers to reduce friction.',
                },
                {
                  num: '03. Quality Assessment',
                  text: 'Disciplined inspection practices focused on moisture, purity, and clean storage handling.',
                },
                {
                  num: '04. Transparent Operations',
                  text: 'Clear documentation, ethical trade conduct, and reliable dispatch coordination.',
                },
              ].map((item) => (
                <div
                  key={item.num}
                  className="p-6 rounded-lg bg-[#F6F4EC] border border-[#174D32]/10 space-y-2.5"
                >
                  <h3 className="font-serif-display text-xl font-bold text-[#174D32]">
                    {item.num}
                  </h3>
                  <p className="text-sm text-[#1B2B22]/80 leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: Why Work With Us */}
      <section className="py-20 bg-[#F6F4EC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12 space-y-3">
            <p className="text-xs font-semibold tracking-wider text-[#174D32]">Careers Culture</p>
            <h2 className="font-serif-display text-3xl sm:text-4xl font-bold text-[#1B2B22]">
              Why Work With INDRA AGR TRADING PVT. LTD.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: 'Purposeful Agricultural Impact',
                body: 'Contribute directly to operations that connect rural farming communities with growing commercial markets.',
              },
              {
                title: 'Merit-Based, Transparent Hiring',
                body: 'Every application is reviewed strictly on qualifications and suitability. Any applicable processing fee is disclosed upfront and collected solely via the verified UPI gateway.',
              },
              {
                title: 'Structured Operational Learning',
                body: 'Gain hands-on experience in commodity grading, procurement coordination, and corporate administration.',
              },
            ].map((card) => (
              <div
                key={card.title}
                className="p-7 bg-white rounded-lg border border-[#174D32]/12 space-y-3"
              >
                <h3 className="font-serif-display text-2xl font-bold text-[#1B2B22]">
                  {card.title}
                </h3>
                <p className="text-sm text-[#1B2B22]/80 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 6: Latest Job Openings */}
      <section className="py-20 bg-white border-y border-[#174D32]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-wider text-[#174D32]">
                Current Openings
              </p>
              <h2 className="font-serif-display text-3xl sm:text-4xl font-bold text-[#1B2B22]">
                Latest Job Vacancies
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/careers')}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#174D32] hover:text-[#103B27]"
            >
              View all vacancies
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {publishedJobs.length === 0 ? (
            <div className="p-10 text-center bg-[#F6F4EC] rounded-lg border border-[#174D32]/12">
              <p className="text-sm text-[#1B2B22]/75">
                No published vacancies are currently open. Please check back soon.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {publishedJobs.map((job) => (
                <article
                  key={job.id}
                  className="p-6 bg-[#F6F4EC] rounded-lg border border-[#174D32]/12 flex flex-col justify-between space-y-5"
                >
                  <div className="space-y-3">
                    <p className="text-xs text-[#1B2B22]/65">
                      {job.department} · {job.employmentType}
                    </p>
                    <h3 className="font-serif-display text-2xl font-bold text-[#1B2B22]">
                      {job.title}
                    </h3>
                    <div className="space-y-1.5 text-xs text-[#1B2B22]/75">
                      <p className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-[#174D32] shrink-0" />
                        <span>{job.location}</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <Briefcase className="w-3.5 h-3.5 text-[#174D32] shrink-0" />
                        <span>{job.experienceRequired}</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-[#174D32] shrink-0" />
                        <span className="font-mono-data">Deadline: {job.applicationDeadline}</span>
                      </p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-[#174D32]/10 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onNavigate(`/jobs/${job.slug}`)}
                      className="text-sm font-semibold text-[#174D32] hover:underline"
                    >
                      View Details
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate(`/apply?job=${job.id}`)}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md transition-colors"
                    >
                      Apply Online
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Section 7: Our Directors */}
      <section className="py-20 bg-[#F6F4EC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12 space-y-2">
            <p className="text-xs font-semibold tracking-wider text-[#174D32]">Leadership</p>
            <h2 className="font-serif-display text-3xl sm:text-4xl font-bold text-[#1B2B22]">
              Our Directors
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {directors.map((d) => (
              <div
                key={d.id}
                className="p-8 bg-white rounded-lg border border-[#174D32]/12 space-y-3"
              >
                <div className="flex items-baseline justify-between gap-4 border-b border-[#174D32]/10 pb-3">
                  <h3 className="font-serif-display text-2xl font-bold text-[#1B2B22]">
                    {d.fullName}
                  </h3>
                  <span className="text-xs font-semibold text-[#174D32]">{d.designation}</span>
                </div>
                <p className="text-sm text-[#1B2B22]/80 leading-relaxed">{d.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 8: Recruitment Process */}
      <section className="py-20 bg-white border-t border-[#174D32]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12 space-y-2">
            <p className="text-xs font-semibold tracking-wider text-[#174D32]">How Hiring Works</p>
            <h2 className="font-serif-display text-3xl sm:text-4xl font-bold text-[#1B2B22]">
              Six-Stage Recruitment Process
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {RECRUITMENT_STEPS.map((s) => (
              <div
                key={s.num}
                className="p-6 rounded-lg bg-[#F6F4EC] border border-[#174D32]/10 space-y-2"
              >
                <span className="font-mono-data text-xs font-semibold text-[#C7A65A]">
                  Stage {s.num}
                </span>
                <h3 className="font-serif-display text-xl font-bold text-[#1B2B22]">{s.title}</h3>
                <p className="text-sm text-[#1B2B22]/75 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 9: Apply Now CTA */}
      <section className="py-16 bg-[#174D32] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div className="max-w-2xl space-y-2">
            <h2 className="font-serif-display text-3xl sm:text-4xl font-bold">
              Ready to Build Your Career in Agricultural Trading?
            </h2>
            <p className="text-sm text-white/80">
              {feeActive
                ? `Official application fee: ${paymentSettings.currency} ${formatPaiseToInr(paymentSettings.applicationFeePaise)} payable exclusively inside the portal's verified ${paymentSettings.provider.toUpperCase()} UPI checkout.`
                : 'Apply directly through our official recruitment portal. Beware of unauthorized intermediaries or personal QR payment requests.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-4 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('/apply')}
              className="px-6 py-3.5 text-sm font-semibold text-[#103B27] bg-[#C7A65A] hover:bg-[#d6b66b] rounded-md transition-colors whitespace-nowrap"
            >
              Start Online Application
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/application-status')}
              className="px-6 py-3.5 text-sm font-semibold text-white border border-white/40 hover:bg-white/10 rounded-md transition-colors whitespace-nowrap"
            >
              Track Application Status
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export const AboutPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => (
  <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-10">
    <div className="space-y-3 border-b border-[#174D32]/15 pb-8">
      <p className="text-xs font-semibold tracking-wider text-[#174D32]">About Us</p>
      <h1 className="font-serif-display text-4xl sm:text-5xl font-bold text-[#1B2B22]">
        INDRA AGR TRADING PVT. LTD.
      </h1>
      <p className="text-lg text-[#174D32] font-medium">
        Connecting Farmers, Growing Businesses. — Quality | Trust | Growth
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-base text-[#1B2B22]/85 leading-relaxed">
      <p>
        INDRA AGR TRADING PVT. LTD. is an agricultural trading enterprise committed to
        building transparent, dependable links between farming communities and commercial
        buyers. Our operations emphasize fair sourcing, consistent quality inspection, and
        accountable fulfillment.
      </p>
      <p>
        We publish only verified corporate information and maintain an accountable, merit-driven
        recruitment portal with official gateway-verified fee receipts where applicable.
      </p>
    </div>

    <div className="p-8 bg-white rounded-lg border border-[#174D32]/12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h2 className="font-serif-display text-2xl font-bold text-[#1B2B22]">
          Explore Verified Opportunities
        </h2>
        <p className="text-sm text-[#1B2B22]/75">
          View currently published roles or meet our Board of Directors.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onNavigate('/directors')}
          className="px-4 py-2.5 text-sm font-semibold text-[#174D32] border border-[#174D32]/30 rounded-md hover:bg-[#F6F4EC]"
        >
          Our Directors
        </button>
        <button
          type="button"
          onClick={() => onNavigate('/careers')}
          className="px-4 py-2.5 text-sm font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md"
        >
          View Careers
        </button>
      </div>
    </div>
  </div>
);

export const DirectorsPage: React.FC<{ directors: DirectorProfile[] }> = ({ directors }) => (
  <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-10">
    <div className="space-y-3 border-b border-[#174D32]/15 pb-8">
      <p className="text-xs font-semibold tracking-wider text-[#174D32]">Board of Directors</p>
      <h1 className="font-serif-display text-4xl sm:text-5xl font-bold text-[#1B2B22]">
        Our Directors
      </h1>
      <p className="text-base text-[#1B2B22]/75">
        Leadership committed to Quality, Trust, and sustainable agricultural growth.
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {directors.map((d) => (
        <div key={d.id} className="p-8 bg-white rounded-lg border border-[#174D32]/15 space-y-4">
          <div>
            <h2 className="font-serif-display text-3xl font-bold text-[#1B2B22]">{d.fullName}</h2>
            <p className="text-sm font-semibold text-[#174D32] mt-1">{d.designation}</p>
          </div>
          <p className="text-sm text-[#1B2B22]/80 leading-relaxed">{d.bio}</p>
        </div>
      ))}
    </div>
  </div>
);

export const ServicesPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => (
  <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-10">
    <div className="space-y-3 border-b border-[#174D32]/15 pb-8">
      <p className="text-xs font-semibold tracking-wider text-[#174D32]">Our Services</p>
      <h1 className="font-serif-display text-4xl sm:text-5xl font-bold text-[#1B2B22]">
        Agricultural Trading &amp; Supply Connectivity
      </h1>
      <p className="text-base text-[#1B2B22]/75">
        Focused, verified trading capabilities connecting agricultural producers and commercial buyers.
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {[
        {
          title: '01. Agricultural Commodity Trading',
          desc: 'Responsible trading of grains and agricultural produce backed by clear documentation and transparent pricing.',
        },
        {
          title: '02. Farmer-to-Business Linkage',
          desc: 'Connecting regional farmers directly with institutional buyers to improve market access and continuity.',
        },
        {
          title: '03. Quality & Grading Discipline',
          desc: 'Systematic inspection for moisture, cleanliness, and commodity grade prior to commercial dispatch.',
        },
        {
          title: '04. Logistics & Dispatch Coordination',
          desc: 'Organized warehousing and dispatch scheduling designed for reliable delivery timelines.',
        },
      ].map((s) => (
        <div key={s.title} className="p-7 bg-white rounded-lg border border-[#174D32]/12 space-y-2.5">
          <h2 className="font-serif-display text-2xl font-bold text-[#174D32]">{s.title}</h2>
          <p className="text-sm text-[#1B2B22]/80 leading-relaxed">{s.desc}</p>
        </div>
      ))}
    </div>

    <div className="pt-4">
      <button
        type="button"
        onClick={() => onNavigate('/contact')}
        className="px-6 py-3 text-sm font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md"
      >
        Contact Our Team
      </button>
    </div>
  </div>
);

export const ContactPage: React.FC<{ settings: WebsiteSettings }> = ({ settings }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;
    setSent(true);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-10">
      <div className="space-y-2 border-b border-[#174D32]/15 pb-6">
        <p className="text-xs font-semibold tracking-wider text-[#174D32]">Contact Us</p>
        <h1 className="font-serif-display text-4xl font-bold text-[#1B2B22]">
          Get in Touch
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 bg-white rounded-lg border border-[#174D32]/12 space-y-4">
            <h2 className="font-serif-display text-2xl font-bold text-[#1B2B22]">
              Official Details
            </h2>
            <div className="space-y-3 text-sm text-[#1B2B22]/80">
              <div>
                <p className="text-xs font-semibold text-[#174D32]">Registered Office</p>
                <p>{settings.officeAddress}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#174D32]">Official Email</p>
                <p>{settings.contactEmail}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#174D32]">Official Phone</p>
                <p>{settings.contactPhone}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          {sent ? (
            <div className="p-8 bg-white rounded-lg border border-[#174D32]/20 space-y-3">
              <div className="flex items-center gap-2 text-[#174D32] font-semibold">
                <CheckCircle2 className="w-5 h-5" />
                <span>Inquiry Recorded</span>
              </div>
              <p className="text-sm text-[#1B2B22]/80">
                Thank you, {name}. Your message has been recorded for review by INDRA AGR TRADING PVT. LTD.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setName('');
                  setEmail('');
                  setMessage('');
                }}
                className="text-sm font-semibold text-[#174D32] hover:underline"
              >
                Send another inquiry
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="p-8 bg-white rounded-lg border border-[#174D32]/12 space-y-5"
            >
              <div>
                <label htmlFor="contact-name" className="block text-sm font-medium text-[#1B2B22] mb-1.5">
                  Full Name *
                </label>
                <input
                  id="contact-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#174D32]/25 rounded-md bg-white focus:outline-2 focus:outline-[#174D32]"
                />
              </div>
              <div>
                <label htmlFor="contact-email" className="block text-sm font-medium text-[#1B2B22] mb-1.5">
                  Email Address *
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#174D32]/25 rounded-md bg-white focus:outline-2 focus:outline-[#174D32]"
                />
              </div>
              <div>
                <label htmlFor="contact-message" className="block text-sm font-medium text-[#1B2B22] mb-1.5">
                  Message *
                </label>
                <textarea
                  id="contact-message"
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#174D32]/25 rounded-md bg-white focus:outline-2 focus:outline-[#174D32]"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3 text-sm font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md"
              >
                Submit Inquiry
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export const LegalPage: React.FC<{
  type: 'privacy' | 'terms' | 'disclaimer';
  paymentSettings: PaymentSettings;
}> = ({ type, paymentSettings }) => {
  const feeActive =
    paymentSettings.gatewayEnabled && paymentSettings.applicationFeePaise > 0;
  const content = {
    privacy: {
      title: 'Privacy Policy',
      sections: [
        ['Information Collected', 'We collect only information genuinely necessary for recruitment evaluation, including personal contact details, academic records, employment history, and uploaded resumes or marksheets.'],
        ['Document Security & Retention', 'Uploaded documents are stored outside publicly accessible web directories with randomized filenames and restricted to authorized administrators. Candidates may request deletion of recruitment records after the hiring cycle concludes.'],
        ['Verification & Consent', 'Mobile and email OTP verification is used solely to confirm applicant identity and prevent unauthorized submissions.'],
      ],
    },
    terms: {
      title: 'Terms and Conditions',
      sections: [
        ['Portal Usage', 'This portal is operated for corporate information and direct job applications to INDRA AGR TRADING PVT. LTD.'],
        ['Accuracy of Information', 'Applicants are responsible for ensuring all submitted educational and professional details are accurate and verifiable.'],
        ['No Employment Guarantee', 'Submission of an online application does not constitute an offer of employment.'],
      ],
    },
    disclaimer: {
      title: 'Recruitment & Payment Disclaimer',
      sections: [
        [
          'Official Application Fee Policy',
          feeActive
            ? `The configured official application processing fee is ${paymentSettings.currency} ${formatPaiseToInr(paymentSettings.applicationFeePaise)}, payable exclusively via the official ${paymentSettings.provider.toUpperCase()} UPI checkout inside Step 8 of the application portal. Never pay via personal UPI QR codes or unauthorized third parties.`
            : 'Online application fee collection is configured solely by INDRA AGR TRADING PVT. LTD. Super Admin. Never transfer money to any personal UPI ID, static QR code, or external agent.',
        ],
        ['Refund Policy', paymentSettings.refundPolicy],
        ['Official Communication Only', 'All official interview invitations, receipts, and status updates are issued exclusively through verified company channels and reflected on the Application Status portal.'],
      ],
    },
  }[type];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
      <div className="border-b border-[#174D32]/15 pb-6">
        <p className="text-xs font-semibold tracking-wider text-[#174D32]">Legal &amp; Governance</p>
        <h1 className="font-serif-display text-4xl font-bold text-[#1B2B22] mt-2">
          {content.title}
        </h1>
      </div>
      <div className="space-y-6">
        {content.sections.map(([heading, body]) => (
          <section key={heading} className="p-6 bg-white rounded-lg border border-[#174D32]/12 space-y-2">
            <h2 className="font-serif-display text-2xl font-bold text-[#174D32]">{heading}</h2>
            <p className="text-sm text-[#1B2B22]/80 leading-relaxed">{body}</p>
          </section>
        ))}
      </div>
    </div>
  );
};

export const NotFoundPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => (
  <div className="max-w-2xl mx-auto px-4 py-24 text-center space-y-5">
    <p className="font-mono-data text-sm font-semibold text-[#C7A65A]">404</p>
    <h1 className="font-serif-display text-4xl font-bold text-[#1B2B22]">Page Not Found</h1>
    <p className="text-sm text-[#1B2B22]/75">
      The page you requested could not be found on the INDRA AGR TRADING PVT. LTD. portal.
    </p>
    <button
      type="button"
      onClick={() => onNavigate('/')}
      className="px-6 py-3 text-sm font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md"
    >
      Return to Homepage
    </button>
  </div>
);
