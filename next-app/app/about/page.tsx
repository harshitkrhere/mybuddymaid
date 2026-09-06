import type { Metadata } from 'next';
import Link from 'next/link';
import { TrustPage } from '@/components/seo/TrustPage';
import { staticMetadata } from '@/lib/seo-engine/page-metadata';
import { ALL_LOCALITIES, CITIES, ZONES } from '@/data/seo';

export const dynamic = 'force-static';

export const metadata: Metadata = staticMetadata({
  title: 'About MyBuddyMaid',
  description:
    'MyBuddyMaid places verified maids, cooks, nannies and elder-care helpers with households across Delhi NCR, Mumbai, Pune, Bangalore and Mangalore. Founded 2021, registered in Bengaluru.',
  path: '/about',
});

export default function AboutPage() {
  return (
    <TrustPage
      title="About MyBuddyMaid"
      intro="We match households with verified domestic helpers, and stay involved after the placement rather than disappearing once the fee is paid."
      path="/about"
    >
      <h2>What we do</h2>
      <p>
        MyBuddyMaid places full-time and part-time maids, cooks, babysitters and nannies, elder-care attendants and all-round domestic help with households. We verify every helper, shortlist profiles
        against what you actually asked for, arrange the interviews, and provide replacements within your plan term if the placement does not work out.
      </p>
      <p>
        We have been operating since 2021. Today we serve {ALL_LOCALITIES.length} localities across {ZONES.length} zones in {CITIES.length} cities:{' '}
        {CITIES.map((c) => c.name).join(', ')}. Rather than claim national coverage, we publish the exact list of areas we serve, and we say no when a request falls outside it.
      </p>

      <h2>How we are different</h2>
      <ul>
        <li>
          <strong>A published footprint.</strong> Every locality we serve has its own page with its pincodes, housing profile and nearby areas. If an area has no page, we do not serve it yet.
        </li>
        <li>
          <strong>Verification you can see.</strong> The dossier for your selected helper is shared with you before placement. See <Link href="/how-we-verify">how we verify</Link>.
        </li>
        <li>
          <strong>Replacement cover in writing.</strong> Terms, counts and durations are published on the <Link href="/replacement-policy">replacement policy</Link> page, not buried in a sales call.
        </li>
      </ul>

      <h2>Company details</h2>
      <ul>
        <li>Founded: 2021</li>
        <li>Registered office: 175, 5th Floor, Main Road, Chandra Layout, Bengaluru, Karnataka 560040</li>
        <li>
          Phone: <a href="tel:+919355114869">+91 93551 14869</a>
        </li>
        <li>
          Email: <a href="mailto:info@mybuddymaid.in">info@mybuddymaid.in</a>
        </li>
      </ul>
      <p>
        We operate from a single registered office in Bengaluru and place helpers in the cities listed above. We do not maintain branch offices in each locality, and we do not claim to.
      </p>

      <h2>Related</h2>
      <ul className="link-list">
        <li>
          <Link href="/contact">Contact us</Link>
        </li>
        <li>
          <Link href="/pricing">Pricing and plans</Link>
        </li>
        <li>
          <Link href="/privacy-policy">Privacy policy</Link>
        </li>
        <li>
          <Link href="/terms-of-service">Terms of service</Link>
        </li>
      </ul>
    </TrustPage>
  );
}
