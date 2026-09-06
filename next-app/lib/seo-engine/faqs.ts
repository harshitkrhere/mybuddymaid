// lib/seo-engine/faqs.ts — FAQ assembly per brief §6.3: 6–8 per page, ≥3 locality-
// specific on locality pages, pool picks deterministic per page so no pooled FAQ lands
// on more than ~15% of pages of a type (checked by scripts/seo/uniqueness.ts).
import type { FAQ, Locality, Service } from '@/data/seo/types';
import { CITY_FAQ_POOLS, GLOBAL_FAQS, HOUSING_FAQ_POOLS, ZONE_FAQ_POOLS } from '@/data/seo';

export function hashKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Take `n` consecutive items from `pool`, starting at a page-deterministic offset. */
export function pick<T>(pool: T[], n: number, key: string): T[] {
  if (!pool.length || n <= 0) return [];
  const start = hashKey(key) % pool.length;
  const out: T[] = [];
  for (let i = 0; i < Math.min(n, pool.length); i++) out.push(pool[(start + i) % pool.length]);
  return out;
}

function dedupe(faqs: FAQ[]): FAQ[] {
  const seen = new Set<string>();
  return faqs.filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)));
}

/** Locality hub: 3 local + 1 housing + 2 city + 1 global = 7. */
export function localityFaqs(loc: Locality): FAQ[] {
  const key = `${loc.city}/${loc.slug}`;
  return dedupe([
    ...loc.localFaqs.slice(0, 3),
    ...pick(HOUSING_FAQ_POOLS[loc.housingProfile] ?? [], 1, key + '#housing'),
    ...pick(CITY_FAQ_POOLS[loc.city] ?? [], 2, key + '#city'),
    ...pick(GLOBAL_FAQS, 1, key + '#global'),
  ]);
}

/** Service × locality: 3 local + 1 housing + 2 service + 1 global = 7. */
export function serviceLocalityFaqs(svc: Service, loc: Locality): FAQ[] {
  const key = `${loc.city}/${loc.slug}/${svc.slug}`;
  return dedupe([
    ...loc.localFaqs.slice(0, 3),
    ...pick(HOUSING_FAQ_POOLS[loc.housingProfile] ?? [], 1, key + '#housing'),
    ...pick(svc.faqPool, 2, key + '#service'),
    ...pick(GLOBAL_FAQS, 1, key + '#global'),
  ]);
}

/** Zone hub: 2 zone + 3 city + 1 global. */
export function zoneFaqs(zoneSlug: string, city: string): FAQ[] {
  const key = `${city}/${zoneSlug}`;
  return dedupe([
    ...(ZONE_FAQ_POOLS[zoneSlug] ?? []).slice(0, 2),
    ...pick(CITY_FAQ_POOLS[city] ?? [], 3, key + '#city'),
    ...pick(GLOBAL_FAQS, 1, key + '#global'),
  ]);
}

/** City hub: all 5 city + 2 global. */
export function cityFaqs(city: string): FAQ[] {
  return dedupe([...(CITY_FAQ_POOLS[city] ?? []).slice(0, 5), ...pick(GLOBAL_FAQS, 2, city + '#global')]);
}

/** Service × city: 4 service + 2 city + 1 global. */
export function serviceCityFaqs(svc: Service, city: string): FAQ[] {
  const key = `services/${svc.slug}/${city}`;
  return dedupe([
    ...pick(svc.faqPool, 4, key + '#service'),
    ...pick(CITY_FAQ_POOLS[city] ?? [], 2, key + '#city'),
    ...pick(GLOBAL_FAQS, 1, key + '#global'),
  ]);
}

/** Service hub: 6 service + 2 global. */
export function serviceHubFaqs(svc: Service): FAQ[] {
  return dedupe([...svc.faqPool.slice(0, 6), ...pick(GLOBAL_FAQS, 2, svc.slug + '#global')]);
}
