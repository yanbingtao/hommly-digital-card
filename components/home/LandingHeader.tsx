import Link from 'next/link';
import { BrandLogo } from '@/components/BrandLogo';
import { SHOP_URL } from './constants';

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-stone-200/60 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <BrandLogo />

        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main navigation">
          <a
            href="#how-it-works"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50 hover:text-stone-900 sm:inline-block"
          >
            How It Works
          </a>
          <a
            href="#preview"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50 hover:text-stone-900 md:inline-block"
          >
            Preview
          </a>
          <a
            href={SHOP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
          >
            Shop Gifts
          </a>
          <Link
            href="/admin/login"
            className="ml-1 rounded-lg px-3 py-2 text-sm font-medium text-stone-500 transition hover:text-stone-800"
          >
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
