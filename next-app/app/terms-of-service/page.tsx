// app/terms-of-service/page.tsx — Terms of Service 2.0, rendered from content/legal/terms-of-service.md.
// The August 2026 version stays at /terms-of-service/august-2026.
import type { Metadata } from 'next';
import { TrustPage } from '@/components/seo/TrustPage';
import { LegalDocument } from '@/components/seo/LegalDocument';
import { staticMetadata } from '@/lib/seo-engine/page-metadata';
import { legalDocument } from '@/lib/legal/documents';

export const dynamic = 'force-static';

export const metadata: Metadata = staticMetadata({
  title: 'Terms of Service',
  description: 'MyBuddyMaid Terms of Service — plans, fees, verification, replacements, refunds, cancellations, and how disputes are resolved.',
  path: '/terms-of-service',
});

export default function TermsPage() {
  const doc = legalDocument('terms-of-service');
  return (
    <TrustPage title="Terms of service" intro="The conditions for using the MyBuddyMaid platform and the services booked through it." path="/terms-of-service">
      <LegalDocument doc={doc} previous={{ label: 'read the August 2026 version', href: '/terms-of-service/august-2026' }} />
    </TrustPage>
  );
}
