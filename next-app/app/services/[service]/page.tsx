import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SeoPage } from '@/components/seo/SeoPage';
import { composeMaidServiceHub, composeServiceHub } from '@/lib/seo-engine/compose';
import { metadataFor } from '@/lib/seo-engine/page-metadata';
import { SERVICES, SERVICE_BY_SLUG } from '@/data/seo';

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ service: 'maid-service' }, ...SERVICES.map((s) => ({ service: s.slug }))];
}

function resolve(service: string) {
  if (service === 'maid-service') return composeMaidServiceHub();
  const svc = SERVICE_BY_SLUG.get(service as never);
  return svc ? composeServiceHub(svc) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ service: string }> }): Promise<Metadata> {
  const { service } = await params;
  const m = resolve(service);
  return m ? metadataFor(m, { ogTitle: m.hero.h1, ogSubtitle: 'Verified helpers · replacement policy' }) : {};
}

export default async function ServiceHubPage({ params }: { params: Promise<{ service: string }> }) {
  const { service } = await params;
  const m = resolve(service);
  if (!m) notFound();
  return <SeoPage model={m} />;
}
