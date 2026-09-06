import type { Metadata } from 'next';
import Link from 'next/link';
import { TrustPage } from '@/components/seo/TrustPage';
import { staticMetadata } from '@/lib/seo-engine/page-metadata';
import { SERVICES, CITIES } from '@/data/seo';
import { inr } from '@/lib/seo-engine/compose';

export const dynamic = 'force-static';

export const metadata: Metadata = staticMetadata({
  title: 'Pricing and Plans',
  description:
    'MyBuddyMaid platform plans (Silver, Gold, Diamond) and indicative monthly salary bands for maids, cooks, nannies and elder-care helpers across the cities we serve.',
  path: '/pricing',
});

const PLANS = [
  { name: 'Silver', fee: 3999, term: '10 months', replacements: 3, profiles: 1 },
  { name: 'Gold', fee: 4999, term: '12 months', replacements: 5, profiles: 3 },
  { name: 'Diamond', fee: 6999, term: '18 months', replacements: 10, profiles: 5 },
];

export default function PricingPage() {
  return (
    <TrustPage
      title="Pricing and plans"
      intro="There are two numbers to understand: the one-time platform fee you pay us, and the monthly salary you pay the helper directly."
      path="/pricing"
    >
      <h2>Platform plans</h2>
      <p>
        The platform fee is a one-time charge for access to our verified pool, the matching and interview process, and the replacement cover described on our{' '}
        <Link href="/replacement-policy">replacement policy</Link> page.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Plan</th>
              <th>One-time fee</th>
              <th>Replacement term</th>
              <th>Replacements</th>
              <th>Verified profiles</th>
            </tr>
          </thead>
          <tbody>
            {PLANS.map((p) => (
              <tr key={p.name}>
                <td>{p.name}</td>
                <td>{inr(p.fee)}</td>
                <td>{p.term}</td>
                <td>{p.replacements}</td>
                <td>{p.profiles}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Indicative helper salaries</h2>
      <p>
        The helper&apos;s monthly salary is paid by you, directly to them, and is agreed during the interview. The bands below are indicative starting points, not quotes.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>Indicative monthly band</th>
              <th>Typical hours</th>
            </tr>
          </thead>
          <tbody>
            {SERVICES.map((s) => (
              <tr key={s.slug}>
                <td>
                  <Link href={`/services/${s.slug}`}>{s.name}</Link>
                </td>
                <td>
                  {inr(s.pricing.metro.from)} – {inr(s.pricing.metro.to)} / month
                </td>
                <td>{s.typicalHours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>What moves the price</h2>
      <ul>
        <li>Hours per day and days per week.</li>
        <li>Tasks included, such as cooking, laundry or childcare add-ons.</li>
        <li>Household size and home size.</li>
      </ul>

      <h2>Salary guides by city</h2>
      <ul className="link-list">
        {CITIES.map((c) => (
          <li key={c.slug}>
            <Link href={`/${c.slug}`}>maid service in {c.name}</Link>
          </li>
        ))}
      </ul>
    </TrustPage>
  );
}
