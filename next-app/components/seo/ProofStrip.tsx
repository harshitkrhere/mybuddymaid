// components/seo/ProofStrip.tsx — three facts under the hero buttons, each a sentence that
// already stands on /how-we-verify (growth plan W2 A5, approved by the owner 2026-09-15).
// Nothing here is a new claim: lib/__tests__/cta-copy.test.ts pins every line to the
// verification page's own wording, and that page is where the strip's link lands.
import Link from 'next/link';

export const PROOF_LINES: ReadonlyArray<{ text: string; source: RegExp }> = [
  { text: 'Aadhaar identity validated for every helper', source: /validate the helper(?:&apos;|')s Aadhaar identity/ },
  { text: 'Previous-employer references checked', source: /Previous-employer reference checks/ },
  { text: 'Police verification on Gold and Diamond plans', source: /police verification is conducted for helpers placed on our Gold and Diamond plans/i },
];

export function ProofStrip() {
  return (
    <ul className="proof" aria-label="How we verify helpers">
      {PROOF_LINES.map((l) => (
        <li key={l.text}>{l.text}</li>
      ))}
      <li className="proof__link">
        <Link href="/how-we-verify">How we verify</Link>
      </li>
    </ul>
  );
}
