// lib/seo-engine/meta.ts — title/H1/description templates (Appendix D).
// One function per page type; scripts/seo/validate.ts asserts global uniqueness.
import type { City, Locality, PincodeRecord, Service, Zone } from '@/data/seo/types';

export const SITE_URL = 'https://mybuddymaid.in';
export const BRAND = 'MyBuddyMaid';
const SUFFIX = ` | ${BRAND}`;

export interface PageMeta {
  title: string;
  h1: string;
  description: string;
  canonicalPath: string;
}

const clamp = (s: string, max: number) => (s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…');

const TITLE_MAX = 68;
/** First variant that fits TITLE_MAX; falls back to the last (shortest) one. */
function fitTitle(...variants: string[]): string {
  return variants.find((v) => v.length <= TITLE_MAX) ?? variants[variants.length - 1];
}

/** Compose a description ≤155 chars: pincode(s) + differentiator + CTA + neighbours (trimmed first). */
function desc(base: string, neighbours: string[]): string {
  const cta = ' Book on WhatsApp.';
  let d = base + cta;
  if (neighbours.length >= 2) {
    const withNb = `${base} Also serving ${neighbours[0]}, ${neighbours[1]} & nearby.${cta}`;
    if (withNb.length <= 155) return withNb;
  }
  if (d.length > 155) d = clamp(base, 155 - cta.length) + cta;
  return clamp(d, 155);
}

/** Alt name shown in titles/H1s — only the true city-name variants, kept short. */
const TITLE_ALT: Record<string, string> = {
  gurgaon: 'Gurugram',
  bangalore: 'Bengaluru',
  mangalore: 'Mangaluru',
};

export function homeMeta(): PageMeta {
  return {
    title: `Maid Service in India – Verified Maids & Cooks | ${BRAND}`,
    h1: 'Verified Maids, Cooks & Nannies Across India',
    description:
      'Verified maids, cooks, nannies & elder-care helpers in Delhi NCR, Mumbai, Pune, Bangalore & Mangalore. Replacement policy. Book on WhatsApp.',
    canonicalPath: '/',
  };
}

export function cityMeta(city: City): PageMeta {
  const alt = TITLE_ALT[city.slug] ? ` (${TITLE_ALT[city.slug]})` : '';
  const title = fitTitle(
    `Maid Service in ${city.name}${alt} – Verified & Reliable${SUFFIX}`,
    `Maid Service in ${city.name}${alt} – Verified${SUFFIX}`,
    `Maid Service in ${city.name}${alt}${SUFFIX}`,
  );
  return {
    title,
    h1: `Maid Service in ${city.name}${alt}`,
    description: desc(
      `Verified, background-checked maids, cooks & nannies across ${city.name}${alt}. Replacement policy included.`,
      city.heroLocalities.map(titleCaseSlug),
    ),
    canonicalPath: `/${city.slug}`,
  };
}

export function zoneMeta(zone: Zone, city: City): PageMeta {
  return {
    title: fitTitle(
      `Maid Service in ${zone.name}, ${city.name} – All Areas${SUFFIX}`,
      `Maid Service in ${zone.name}, ${city.name}${SUFFIX}`,
      `Maid Service in ${zone.name}${SUFFIX}`,
    ),
    h1: `Maid Service in ${zone.name}, ${city.name}`,
    description: desc(
      `Maid, cook & nanny service across ${zone.name}, ${city.name}: verified helpers with a replacement policy.`,
      zone.localities.map(titleCaseSlug),
    ),
    canonicalPath: `/${city.slug}/${zone.slug}`,
  };
}

export function localityMeta(loc: Locality, city: City): PageMeta {
  const title = fitTitle(
    `Maid Service in ${loc.name}, ${city.name} – ${loc.pincodes[0]}${SUFFIX}`,
    `Maid Service in ${loc.name}, ${city.name}${SUFFIX}`,
    `Maid Service in ${loc.name}${SUFFIX}`,
  );
  return {
    title,
    h1: `Maid Service in ${loc.name}, ${city.name}`,
    description: desc(
      `Maid service in ${loc.name} (${loc.pincodes.join(', ')}): verified, background-checked helpers, replacement policy.`,
      loc.neighbours.map(titleCaseSlug),
    ),
    canonicalPath: `/${city.slug}/${loc.slug}`,
  };
}

export function serviceLocalityMeta(svc: Service, loc: Locality, city: City): PageMeta {
  return {
    title: fitTitle(
      `${svc.name} in ${loc.name}, ${city.name}${SUFFIX}`,
      `${svc.name} in ${loc.name}${SUFFIX}`,
    ),
    h1: `${svc.name} in ${loc.name}, ${city.name}`,
    description: desc(
      `${svc.name} in ${loc.name} (${loc.pincodes.join(', ')}): verified helpers, replacement policy.`,
      loc.neighbours.map(titleCaseSlug),
    ),
    canonicalPath: `/${city.slug}/${loc.slug}/${svc.slug}`,
  };
}

export function serviceCityMeta(svc: Service, city: City): PageMeta {
  const alt = TITLE_ALT[city.slug] ? ` (${TITLE_ALT[city.slug]})` : '';
  return {
    title: fitTitle(
      `${svc.name} in ${city.name} – Verified & Reliable${SUFFIX}`,
      `${svc.name} in ${city.name} – Verified${SUFFIX}`,
      `${svc.name} in ${city.name}${SUFFIX}`,
    ),
    h1: `${svc.name} in ${city.name}${alt}`,
    description: desc(
      `${svc.name} across ${city.name}${alt}: verified, background-checked helpers with a replacement policy.`,
      city.heroLocalities.map(titleCaseSlug),
    ),
    canonicalPath: `/services/${svc.slug}/${city.slug}`,
  };
}

export function serviceHubMeta(svc: Service): PageMeta {
  return {
    title: fitTitle(
      `${svc.name} in India – Verified & Reliable${SUFFIX}`,
      `${svc.name} in India – Verified${SUFFIX}`,
      `${svc.name} in India${SUFFIX}`,
    ),
    h1: `${svc.name} – Verified Helpers, City by City`,
    description: desc(
      `${svc.name}: ${svc.shortDescription} Verified helpers in Delhi NCR, Mumbai, Pune, Bangalore & Mangalore.`,
      [],
    ),
    canonicalPath: `/services/${svc.slug}`,
  };
}

export function maidServiceHubMeta(): PageMeta {
  return {
    title: `Maid Service – Verified House Maids Across India${SUFFIX}`,
    h1: 'Maid Service – Verified House Maids Across India',
    description:
      'Verified maid service in Delhi NCR, Mumbai, Pune, Bangalore & Mangalore: background-checked house maids with a replacement policy. Book on WhatsApp.',
    canonicalPath: '/services/maid-service',
  };
}

export function pincodeMeta(rec: PincodeRecord, names: string[]): PageMeta {
  const shown = names.slice(0, 2).join(', ');
  return {
    title: fitTitle(
      `Maid Service in ${rec.pin} – ${shown}${SUFFIX}`,
      `Maid Service in ${rec.pin} – ${names[0]}${SUFFIX}`,
      `Maid Service in ${rec.pin}${SUFFIX}`,
    ),
    h1: `Maid Service in ${rec.pin} – ${names.join(', ')}`,
    description: desc(
      `Maid, cook & nanny service in pincode ${rec.pin}: verified helpers in ${shown} with a replacement policy.`,
      [],
    ),
    canonicalPath: `/pincode/${rec.pin}`,
  };
}

export function titleCaseSlug(slug: string): string {
  return slug
    .split('-')
    .map((w) => (w === 'of' || w === 'in' ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}
