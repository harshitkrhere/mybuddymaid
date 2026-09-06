// /pincode/[pin] — only many-to-many pincodes get a page; 1:1 pins 301 to their
// locality hub via the redirect map (scripts/seo/gen-redirects.ts).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SeoPage } from '@/components/seo/SeoPage';
import { composePincode } from '@/lib/seo-engine/compose';
import { metadataFor } from '@/lib/seo-engine/page-metadata';
import { PINCODES, PINCODE_BY_PIN } from '@/data/seo';

export const dynamicParams = false;

export function generateStaticParams() {
  return PINCODES.filter((p) => p.localities.length >= 2).map((p) => ({ pin: p.pin }));
}

export async function generateMetadata({ params }: { params: Promise<{ pin: string }> }): Promise<Metadata> {
  const { pin } = await params;
  const rec = PINCODE_BY_PIN.get(pin);
  if (!rec || rec.localities.length < 2) return {};
  const m = composePincode(rec);
  return metadataFor(m, { ogTitle: `Maid Service in ${pin}`, ogSubtitle: `${rec.localities.length} localities · verified helpers` });
}

export default async function PincodePage({ params }: { params: Promise<{ pin: string }> }) {
  const { pin } = await params;
  const rec = PINCODE_BY_PIN.get(pin);
  if (!rec || rec.localities.length < 2) notFound();
  return <SeoPage model={composePincode(rec)} />;
}
