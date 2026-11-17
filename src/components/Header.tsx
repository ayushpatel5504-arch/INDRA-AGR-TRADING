import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

interface HeaderProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

const NAV_LINKS = [
  { label: 'Home', path: '/' },
  { label: 'About', path: '/about' },
  { label: 'Services', path: '/services' },
  { label: 'Careers', path: '/careers' },
  { label: 'Directors', path: '/directors' },
  { label: 'Status', path: '/application-status' },
  { label: 'Contact', path: '/contact' },
];

export const Header: React.FC<HeaderProps> = ({ currentPath, onNavigate }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (path: string) => {
    setMobileOpen(false);
    onNavigate(path);
  };

  return (
    <header className="no-print sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[#174D32]/12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="#/"
          onClick={(e) => {
            e.preventDefault();
            handleNav('/');
          }}
          className="font-serif-display text-xl sm:text-2xl font-bold tracking-tight text-[#174D32] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#174D32]"
        >
          INDRA AGR TRADING
        </a>

        {/* Zone 2: Clean Single-Line Navigation Links */}
        <nav aria-label="Primary Navigation" className="hidden lg:flex items-center gap-7">
          {NAV_LINKS.map((item) => {
            const active =
              item.path === '/'
                ? currentPath === '/'
                : currentPath.startsWith(item.path);
            return (
              <a
                key={item.path}
                href={`#${item.path}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleNav(item.path);
                }}
                className={`text-sm font-medium transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
                  active
                    ? 'text-[#174D32] border-[#C7A65A]'
                    : 'text-[#1B2B22]/75 border-transparent hover:text-[#174D32] hover:border-[#174D32]/30'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleNav('/apply')}
            className="hidden sm:inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174D32]"
          >
            Apply Now
          </button>

          <button
            type="button"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-md text-[#174D32] hover:bg-[#F6F4EC] transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-b border-[#174D32]/15 px-4 py-4 space-y-1">
          {NAV_LINKS.map((item) => {
            const active =
              item.path === '/'
                ? currentPath === '/'
                : currentPath.startsWith(item.path);
            return (
              <a
                key={item.path}
                href={`#${item.path}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleNav(item.path);
                }}
                className={`block px-3 py-2.5 rounded-md text-sm font-medium ${
                  active
                    ? 'bg-[#F6F4EC] text-[#174D32] font-semibold'
                    : 'text-[#1B2B22]/80 hover:bg-[#F6F4EC]'
                }`}
              >
                {item.label}
              </a>
            );
          })}
          <div className="pt-3 border-t border-[#174D32]/10">
            <button
              type="button"
              onClick={() => handleNav('/apply')}
              className="w-full py-3 px-4 text-sm font-semibold text-white bg-[#174D32] hover:bg-[#103B27] rounded-md"
            >
              Apply Now
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
