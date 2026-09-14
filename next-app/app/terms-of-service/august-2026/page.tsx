// The August 2026 terms, archived under their own URL when version 2.0 replaced them
// (Terms 2.0 §1.6 promises earlier versions stay available on the Platform). Not indexed.
import type { Metadata } from 'next';
import Link from 'next/link';
import { TrustPage } from '@/components/seo/TrustPage';
import { staticMetadata } from '@/lib/seo-engine/page-metadata';

export const dynamic = 'force-static';

export const metadata: Metadata = staticMetadata({
  title: 'Terms of Service (August 2026, superseded)',
  description: 'The MyBuddyMaid Terms of Service dated August 2026, replaced by version 2.0.',
  path: '/terms-of-service/august-2026',
  noindex: true,
});

export default function TermsPage() {
  return (
    <TrustPage
      title="Terms of service (August 2026)"
      intro="The previous version of our terms, kept for reference."
      path="/terms-of-service/august-2026"
    >
      <p className="legal__superseded">
        This is the terms of service dated August 2026, kept for reference. It was replaced by <Link href="/terms-of-service">version 2.0, effective 15 September 2026</Link>.
      </p>
      <p className="muted">Last updated: August 2026</p>
      <h2>1. Service Overview</h2>
      <p>MyBuddyMaid is a platform that connects families with verified home help professionals including maids, cooks, nannies, elderly care providers, and postnatal care specialists.</p>
      <h2>2. User Accounts</h2>
      <p>You must provide accurate information when creating an account. You are responsible for maintaining the confidentiality of your account credentials.</p>
      <h2>3. Booking & Payments</h2>
      <p>Bookings are confirmed upon payment. All payments are processed securely through Razorpay. Prices are displayed in Indian Rupees (INR).</p>
      <h2>4. Replacement Guarantee</h2>
      <p>We offer free replacements within the guarantee period of your plan (10–18 months depending on the plan). Replacement requests must be made through the platform or by contacting support.</p>
      <h2>5. Cancellation & Refunds</h2>
      <p>Cancellation requests are processed within 7 business days. Refund eligibility depends on the stage of service and is assessed on a case-by-case basis.</p>
      <h2>6. Liability</h2>
      <p>MyBuddyMaid acts as a marketplace connecting families with professionals. While we verify all professionals, we are not liable for actions performed by them outside the scope of their engagement.</p>
      <h2>7. Governing Law</h2>
      <p>These terms are governed by the laws of India. Any disputes shall be resolved through arbitration in Bengaluru, Karnataka.</p>
      <h2>8. Contact</h2>
      <p>Questions about these terms? Contact us at <a href="mailto:info@mybuddymaid.in">info@mybuddymaid.in</a> or +91 9355114869.</p>
    </TrustPage>
  );
}
