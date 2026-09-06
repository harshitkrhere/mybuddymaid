// scripts/seo/gen-redirects.ts — builds the legacy→new redirect map from the ACTUAL
// legacy page files (ground truth), the legacy generator data, and the new data layer.
// Outputs:
//   ../docs/seo/redirects.csv            (old_path,new_path,status,reason — auditable)
//   lib/seo-engine/redirect-map.json     (loaded by proxy.ts middleware)
// Decisions applied (docs/seo/ASSUMPTIONS.md): out-of-footprint cities → 410;
// non-Appendix-B localities in footprint cities → 301 to city hub; postnatal-care →
// babysitter-nanny; legacy "maid" service → locality/city/zone hubs; salary guides →
// /pricing (footprint) or 410; state pages → 410; blog kept at /blog/*.
// Run: npx tsx scripts/seo/gen-redirects.ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ALL_LOCALITIES, ZONES } from '../../data/seo';

const ROOT = process.cwd(); // next-app/
const REPO = path.resolve(ROOT, '..');
const LEGACY = path.join(REPO, 'mybuddymaid');

// ---------------- legacy vocab ----------------
const LEGACY_SERVICES = ['full-time-maid', 'elderly-care', 'postnatal-care', 'maid', 'cook', 'nanny'] as const; // longest-first matters
const NEW_SERVICE: Record<string, string | null> = {
  maid: null,
  'full-time-maid': 'full-time-maid',
  cook: 'cook',
  nanny: 'babysitter-nanny',
  'elderly-care': 'elder-care',
  'postnatal-care': 'babysitter-nanny',
};
const legacyCities: string[] = JSON.parse(
  fs.readFileSync(path.join(REPO, 'seo-generator', 'data', 'cities.json'), 'utf8'),
).map((c: { slug: string }) => c.slug);
// longest-first so 'navi-mumbai' beats 'mumbai'
legacyCities.sort((a, b) => b.length - a.length);

const NEW_CITY: Record<string, string> = {
  delhi: 'delhi',
  noida: 'noida',
  gurugram: 'gurgaon',
  mumbai: 'mumbai',
  'navi-mumbai': 'mumbai',
  pune: 'pune',
  bangalore: 'bangalore',
  mangalore: 'mangalore',
};

// ---------------- new-layer lookup ----------------
const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const locByCity = new Map<string, Map<string, string>>(); // city -> (matchSlug -> canonical slug)
for (const l of ALL_LOCALITIES) {
  const m = locByCity.get(l.city) ?? new Map<string, string>();
  m.set(l.slug, l.slug);
  for (const alt of l.altNames) if (!m.has(slugify(alt))) m.set(slugify(alt), l.slug);
  locByCity.set(l.city, m);
}
const zoneByCity = new Map<string, Set<string>>();
for (const z of ZONES) {
  const s = zoneByCity.get(z.city) ?? new Set<string>();
  s.add(z.slug);
  zoneByCity.set(z.city, s);
}

/** Full legacy locality slug (incl. city suffix) → new "city/locality". Applied first. */
const MANUAL_LOC: Record<string, string> = {
  'south-city-gurugram': 'gurgaon/south-city-1',
  'gaur-city-noida': 'greater-noida/gaur-city',
  'jaypee-greens-noida': 'greater-noida/jaypee-greens',
  'pari-chowk-noida': 'greater-noida/pari-chowk',
  'sector-56-57-gurugram': 'gurgaon/sector-56',
  'sector-45-48-gurugram': 'gurgaon/sector-45',
  'sector-67-70-gurugram': 'gurgaon/sector-67',
  'sector-82-84-gurugram': 'gurgaon/sector-82',
  'sector-75-76-noida': 'noida/sector-75',
  'sector-93-96-noida': 'noida/sector-93',
  'shivaji-nagar-pune': 'pune/shivajinagar',
};
/** Full legacy locality slug → new "city/zone" (range/belt pages → zone hubs). */
const MANUAL_ZONE: Record<string, string> = {
  'noida-extension-noida': 'greater-noida/greater-noida-west',
  'greater-noida-west-noida': 'greater-noida/greater-noida-west',
  'dlf-phase-1-5-gurugram': 'gurgaon/dlf-golf-course-road',
  'expressway-noida': 'noida/noida-expressway',
  'sector-128-134-noida': 'noida/noida-expressway',
  'pimpri-chinchwad-pune': 'pune/pcmc',
};

