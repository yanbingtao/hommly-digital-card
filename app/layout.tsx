import './globals.css';
import type { Metadata } from 'next';
import { Outfit, Plus_Jakarta_Sans } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

/** Warm modern UI type — gift-shop friendly without looking corporate. */
const bodyFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-hommly-sans',
  display: 'swap',
});

/** Soft geometric display for headlines — modern retail, not editorial/formal. */
const displayFont = Outfit({
  subsets: ['latin'],
  variable: '--font-hommly-display',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Hommly eCard — Personal digital surprises for Hommly gifts',
    template: '%s · Hommly',
  },
  description:
    'Add personalised messages, photos and digital surprises to selected Hommly gifts. Recipients simply scan the included QR card — no app required.',
  icons: {
    icon: [{ url: '/logo.png', type: 'image/png' }],
    apple: '/logo.png',
  },
  openGraph: {
    title: 'Hommly eCard — More than a gift',
    description:
      'Personalise selected Hommly gifts with a message, photo and digital eCard. Recipients scan the QR card — no app required.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hommly eCard — More than a gift',
    description:
      'Personalise selected Hommly gifts with a message, photo and digital eCard. Recipients scan the QR card — no app required.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn(bodyFont.variable, displayFont.variable)}>
      <body className="font-sans antialiased">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
