import React from 'react';
import type { WebsiteSettings } from '../types/recruitment';

interface FooterProps {
  settings: WebsiteSettings;
  onNavigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ settings, onNavigate }) => {
  const link = (label: string, path: string) => (
    <a
      href={`#${path}`}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(path);
      }}
      className="text-sm text-white/75 hover:text-[#C7A65A] transition-colors"
    >
      {label}
    </a>
  );

  return (
    <footer className="no-print bg-[#103B27] text-white border-t border-[#C7A65A]/25">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="space-y-3">
            <h2 className="font-serif-display text-2xl font-bold tracking-tight text-white">
              {settings.companyName}
            </h2>
            <p className="text-sm text-[#C7A65A] font-medium">{settings.tagline}</p>
            <p className="text-xs text-white/70 tracking-wide">{settings.values}</p>
            <p className="text-xs text-white/65 leading-relaxed pt-2">
              {settings.paymentSettings.gatewayEnabled &&
              settings.paymentSettings.applicationFeePaise > 0
                ? `Official application fee: ${settings.paymentSettings.currency} ${(
                    settings.paymentSettings.applicationFeePaise / 100
                  ).toFixed(2)} payable strictly inside our verified UPI checkout.`
                : 'Apply only via our official portal. Beware of unauthorized recruitment agents or personal UPI QR requests.'}
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[#C7A65A] font-sans">Company</h3>
            <ul className="space-y-2">
              <li>{link('Home', '/')}</li>
              <li>{link('About Us', '/about')}</li>
              <li>{link('Our Services', '/services')}</li>
              <li>{link('Our Directors', '/directors')}</li>
              <li>{link('Contact Us', '/contact')}</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[#C7A65A] font-sans">Recruitment</h3>
            <ul className="space-y-2">
              <li>{link('Explore Careers', '/careers')}</li>
              <li>{link('Online Application', '/apply')}</li>
              <li>{link('Track Application Status', '/application-status')}</li>
              <li>{link('Recruitment Disclaimer', '/recruitment-disclaimer')}</li>
              <li>{link('Admin Portal', '/admin/login')}</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[#C7A65A] font-sans">
              Verified Contact & Legal
            </h3>
            <div className="space-y-2 text-xs text-white/75 leading-relaxed">
              <p>{settings.officeAddress}</p>
              <p>{settings.contactEmail}</p>
              <p>{settings.contactPhone}</p>
            </div>
            <div className="pt-2 flex flex-wrap gap-4">
              {link('Privacy Policy', '/privacy-policy')}
              {link('Terms & Conditions', '/terms')}
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/60">
          <p>© {new Date().getFullYear()} {settings.companyName} All rights reserved.</p>
          <p>Directors: Manish Kumar &amp; Indra Kumar</p>
        </div>
      </div>
    </footer>
  );
};