// ---------------- output rows ----------------
type Row = { old: string; to: string; status: 301 | 410; reason: string };
const rows: Row[] = [];
const seen = new Set<string>();
const add = (old: string, to: string, status: 301 | 410, reason: string) => {
  if (seen.has(old)) return;
  seen.add(old);
  rows.push({ old, to, status, reason });
};
const unmatched: string[] = [];

function mapCityLevel(legacySvc: string, legacyCity: string, old: string, family: string) {
  const nc = NEW_CITY[legacyCity];
  if (!nc) return add(old, '', 410, `${family}: city '${legacyCity}' outside footprint`);
  const ns = NEW_SERVICE[legacySvc];
  if (ns === null) return add(old, `/${nc}`, 301, `${family}: umbrella maid → city hub`);
  add(old, `/services/${ns}/${nc}`, 301, `${family}: service×city`);
}

function mapLocality(legacySvc: string, base: string, legacyCity: string, old: string) {
  const nc = NEW_CITY[legacyCity];
  if (!nc) return add(old, '', 410, `locality page in out-of-footprint city '${legacyCity}'`);
  const ns = NEW_SERVICE[legacySvc];
  const manualLoc = MANUAL_LOC[`${base}-${legacyCity}`];
  if (manualLoc) {
    return add(old, ns === null ? `/${manualLoc}` : `/${manualLoc}/${ns}`, 301, 'manual locality mapping');
  }
  const manualZone = MANUAL_ZONE[`${base}-${legacyCity}`];
  if (manualZone) {
    const zoneCity = manualZone.split('/')[0];
    return add(old, ns === null ? `/${manualZone}` : `/services/${ns}/${zoneCity}`, 301, 'manual zone mapping');
  }
  const loc = locByCity.get(nc)?.get(base);
  if (loc) {
    if (ns === null) return add(old, `/${nc}/${loc}`, 301, 'maid → locality hub');
    return add(old, `/${nc}/${loc}/${ns}`, 301, 'service×locality');
  }
  if (zoneByCity.get(nc)?.has(base)) {
    if (ns === null) return add(old, `/${nc}/${base}`, 301, 'maid → zone hub');
    return add(old, `/services/${ns}/${nc}`, 301, 'service×zone → service×city (no zone service pages)');
  }
  // Navi Mumbai legacy city: its unmatched localities land on the navi-mumbai zone hub.
  if (legacyCity === 'navi-mumbai') {
    unmatched.push(`${base}-${legacyCity}`);
    return add(old, ns === null ? '/mumbai/navi-mumbai' : `/services/${ns}/mumbai`, 301, 'unmatched navi-mumbai locality → zone/service hub');
  }
  unmatched.push(`${base}-${legacyCity}`);
  if (ns === null) return add(old, `/${nc}`, 301, 'unmatched locality → city hub (ASSUMPTIONS #5)');
  add(old, `/services/${ns}/${nc}`, 301, 'unmatched locality → service×city (ASSUMPTIONS #5)');
}

// ---------------- walk legacy files ----------------
const top = fs.readdirSync(LEGACY).filter((f) => f.endsWith('.html'));
for (const f of top) {
  const name = f.replace(/\.html$/, '');
  const old = `/${name}`;

  // best-{svc}-service-in-{city}
  let m = name.match(/^best-(.+)-service-in-(.+)$/);
  if (m && (LEGACY_SERVICES as readonly string[]).includes(m[1])) {
    mapCityLevel(m[1], m[2], old, 'best-service-in-city');
    continue;
  }
  // domestic-help-salary-in-{city}-2026
  m = name.match(/^domestic-help-salary-in-(.+)-2026$/);
  if (m) {
    const nc = NEW_CITY[m[1]];
    if (nc) add(old, '/pricing', 301, 'salary guide → pricing (ASSUMPTIONS #6)');
    else add(old, '', 410, 'salary guide in out-of-footprint city');
    continue;
  }
  // {svc}-service-in-{loc}
  m = name.match(/^(.+?)-service-in-(.+)$/);
  if (m && (LEGACY_SERVICES as readonly string[]).includes(m[1])) {
    const loc = m[2];
    const asCity = legacyCities.find((c) => c === loc);
    if (asCity) {
      mapCityLevel(m[1], asCity, old, 'service-in-city');
      continue;
    }
    const suffixCity = legacyCities.find((c) => loc.endsWith(`-${c}`));
    if (suffixCity) {
      mapLocality(m[1], loc.slice(0, -(suffixCity.length + 1)), suffixCity, old);
      continue;
    }
    unmatched.push(loc);
    add(old, '', 410, 'service-in-? — no city suffix recognized');
    continue;
  }
  // {svc}-service hubs
  m = name.match(/^(.+)-service$/);
  if (m && (LEGACY_SERVICES as readonly string[]).includes(m[1])) {
    const ns = NEW_SERVICE[m[1]];
    add(old, ns === null ? '/services/maid-service' : `/services/${ns}`, 301, 'service hub');
    continue;
  }
  // flat legacy blog
  m = name.match(/^blog-(.+)$/);
  if (m) {
    add(old, `/blog/${m[1]}`, 301, 'flat legacy blog → /blog/*');
    continue;
  }
  // known singles
  const singles: Record<string, [string, 301 | 410, string]> = {
    index: ['/', 301, 'home'],
    cities: ['/', 301, 'cities index → home city grid'],
    blog: ['/blog', 301, 'blog index (kept)'],
    services: ['/services', 301, 'services index (rebuilt at same URL)'],
    'salary-guides': ['/pricing', 301, 'salary guides hub → pricing'],
  };
  if (singles[name]) {
    const [to, st, why] = singles[name];
    if (to !== old) add(old, to, st, why);
    continue;
  }
  // comparison / guide singles → blog
  add(old, `/blog/${name}`, 301, 'comparison/guide → blog');
}

