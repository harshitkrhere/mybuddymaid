import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { Analytics } from '@/components/shared/Analytics';
import { VercelAnalytics } from '@/components/shared/VercelAnalytics';
import { JsonLd } from '@/components/seo/JsonLd';
import { organizationLd } from '@/lib/seo-engine/jsonld';
import { SITE_URL, BRAND } from '@/lib/seo-engine/meta';

// One self-hosted variable family for body and headings: a second family cost ~28KB
// and an extra preload on the critical path, which showed up directly in FCP.
const inter = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${BRAND} – Verified Maids, Cooks & Nannies`, template: `%s` },
  description: 'Verified maids, cooks, nannies and elder-care helpers across Delhi NCR, Mumbai, Pune, Bangalore and Mangalore, with a replacement policy.',
  applicationName: BRAND,
  icons: { icon: '/favicon-32.png', apple: '/apple-touch-icon.png' },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION ? { 'msvalidate.01': process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION } : undefined,
  },
  // hreflang hook: single language today; add `alternates.languages` with hi-IN when a Hindi site exists.
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0d1117',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={inter.variable}>
      <body>
        <JsonLd data={[organizationLd()]} />
        <Header />
        <div className="page">{children}</div>
        <Footer />
        <Analytics />
        <VercelAnalytics />
      </body>
    </html>
  );
}
