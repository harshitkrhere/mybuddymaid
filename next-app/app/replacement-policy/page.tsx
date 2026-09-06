import type { Metadata } from 'next';
import Link from 'next/link';
import { TrustPage } from '@/components/seo/TrustPage';
import { staticMetadata } from '@/lib/seo-engine/page-metadata';
import { PLANS, REFUND_WINDOW_DAYS, REFUND_PROFILE_THRESHOLD } from '@/data/seo';

export const dynamic = 'force-static';

export const metadata: Metadata = staticMetadata({
  title: 'Replacement Policy',
  description:
    'If a helper leaves or is not the right fit, MyBuddyMaid provides replacements within your plan term: 3 over 10 months on Silver, 5 over 12 months on Gold, 10 over 18 months on Diamond.',
  path: '/replacement-policy',
});

export default function ReplacementPolicyPage() {
  return (
    <TrustPage
      title="Replacement policy"
      intro="If the helper you hire leaves or is not the right fit, you get a replacement within your plan term. These are the exact terms."
      path="/replacement-policy"
    >
      <h2>What each plan includes</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Plan</th>
              <th>Replacement term</th>
              <th>Replacements included</th>
              <th>Verified profiles shared</th>
            </tr>
          </thead>
          <tbody>
            {PLANS.map((p) => (
              <tr key={p.key}>
                <td>{p.name}</td>
                <td>{p.termMonths} months</td>
                <td>{p.replacements}</td>
                <td>{p.verifiedProfiles}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>When a replacement applies</h2>
      <ul>
        <li>The helper leaves, stops coming, or becomes unavailable.</li>
        <li>The helper&apos;s work does not match the duties agreed at the start.</li>
        <li>The arrangement is not working for your household within the plan term.</li>
      </ul>

      <h2>How to request one</h2>
      <ol>
        <li>Message us on WhatsApp or call, and tell us what went wrong.</li>
        <li>We re-match against your original stated requirements.</li>
        <li>We aim to share the new profile within 48 hours, so the disruption to your household is short.</li>
        <li>You interview the new helper before confirming, exactly as you did the first time.</li>
      </ol>

      <h2>Refunds</h2>
      <p>
        The platform fee is refundable, minus a processing fee, only if we are unable to provide {REFUND_PROFILE_THRESHOLD} suitable verified profiles matching your original stated requirements within{' '}
        {REFUND_WINDOW_DAYS} days of payment.
        Refunds are not issued once a candidate has been successfully hired, or where the client becomes unresponsive. The full terms are in our{' '}
        <Link href="/terms-of-service">terms of service</Link>.
      </p>

      <h2>Related</h2>
      <ul className="link-list">
        <li>
          <Link href="/how-we-verify">How we verify</Link>
        </li>
        <li>
          <Link href="/pricing">Pricing and plans</Link>
        </li>
        <li>
          <Link href="/contact">Contact us</Link>
        </li>
      </ul>
    </TrustPage>
  );
}
