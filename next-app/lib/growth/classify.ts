// lib/growth/classify.ts — one classifier for every growth report. A URL or path becomes
// {type, city, locality, service} against the page architecture, so Search Console, GA4,
// Bing and the inspection ledger all aggregate the same way. Extracted from
// scripts/seo/gsc-report.ts, which now imports it.
import { ALL_LOCALITIES, CITIES, CITY_BY_SLUG, PINCODE_BY_PIN, SERVICE_BY_SLUG } from '@/data/seo';

export type PageType =
  | 'home'
  | 'service-hub'
  | 'service-city'
  | 'pincode'
  | 'blog'
  | 'city'
  | 'zone'
  | 'locality'
  | 'service-locality'
  | 'entity'
  | 'trust'
  | 'other';

export interface Classified {
  path: string;
  type: PageType;
  city: string;
  locality: string;
  service: string;
}

/** Page types whose demand is not attributable to one city; they aggregate under 'national'. */
export const NATIONAL_TYPES: ReadonlySet<PageType> = new Set<PageType>(['home', 'service-hub', 'trust', 'blog']);

const LOCALITY_PATHS = new Set(ALL_LOCALITIES.map((l) => `${l.city}/${l.slug}`));

/** Site-relative path of a URL or path: no query, no fragment, no trailing slash. */
export function pathOf(urlOrPath: string): string {
  let p = urlOrPath;
  if (/^https?:\/\//i.test(urlOrPath)) {
    try {
      p = new URL(urlOrPath).pathname;
    } catch {
      p = '/';
    }
  }
  p = p.split('?')[0].split('#')[0].replace(/\/+$/, '');
  return p === '' ? '/' : p;
}

export function classify(urlOrPath: string): Classified {
  const path = pathOf(urlOrPath);
  const seg = path.split('/').filter(Boolean);
  const out = (type: PageType, city = '', locality = '', service = ''): Classified => ({ path, type, city, locality, service });
  if (path === '/') return out('home');
  if (seg[0] === 'services') {
    if (seg.length === 1) return out('trust');
    if (seg.length === 2) return out('service-hub', '', '', seg[1]);
    if (seg.length === 3 && CITY_BY_SLUG.has(seg[2] as never)) return out('service-city', seg[2], '', seg[1]);
    return out('other');
  }
  if (seg[0] === 'pincode') return out('pincode', seg[1] ? (PINCODE_BY_PIN.get(seg[1])?.city ?? '') : '');
  if (seg[0] === 'blog') return out('blog');
  if (!CITY_BY_SLUG.has(seg[0] as never)) return out(seg.length === 1 ? 'trust' : 'other');
  const city = seg[0];
  if (seg.length === 1) return out('city', city);
  if (seg.length === 2) return LOCALITY_PATHS.has(`${city}/${seg[1]}`) ? out('locality', city, seg[1]) : out('zone', city);
  if (seg.length === 3) {
    if (SERVICE_BY_SLUG.has(seg[2] as never)) return out('service-locality', city, seg[1], seg[2]);
    return out('entity', city, seg[1]);
  }
  return out('other', city);
}

/** The city bucket a page's numbers roll up into: its city slug, 'national' for hubs, else 'other'. */
export function cityBucket(c: Classified): string {
  if (c.city) return c.city;
  return NATIONAL_TYPES.has(c.type) ? 'national' : 'other';
}

export const TIER1_CITIES: string[] = CITIES.filter((c) => c.tier === 1).map((c) => c.slug);
export const TIER2_CITIES: string[] = CITIES.filter((c) => c.tier === 2).map((c) => c.slug);
/** Every city, Tier 1 first — the row order of every report table. */
export const CITIES_BY_TIER: string[] = [...TIER1_CITIES, ...TIER2_CITIES];

export function tierOf(city: string): 1 | 2 | null {
  return CITY_BY_SLUG.get(city as never)?.tier ?? null;
}
