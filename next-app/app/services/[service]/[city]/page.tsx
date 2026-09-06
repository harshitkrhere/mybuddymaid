import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SeoPage } from '@/components/seo/SeoPage';
import { composeServiceCity } from '@/lib/seo-engine/compose';
import { metadataFor } from '@/lib/seo-engine/page-metadata';
import { CITIES, CITY_BY_SLUG, SERVICES, SERVICE_BY_SLUG } from '@/data/seo';

export const dynamicParams = false;

export function generateStaticParams() {
  const out: { service: string; city: string }[] = [];
  for (const s of SERVICES) for (const c of CITIES) out.push({ service: s.slug, city: c.slug });
  return out;
}

function resolve(service: string, city: string) {
  const svc = SERVICE_BY_SLUG.get(service as never);
  const c = CITY_BY_SLUG.get(city as never);
  if (!svc || !c) return null;
  return { model: composeServiceCity(svc, c), og: { ogTitle: `${svc.name} in ${c.name}`, ogSubtitle: 'Verified helpers · replacement policy' } };
}

export async function generateMetadata({ params }: { params: Promise<{ service: string; city: string }> }): Promise<Metadata> {
  const { service, city } = await params;
  const r = resolve(service, city);
  return r ? metadataFor(r.model, r.og) : {};
}

export default async function ServiceCityPage({ params }: { params: Promise<{ service: string; city: string }> }) {
  const { service, city } = await params;
  const r = resolve(service, city);
  if (!r) notFound();
  return <SeoPage model={r.model} />;
}
