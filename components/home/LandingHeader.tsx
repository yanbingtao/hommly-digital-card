import Link from 'next/link';
import { Gift } from 'lucide-react';

const SHOP_URL = 'https://hommly.sg';

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-stone-200/80 bg-[#fdf8f3]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-100 to-amber-100 shadow-sm">
            <Gift className="h-5 w-5 text-rose-500" aria-hidden />
          </span>
          <span className="text-lg font-semibold tracking-tight text-stone-800">
            Hommly
          </span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-4" aria-label="Main navigation">
          <a
            href={SHOP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-stone-600 transition hover:text-rose-600 sm:text-sm"
          >
            Shop Gifts
          </a>
          <a
            href="#how-it-works"
            className="text-xs font-medium text-stone-600 transition hover:text-rose-600 sm:text-sm"
          >
            How It Works
          </a>
          <Link
            href="/admin/cards"
            className="rounded-full border border-stone-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-stone-500 transition hover:border-stone-300 hover:text-stone-700 sm:px-4 sm:py-2 sm:text-sm"
          >
            Admin Management
          </Link>
        </nav>
      </div>
    </header>
  );
}
