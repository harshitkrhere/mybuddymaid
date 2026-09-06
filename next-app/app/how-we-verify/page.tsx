import type { Metadata } from 'next';
import Link from 'next/link';
import { TrustPage } from '@/components/seo/TrustPage';
import { staticMetadata } from '@/lib/seo-engine/page-metadata';

export const dynamic = 'force-static';

export const metadata: Metadata = staticMetadata({
  title: 'How We Verify Helpers',
  description:
    'The checks every MyBuddyMaid helper goes through before placement: Aadhaar validation, previous-employer references, behavioural assessment and police verification on Gold and Diamond plans.',
  path: '/how-we-verify',
});

export default function HowWeVerifyPage() {
  return (
    <TrustPage
      title="How we verify helpers"
      intro="Every helper we place is checked before you meet them. This page describes exactly what we check, what we share with you, and what we do not claim."
      path="/how-we-verify"
    >
      <h2>What we check</h2>
      <ul>
        <li>
          <strong>Aadhaar validation.</strong> We validate the helper&apos;s Aadhaar identity and keep the identity record on file.
        </li>
        <li>
          <strong>Previous-employer reference checks.</strong> We contact households where the helper has worked before and ask about reliability, conduct and reason for leaving.
        </li>
        <li>
          <strong>Behavioural assessment.</strong> Every applicant is assessed in person on conduct, communication and suitability for household work before entering our pool.
        </li>
        <li>
          <strong>Police verification.</strong> Comprehensive police verification is conducted for helpers placed on our Gold and Diamond plans.
        </li>
      </ul>

      <h2>What we share with you</h2>
      <p>
        Before placement we share the verification dossier for the helper you select, including identity proofs and police-verification status where it applies to your plan. You see this before the
        helper starts, not after.
      </p>

      <h2>How the process runs</h2>
      <ol>
        <li>The helper applies and is screened against the basic requirements of the role.</li>
        <li>Identity and address documents are collected and validated.</li>
        <li>References from previous households are contacted.</li>
        <li>A behavioural assessment is completed in person.</li>
        <li>Police verification is completed for Gold and Diamond placements.</li>
        <li>Only then is the profile shortlisted for you to interview.</li>
      </ol>

      <h2>What we do not claim</h2>
      <p>
        Verification reduces risk; it does not eliminate it. We do not claim to predict future behaviour, and we do not carry out medical or psychiatric evaluation. We recommend that you interview
        every shortlisted helper yourself, agree duties and timings clearly at the start, and keep a copy of the helper&apos;s ID. If a placement does not work out, our{' '}
        <Link href="/replacement-policy">replacement policy</Link> applies.
      </p>

      <h2>Related</h2>
      <ul className="link-list">
        <li>
          <Link href="/replacement-policy">Replacement policy</Link>
        </li>
        <li>
          <Link href="/pricing">Pricing and plans</Link>
        </li>
        <li>
          <Link href="/about">About MyBuddyMaid</Link>
        </li>
        <li>
          <Link href="/contact">Contact us</Link>
        </li>
      </ul>
    </TrustPage>
  );
}
