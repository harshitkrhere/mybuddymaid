// /[city]/[area]/[slug] — service × locality (the money pages), plus Phase 5 entity pages
// at the same depth. `slug` is either a service slug or a `ready`/`live` entity slug; the
// two can never collide because every service slug is in RESERVED_SLUGS and the importer
// rejects reserved slugs. Service × zone pages are not enabled (zone hubs link to
// service × locality).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SeoPage } from '@/components/seo/SeoPage';
import { composeServiceLocality } from '@/lib/seo-engine/compose';
import { composeEntity } from '@/lib/seo-engine/compose-entity';
import { metadataFor } from '@/lib/seo-engine/page-metadata';
import { entityParams } from '@/lib/entities';
import { ENTITY_BY_PATH } from '@/data/seo/entities';
import { ALL_LOCALITIES, LOCALITY_BY_PATH, SERVICES, SERVICE_BY_SLUG } from '@/data/seo';

export const dynamicParams = false;

export function generateStaticParams() {
  const out: { city: string; area: string; slug: string }[] = [];
  for (const l of ALL_LOCALITIES) for (const s of SERVICES) out.push({ city: l.city, area: l.slug, slug: s.slug });
  out.push(...entityParams());
  return out;
}

function resolve(city: string, area: string, slug: string) {
  const loc = LOCALITY_BY_PATH.get(`${city}/${area}`);
  if (!loc) return null;
  const svc = SERVICE_BY_SLUG.get(slug as never);
  if (svc) {
    return {
      model: composeServiceLocality(svc, loc),
      og: { ogTitle: `${svc.name} in ${loc.name}`, ogSubtitle: `${loc.pincodes.join(', ')} · verified helpers` },
    };
  }
  const entity = ENTITY_BY_PATH.get(`${city}/${area}/${slug}`);
  if (entity) {
    return {
      model: composeEntity(entity),
      og: { ogTitle: `Maid service in ${entity.name}`, ogSubtitle: `${loc.name} · ${entity.pincode}` },
    };
  }
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ city: string; area: string; slug: string }> }): Promise<Metadata> {
  const { city, area, slug } = await params;
  const r = resolve(city, area, slug);
  return r ? metadataFor(r.model, r.og) : {};
}

export default async function ServiceLocalityPage({ params }: { params: Promise<{ city: string; area: string; slug: string }> }) {
  const { city, area, slug } = await params;
  const r = resolve(city, area, slug);
  if (!r) notFound();
  return <SeoPage model={r.model} />;
}
