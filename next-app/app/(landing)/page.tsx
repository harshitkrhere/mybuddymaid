// Serves the existing static landing page (the polished one from mybuddymaid/).
// This is a thin wrapper that renders the original HTML/CSS/JS landing page
// inside Next.js while keeping all the SEO metadata.

import type { Metadata } from 'next';
import { generatePageMetadata } from '@/lib/seo/metadata';
import { organizationSchema, JsonLd } from '@/lib/seo/schema';
import LandingPageContent from '@/components/LandingPageContent';

export const metadata: Metadata = generatePageMetadata({
  title: 'Verified Maid Service in Delhi NCR, Mumbai & Bangalore — MyBuddyMaid | Book Online',
  description: 'Book 100% police-verified maids, cooks, nannies & elderly care helpers in Delhi NCR, Mumbai & Bangalore. 1-year free replacement guarantee. Trusted by 12,000+ families. Starting ₹3,999.',
  path: '/',
});

export default function HomePage() {
  return (
    <>
      <JsonLd data={organizationSchema()} />
      <LandingPageContent />
    </>
  );
}
