'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { LANDING_MAX_WIDTH, SHOP_URL } from './constants';
import { cn } from '@/lib/utils';

export type LandingNavLink = {
  href: string;
  label: string;
  /** Hide below this breakpoint (Tailwind prefix). Default: always visible on sm+. */
  visibility?: 'sm' | 'md' | 'always';
};

const DEFAULT_NAV: LandingNavLink[] = [
  { href: '#how-it-works', label: 'How It Works', visibility: 'sm' },
  { href: '#preview', label: 'Preview', visibility: 'md' },
];

type LandingHeaderProps = {
  navLinks?: LandingNavLink[];
};

export function LandingHeader({ navLinks = DEFAULT_NAV }: LandingHeaderProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-[background-color,box-shadow,border-color] duration-300 motion-reduce:transition-none',
        scrolled
          ? 'border-b border-stone-200/70 bg-[#fffaf7]/90 shadow-sm shadow-stone-200/40 backdrop-blur-xl'
          : 'border-b border-transparent bg-[#fffaf7]/70 backdrop-blur-md'
      )}
    >
      <div
        className={cn(
          'mx-auto flex items-center justify-between px-4 py-3.5 sm:px-6 sm:py-4',
          LANDING_MAX_WIDTH
        )}
      >
        <BrandLogo className="min-h-11" />

        <nav className="flex items-center gap-0.5 sm:gap-1" aria-label="Main navigation">
          {navLinks.map((link) => {
            const visibilityClass =
              link.visibility === 'always'
                ? 'inline-flex'
                : link.visibility === 'md'
                  ? 'hidden md:inline-flex'
                  : 'hidden sm:inline-flex';
            const isHash = link.href.startsWith('#');
            const className = cn(
              visibilityClass,
              'min-h-11 items-center rounded-lg px-3 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100/80 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/60'
            );
            if (isHash) {
              return (
                <a key={link.href + link.label} href={link.href} className={className}>
                  {link.label}
                </a>
              );
            }
            return (
              <Link key={link.href + link.label} href={link.href} className={className}>
                {link.label}
              </Link>
            );
          })}
          <a
            href={SHOP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-rose-500 px-4 text-sm font-semibold text-white shadow-sm shadow-rose-500/25 transition hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2"
          >
            Shop Gifts
            <ExternalLink className="h-3.5 w-3.5 opacity-90" aria-hidden />
          </a>
          <Link
            href="/admin/login"
            className="ml-1 hidden min-h-11 items-center px-2 text-xs font-medium text-stone-400 transition hover:text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300 sm:inline-flex"
          >
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
