import './globals.css';
import type { Metadata } from 'next';
import { Toaster } from '@/components/ui/sonner';

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
      <body className="font-sans antialiased">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
