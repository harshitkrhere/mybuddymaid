// /[city]/[area]/[slug]/[service] — Phase 5 long-tail entity × service pages.
// ISR with generateStaticParams limited to ready/live entities; unknown slugs 404.
// A `draft` entity has no URL at all, so nothing thin is ever served.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SeoPage } from '@/components/seo/SeoPage';
import { composeEntityService } from '@/lib/seo-engine/compose-entity';
import { metadataFor } from '@/lib/seo-engine/page-metadata';
import { entityParams } from '@/lib/entities';
import { ENTITY_BY_PATH } from '@/data/seo/entities';
import { SERVICE_BY_SLUG } from '@/data/seo';

export const dynamicParams = true;
export const revalidate = 86400;

export function generateStaticParams() {
  return entityParams();
}

function resolve(city: string, area: string, entity: string, service: string) {
  const e = ENTITY_BY_PATH.get(`${city}/${area}/${entity}`);
  const svc = SERVICE_BY_SLUG.get(service as never);
  if (!e || !svc) return null;
  return composeEntityService(svc, e);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; area: string; slug: string; service: string }>;
}): Promise<Metadata> {
  const { city, area, slug: entity, service } = await params;
  const m = resolve(city, area, entity, service);
  return m ? metadataFor(m) : {};
}

export default async function EntityServicePage({
  params,
}: {
  params: Promise<{ city: string; area: string; slug: string; service: string }>;
}) {
  const { city, area, slug: entity, service } = await params;
  const m = resolve(city, area, entity, service);
  if (!m) notFound();
  return (
    <SeoPage model={m}>
      <p className="muted">
        This page covers one society or landmark inside{' '}
        <Link href={`/${city}/${area}`}>the {area.replace(/-/g, ' ')} locality page</Link>, which has the full service and pricing detail for the area.
      </p>
    </SeoPage>
  );
}
