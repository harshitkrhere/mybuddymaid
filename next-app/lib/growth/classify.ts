// lib/growth/classify.ts — one classifier for every growth report. A URL or path becomes
// {type, city, locality, service} against the page architecture, so Search Console, GA4,
// Bing and the inspection ledger all aggregate the same way. Extracted from
// scripts/seo/gsc-report.ts, which now imports it.
import { ALL_LOCALITIES, CITIES, CITY_BY_SLUG, PINCODE_BY_PIN, SERVICE_BY_SLUG } from '@/data/seo';
import redirectMap from '@/lib/seo-engine/redirect-map.json';

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
  // the old site's URLs: still in Search Console and still clicked for weeks after the relaunch
  | 'legacy-redirected'
  | 'legacy-gone'
  | 'other';

export interface Classified {
  path: string;
  type: PageType;
  city: string;
  locality: string;
  service: string;
  /** For a retired URL that redirects: the live path it lands on, and that page's type. */
  target?: string;
  targetType?: PageType;
}

/** Page types whose demand is not attributable to one city; they aggregate under 'national'. */
export const NATIONAL_TYPES: ReadonlySet<PageType> = new Set<PageType>(['home', 'service-hub', 'trust', 'blog']);

const LOCALITY_PATHS = new Set(ALL_LOCALITIES.map((l) => `${l.city}/${l.slug}`));

// The relaunch map (scripts/seo/gen-redirects.ts): 985 old URLs that redirect, 2,848 that are gone.
// Retired URLs drew most of the site's Google clicks in the weeks after 2026-09-07, and until they
// had their own types the classifier filed every one of them under 'trust' (any unknown one-segment
// path), so the per-city and national numbers were both wrong and the relaunch cliff was invisible.
const REDIRECTS = redirectMap.redirects as Record<string, string>;
const GONE = new Set(redirectMap.gone as string[]);
/** The one-segment paths that really are trust pages; anything else unknown is 'other'. */
const TRUST_SLUGS = new Set(['about', 'contact', 'pricing', 'how-we-verify', 'replacement-policy', 'terms-of-service', 'privacy-policy']);

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

export function classify(urlOrPath: string, depth = 0): Classified {
  const path = pathOf(urlOrPath);
  const seg = path.split('/').filter(Boolean);
  const out = (type: PageType, city = '', locality = '', service = ''): Classified => ({ path, type, city, locality, service });
  if (path === '/') return out('home');
  if (GONE.has(path)) return out('legacy-gone');
  const target = REDIRECTS[path];
  if (target !== undefined && target !== path && depth < 3) {
    // attributed to the page the visitor lands on, so a city's clicks include its old URLs
    const t = classify(target, depth + 1);
    return { path, type: 'legacy-redirected', city: t.city, locality: t.locality, service: t.service, target: t.path, targetType: t.type };
  }
  if (seg[0] === 'services') {
    if (seg.length === 1) return out('trust');
    if (seg.length === 2) return out('service-hub', '', '', seg[1]);
    if (seg.length === 3 && CITY_BY_SLUG.has(seg[2] as never)) return out('service-city', seg[2], '', seg[1]);
    return out('other');
  }
  if (seg[0] === 'pincode') return out('pincode', seg[1] ? (PINCODE_BY_PIN.get(seg[1])?.city ?? '') : '');
  if (seg[0] === 'blog') return out('blog');
  if (!CITY_BY_SLUG.has(seg[0] as never)) return out(seg.length === 1 && TRUST_SLUGS.has(seg[0]) ? 'trust' : 'other');
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
  const type = c.type === 'legacy-redirected' && c.targetType ? c.targetType : c.type;
  return NATIONAL_TYPES.has(type) ? 'national' : 'other';
}

export const TIER1_CITIES: string[] = CITIES.filter((c) => c.tier === 1).map((c) => c.slug);
export const TIER2_CITIES: string[] = CITIES.filter((c) => c.tier === 2).map((c) => c.slug);
/** Every city, Tier 1 first — the row order of every report table. */
export const CITIES_BY_TIER: string[] = [...TIER1_CITIES, ...TIER2_CITIES];

export function tierOf(city: string): 1 | 2 | null {
  return CITY_BY_SLUG.get(city as never)?.tier ?? null;
}
