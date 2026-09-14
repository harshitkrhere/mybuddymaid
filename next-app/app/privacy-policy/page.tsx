// app/privacy-policy/page.tsx — Privacy Policy 2.0, rendered from content/legal/privacy-policy.md.
// The August 2026 version stays at /privacy-policy/august-2026.
import type { Metadata } from 'next';
import { TrustPage } from '@/components/seo/TrustPage';
import { LegalDocument } from '@/components/seo/LegalDocument';
import { staticMetadata } from '@/lib/seo-engine/page-metadata';
import { legalDocument } from '@/lib/legal/documents';

export const dynamic = 'force-static';

export const metadata: Metadata = staticMetadata({
  title: 'Privacy Policy',
  description: 'MyBuddyMaid Privacy Policy — what personal data we collect, why, who sees it, how long we keep it, and how you control it under the DPDP Act, 2023.',
  path: '/privacy-policy',
});

export default function PrivacyPolicyPage() {
  const doc = legalDocument('privacy-policy');
  return (
    <TrustPage title="Privacy policy" intro="What personal data we collect, why, who sees it, how long we keep it, and how you can control it." path="/privacy-policy">
      <LegalDocument doc={doc} previous={{ label: 'read the August 2026 version', href: '/privacy-policy/august-2026' }} />
    </TrustPage>
  );
}
