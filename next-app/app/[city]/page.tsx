import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SeoPage } from '@/components/seo/SeoPage';
import { composeCity } from '@/lib/seo-engine/compose';
import { metadataFor } from '@/lib/seo-engine/page-metadata';
import { CITIES, CITY_BY_SLUG } from '@/data/seo';

export const dynamicParams = false;

export function generateStaticParams() {
  return CITIES.map((c) => ({ city: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  const c = CITY_BY_SLUG.get(city as never);
  if (!c) return {};
  return metadataFor(composeCity(c), { ogTitle: `Maid Service in ${c.name}`, ogSubtitle: `${c.zones.length} zones · verified helpers` });
}

export default async function CityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  const c = CITY_BY_SLUG.get(city as never);
  if (!c) notFound();
  return <SeoPage model={composeCity(c)} />;
}
