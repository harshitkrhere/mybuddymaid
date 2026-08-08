import type { Metadata } from 'next';
import { readFileSync } from 'fs';
import { join } from 'path';
import { generatePageMetadata } from '@/lib/seo/metadata';
import { organizationSchema, JsonLd } from '@/lib/seo/schema';
import LandingPageContent from '@/components/LandingPageContent';

export const metadata: Metadata = generatePageMetadata({
  title: 'Verified Maid Service in Delhi NCR, Mumbai & Bangalore — MyBuddyMaid | Book Online',
  description: 'Book 100% police-verified maids, cooks, nannies & elderly care helpers in Delhi NCR, Mumbai & Bangalore. 1-year free replacement guarantee. Trusted by 12,000+ families. Starting ₹2,499.',
  path: '/',
});

export default function HomePage() {
  const bodyHtml = readFileSync(
    join(process.cwd(), 'public', '_landing', 'body.html'),
    'utf-8'
  );

  return (
    <>
      <JsonLd data={organizationSchema()} />
      <LandingPageContent bodyHtml={bodyHtml} />
    </>
  );
}
