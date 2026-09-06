// data/seo/index.ts — THE single source of truth for every location-aware feature:
// SEO pages, sitemaps, lead form options, pincode checker, booking flow, "we serve" copy.
// If a locality is not here, it has no page and is not serviceable (brief rule #2).
import type { City, FAQ, Locality, PincodeRecord, Zone } from './types';
import { CITIES as CITY_SEEDS } from './cities';
import { ZONE_SEEDS, ZONES_UPDATED_AT } from './zones';
import cityContent from './content/city-content.json';
import zoneContent from './content/zone-content.json';
import { DELHI_LOCALITIES } from './localities/delhi';
import { NOIDA_LOCALITIES } from './localities/noida';
import { GREATER_NOIDA_LOCALITIES } from './localities/greater-noida';
import { GURGAON_LOCALITIES } from './localities/gurgaon';
import { MUMBAI_LOCALITIES } from './localities/mumbai';
import { PUNE_LOCALITIES } from './localities/pune';
import { BANGALORE_LOCALITIES } from './localities/bangalore';
import { MANGALORE_LOCALITIES } from './localities/mangalore';

export * from './types';
export { SERVICES, SERVICE_BY_SLUG } from './services';
export { GLOBAL_FAQS, HOUSING_FAQ_POOLS } from './faqs/shared-faqs';

const cityIntros = (cityContent as { intros?: Record<string, string> }).intros ?? {};
const cityFaqs = (cityContent as { faqs?: Record<string, FAQ[]> }).faqs ?? {};
const zoneIntros = (zoneContent as { intros?: Record<string, string> }).intros ?? {};
const zoneFaqs = (zoneContent as { faqs?: Record<string, FAQ[]> }).faqs ?? {};

/** Cities with curated intros merged in from the generated content layer. */
export const CITIES: City[] = CITY_SEEDS.map((c) => ({ ...c, intro: cityIntros[c.slug] ?? c.intro }));
export const CITY_BY_SLUG = new Map(CITIES.map((c) => [c.slug, c]));

export const CITY_FAQ_POOLS: Record<string, FAQ[]> = cityFaqs;
export const ZONE_FAQ_POOLS: Record<string, FAQ[]> = zoneFaqs;

export const ALL_LOCALITIES: Locality[] = [
  ...DELHI_LOCALITIES,
  ...NOIDA_LOCALITIES,
  ...GREATER_NOIDA_LOCALITIES,
  ...GURGAON_LOCALITIES,
  ...MUMBAI_LOCALITIES,
  ...PUNE_LOCALITIES,
  ...BANGALORE_LOCALITIES,
  ...MANGALORE_LOCALITIES,
];

/** key: `${city}/${localitySlug}` */
export const LOCALITY_BY_PATH = new Map(ALL_LOCALITIES.map((l) => [`${l.city}/${l.slug}`, l]));

export const LOCALITIES_BY_CITY = new Map<string, Locality[]>();
for (const l of ALL_LOCALITIES) {
  const arr = LOCALITIES_BY_CITY.get(l.city) ?? [];
  arr.push(l);
  LOCALITIES_BY_CITY.set(l.city, arr);
}

/** Zones with their `localities` arrays derived from locality records — cannot drift. */
export const ZONES: Zone[] = ZONE_SEEDS.map((seed) => ({
  ...seed,
  localities: ALL_LOCALITIES.filter((l) => l.city === seed.city && l.zone === seed.slug).map((l) => l.slug),
  intro: zoneIntros[seed.slug] ?? seed.intro ?? '',
  updatedAt: ZONES_UPDATED_AT,
}));

export const ZONE_BY_PATH = new Map(ZONES.map((z) => [`${z.city}/${z.slug}`, z]));

export const ZONES_BY_CITY = new Map<string, Zone[]>();
for (const z of ZONES) {
  const arr = ZONES_BY_CITY.get(z.city) ?? [];
  arr.push(z);
  ZONES_BY_CITY.set(z.city, arr);
}

