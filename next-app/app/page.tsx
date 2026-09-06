import type { Metadata } from 'next';
import Link from 'next/link';
import { SeoPage } from '@/components/seo/SeoPage';
import { composeHome } from '@/lib/seo-engine/compose';
import { metadataFor } from '@/lib/seo-engine/page-metadata';
import { CITIES, LOCALITIES_BY_CITY, ZONES_BY_CITY } from '@/data/seo';

export const dynamic = 'force-static';

export function generateMetadata(): Metadata {
  return metadataFor(composeHome(), { ogTitle: 'Verified maids, cooks & nannies', ogSubtitle: 'Delhi NCR · Mumbai · Pune · Bangalore · Mangalore' });
}

export default function HomePage() {
  const model = composeHome();
  return (
    <SeoPage model={model}>
      <section className="cards" id="cities">
        <h2>Find your city</h2>
        <ul className="card-grid">
          {CITIES.map((c) => (
            <li key={c.slug} className="card">
              <h3>
                <Link href={`/${c.slug}`}>Maid service in {c.name}</Link>
              </h3>
              <p>
                {(ZONES_BY_CITY.get(c.slug) ?? []).length} zones · {(LOCALITIES_BY_CITY.get(c.slug) ?? []).length} localities
                {c.altNames[0] && ['gurgaon', 'bangalore', 'mangalore'].includes(c.slug) ? ` · also ${c.altNames[0]}` : ''}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </SeoPage>
  );
}
