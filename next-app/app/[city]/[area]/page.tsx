// /[city]/[area] — `area` resolves to a ZONE hub or a LOCALITY hub from the data layer
// (the validator guarantees the two slug sets never collide within a city).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SeoPage } from '@/components/seo/SeoPage';
import { composeLocality, composeZone } from '@/lib/seo-engine/compose';
import { metadataFor } from '@/lib/seo-engine/page-metadata';
import { ALL_LOCALITIES, LOCALITY_BY_PATH, ZONES, ZONE_BY_PATH } from '@/data/seo';

export const dynamicParams = false;

export function generateStaticParams() {
  return [
    ...ZONES.map((z) => ({ city: z.city, area: z.slug })),
    ...ALL_LOCALITIES.map((l) => ({ city: l.city, area: l.slug })),
  ];
}

function resolve(city: string, area: string) {
  const zone = ZONE_BY_PATH.get(`${city}/${area}`);
  if (zone) return { model: composeZone(zone), og: { ogTitle: `Maid Service in ${zone.name}`, ogSubtitle: `${zone.localities.length} localities · verified helpers` } };
  const loc = LOCALITY_BY_PATH.get(`${city}/${area}`);
  if (loc) return { model: composeLocality(loc), og: { ogTitle: `Maid Service in ${loc.name}`, ogSubtitle: `${loc.pincodes.join(', ')} · verified helpers` } };
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ city: string; area: string }> }): Promise<Metadata> {
  const { city, area } = await params;
  const r = resolve(city, area);
  return r ? metadataFor(r.model, r.og) : {};
}

export default async function AreaPage({ params }: { params: Promise<{ city: string; area: string }> }) {
  const { city, area } = await params;
  const r = resolve(city, area);
  if (!r) notFound();
  return <SeoPage model={r.model} />;
}
