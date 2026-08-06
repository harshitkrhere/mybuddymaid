import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Inter } from 'next/font/google';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://mybuddymaid.in'),
  title: {
    default: 'Verified Maid Service in Delhi NCR, Mumbai & Bangalore — MyBuddyMaid | Book Online',
    template: '%s — MyBuddyMaid',
  },
  description:
    'Book 100% police-verified maids, cooks, nannies & elderly care helpers in Delhi NCR, Mumbai & Bangalore. 1-year free replacement guarantee. Trusted by 12,000+ families. Starting ₹2,499.',
  keywords: [
    'maid service Delhi NCR',
    'maid service Mumbai',
    'maid service Bangalore',
    'verified maid',
    'cook service',
    'nanny service',
    'elderly care',
    'MyBuddyMaid',
  ],
  authors: [{ name: 'MyBuddyMaid' }],
  openGraph: {
    siteName: 'MyBuddyMaid',
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
