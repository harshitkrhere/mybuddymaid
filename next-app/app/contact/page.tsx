import type { Metadata } from 'next';
import Link from 'next/link';
import { TrustPage } from '@/components/seo/TrustPage';
import { staticMetadata } from '@/lib/seo-engine/page-metadata';
import { CITIES } from '@/data/seo';

export const dynamic = 'force-static';

export const metadata: Metadata = staticMetadata({
  title: 'Contact MyBuddyMaid',
  description:
    'Reach MyBuddyMaid on WhatsApp, phone or email to hire a verified maid, cook, nanny or elder-care helper. Registered office in Chandra Layout, Bengaluru.',
  path: '/contact',
});

export default function ContactPage() {
  return (
    <TrustPage
      title="Contact us"
      intro="Tell us the service you need, your locality and your preferred timings. WhatsApp is the fastest way to reach us."
      path="/contact"
    >
      <h2>How to reach us</h2>
      <ul>
        <li>
          <strong>WhatsApp:</strong>{' '}
          <a href="https://wa.me/919355114869?text=Hi%20MyBuddyMaid%2C%20I%20need%20help%20hiring%20a%20helper." target="_blank" rel="noopener">
            +91 93551 14869
          </a>
        </li>
        <li>
          <strong>Phone:</strong> <a href="tel:+919355114869">+91 93551 14869</a>
        </li>
        <li>
          <strong>Email:</strong> <a href="mailto:info@mybuddymaid.in">info@mybuddymaid.in</a>
        </li>
        <li>
          <strong>Registered office:</strong> 175, 5th Floor, Main Road, Chandra Layout, Bengaluru, Karnataka 560040
        </li>
      </ul>
      <p>
        Our registered office is not a walk-in centre for hiring. Helpers are matched and interviewed in your own locality, so please reach out on WhatsApp or by phone rather than travelling to the
        office.
      </p>

      <h2>What to tell us</h2>
      <ul>
        <li>The service you need: maid, cook, babysitter or nanny, elder care, or general domestic help.</li>
        <li>Your locality and pincode, so we can shortlist helpers who already travel there.</li>
        <li>Full-time, part-time or live-in, and the daily slot you prefer.</li>
        <li>Anything specific: cuisine, language, experience with infants or with elderly family members.</li>
      </ul>

      <h2>Find your area</h2>
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
