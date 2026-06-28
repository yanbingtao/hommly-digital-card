import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Hommly — Digital Surprise Card',
  description:
    'Every Hommly gift can come with a digital surprise card. Add a heartfelt message, photo, and animation — ready to be opened by QR code.',
  openGraph: {
    title: 'Hommly — Digital Surprise Card',
    description:
      'Make every gift feel more personal with a QR-powered digital surprise card from Hommly.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hommly — Digital Surprise Card',
    description:
      'Make every gift feel more personal with a QR-powered digital surprise card from Hommly.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