// subfolders
for (const f of fs.readdirSync(path.join(LEGACY, 'cities')).filter((f2) => f2.endsWith('.html'))) {
  const city = f.replace(/\.html$/, '');
  const nc = NEW_CITY[city];
  if (nc) add(`/cities/${city}`, `/${nc}`, 301, 'city hub moved');
  else add(`/cities/${city}`, '', 410, 'city hub outside footprint');
}
for (const f of fs.readdirSync(path.join(LEGACY, 'state')).filter((f2) => f2.endsWith('.html'))) {
  add(`/state/${f.replace(/\.html$/, '')}`, '', 410, 'state pages retired (never in sitemap)');
}
// blog/* is KEPT at the same URLs (ported route) — no redirect rows needed.

// SPA route moves (booking app relocates to /app/*, ASSUMPTIONS #1)
const spaMoves: [string, string][] = [
  ['/home', '/app'],
  ['/auth', '/app/auth'],
  ['/splash', '/app/splash'],
  ['/onboarding', '/app/onboarding'],
  ['/bookings', '/app/bookings'],
  ['/profile', '/app/profile'],
  ['/terms', '/terms-of-service'],
];
for (const [from, to] of spaMoves) add(from, to, 301, 'SPA moved under /app');
// Legacy SPA service deep links (ids that do not collide with new /services/[service] hubs;
// /services/cook now resolves to the indexable cook hub, which links into the app).
for (const id of ['part-time', 'full-time', 'elderly-care', 'nanny', 'postnatal'])
  add(`/services/${id}`, `/app/services/${id}`, 301, 'SPA service deep link moved under /app');
// old next-app marketing slugs (never deployed, kept for safety)
add('/about-us', '/about', 301, 'trust page rename');
add('/contact-us', '/contact', 301, 'trust page rename');

// ---------------- emit ----------------
rows.sort((a, b) => a.old.localeCompare(b.old));
const csv = ['old_path,new_path,status,reason', ...rows.map((r) => `${r.old},${r.to},${r.status},"${r.reason}"`)].join('\n');
fs.mkdirSync(path.join(REPO, 'docs', 'seo'), { recursive: true });
fs.writeFileSync(path.join(REPO, 'docs', 'seo', 'redirects.csv'), csv + '\n');

const map: { redirects: Record<string, string>; gone: string[] } = { redirects: {}, gone: [] };
for (const r of rows) {
  if (r.status === 301) map.redirects[r.old] = r.to;
  else map.gone.push(r.old);
}
fs.writeFileSync(path.join(ROOT, 'lib', 'seo-engine', 'redirect-map.json'), JSON.stringify(map) + '\n');

const c301 = rows.filter((r) => r.status === 301).length;
const c410 = rows.filter((r) => r.status === 410).length;
console.log(`gen-redirects: ${rows.length} rows (${c301} × 301, ${c410} × 410) → docs/seo/redirects.csv + lib/seo-engine/redirect-map.json`);
if (unmatched.length) {
  const uniq = [...new Set(unmatched)].sort();
  console.log(`\n${uniq.length} distinct unmatched footprint-city localities (fell back per ASSUMPTIONS #5):`);
  for (const u of uniq) console.log(`  ${u}`);
}