/**
 * Pincode records, derived from localities plus zone- and city-level pins.
 * A pincode page is indexable only when the pin maps to >= 2 localities;
 * a 1:1 pin 301s to its locality hub; locality-less pins are serviceable only.
 */
export const PINCODES: PincodeRecord[] = (() => {
  const map = new Map<string, PincodeRecord>();
  const add = (pin: string, city: City['slug'], localitySlug?: string) => {
    const rec = map.get(pin) ?? { pin, city, localities: [] };
    if (localitySlug && !rec.localities.includes(localitySlug)) rec.localities.push(localitySlug);
    map.set(pin, rec);
  };
  for (const l of ALL_LOCALITIES) for (const pin of l.pincodes) add(pin, l.city, l.slug);
  for (const z of ZONES) for (const pin of z.zonePincodes) add(pin, z.city);
  for (const c of CITIES) for (const pin of c.cityLevelPincodes) add(pin, c.slug);
  return [...map.values()].sort((a, b) => a.pin.localeCompare(b.pin));
})();

export const PINCODE_BY_PIN = new Map(PINCODES.map((p) => [p.pin, p]));

/** Reserved top-level slugs no city, zone, locality or entity may use (brief §5). */
export const RESERVED_SLUGS = new Set([
  'services',
  'pincode',
  'blog',
  'about',
  'contact',
  'pricing',
  'how-we-verify',
  'replacement-policy',
  'api',
  'admin',
  'login',
  'dashboard',
  'book',
  'sitemap',
  'sitemaps',
  'app',
  'maintenance',
  'about-us',
  'contact-us',
  'privacy-policy',
  'terms-of-service',
  'full-time-maid',
  'part-time-maid',
  'cook',
  'babysitter-nanny',
  'elder-care',
  'domestic-help',
  'maid-service',
]);

// ---------------------------------------------------------------------------
// Serviceability API — the lead form, pincode checker and booking flow use these.
// ---------------------------------------------------------------------------

const isPin = (v: string) => /^\d{6}$/.test(v.trim());

/** True when a 6-digit pincode or a locality slug (optionally city-scoped "city/slug") is in the footprint. */
export function isServiceable(pincodeOrLocalitySlug: string): boolean {
  const v = pincodeOrLocalitySlug.trim().toLowerCase();
  if (isPin(v)) return PINCODE_BY_PIN.has(v);
  if (v.includes('/')) return LOCALITY_BY_PATH.has(v);
  return ALL_LOCALITIES.some((l) => l.slug === v);
}

/** Localities served under a pincode (empty array = pin is serviceable at zone/city level only). */
export function getLocalitiesByPincode(pin: string): Locality[] {
  const rec = PINCODE_BY_PIN.get(pin.trim());
  if (!rec) return [];
  return rec.localities
    .map((slug) => LOCALITY_BY_PATH.get(`${rec.city}/${slug}`))
    .filter((l): l is Locality => Boolean(l));
}

/** The single locality for a 1:1 pin, else null (many-to-many pins have their own page). */
export function getLocalityByPincode(pin: string): Locality | null {
  const list = getLocalitiesByPincode(pin);
  return list.length === 1 ? list[0] : null;
}

/** Curated neighbours first; falls back to same-zone siblings until enrichment lands. */
export function getNearby(city: string, localitySlug: string, limit = 8): Locality[] {
  const self = LOCALITY_BY_PATH.get(`${city}/${localitySlug}`);
  if (!self) return [];
  const byNeighbours = self.neighbours
    .map((slug) => LOCALITY_BY_PATH.get(`${city}/${slug}`))
    .filter((l): l is Locality => Boolean(l));
  if (byNeighbours.length >= Math.min(limit, 4)) return byNeighbours.slice(0, limit);
  const zoneSiblings = ALL_LOCALITIES.filter(
    (l) => l.city === self.city && l.zone === self.zone && l.slug !== self.slug,
  );
  const merged = [...byNeighbours];
  for (const s of zoneSiblings) {
    if (merged.length >= limit) break;
    if (!merged.some((m) => m.slug === s.slug)) merged.push(s);
  }
  return merged.slice(0, limit);
}
