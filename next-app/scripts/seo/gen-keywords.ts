// scripts/seo/gen-keywords.ts — generates docs/seo/keywords.csv, the rank-tracking set.
// Contains every "TOP SEO PAGES" query from Appendix C plus the 15 Appendix-D on-page
// variants for each very-high-priority locality, each mapped to the single URL that owns
// it. Keyword variants never get their own URL: the mapping proves it.
// Run: npx tsx scripts/seo/gen-keywords.ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ALL_LOCALITIES, CITIES, SERVICES, ZONES } from '../../data/seo';
import { gateFor } from '../../lib/seo-engine/gate';
import { paths } from '../../lib/seo-engine/links';

interface Row {
  keyword: string;
  target: string;
  city: string;
  priority: string;
  page_type: string;
}

const rows: Row[] = [];
const seen = new Set<string>();
const add = (keyword: string, target: string, city: string, priority: string, page_type: string) => {
  const k = keyword.toLowerCase().replace(/\s+/g, ' ').trim();
  if (seen.has(k)) return;
  seen.add(k);
  rows.push({ keyword: k, target, city, priority, page_type });
};

// ---- national + brand ----
add('maid service', '/', 'national', 'very-high', 'home');
add('maid service india', '/services/maid-service', 'national', 'high', 'service-hub');
add('domestic help agency india', '/services/maid-service', 'national', 'high', 'service-hub');
for (const s of SERVICES) {
  add(`${s.name.toLowerCase()} service`, paths.serviceHub(s.slug), 'national', 'high', 'service-hub');
  for (const alt of s.altNames.slice(0, 3)) add(`${alt} india`, paths.serviceHub(s.slug), 'national', 'medium', 'service-hub');
}

// ---- city head terms, including the alt-name variants that share one page ----
for (const c of CITIES) {
  const p = paths.city(c.slug);
  add(`maid service in ${c.name}`, p, c.slug, 'very-high', 'city');
  add(`maid agency in ${c.name}`, p, c.slug, 'high', 'city');
  add(`domestic help in ${c.name}`, p, c.slug, 'high', 'city');
  add(`best maid service in ${c.name}`, p, c.slug, 'high', 'city');
  add(`verified maid service in ${c.name}`, p, c.slug, 'high', 'city');
  for (const alt of c.altNames) add(`maid service in ${alt}`, p, c.slug, 'very-high', 'city (alt name, same page)');
  for (const s of SERVICES) {
    add(`${s.name.toLowerCase()} in ${c.name}`, paths.serviceCity(s.slug, c.slug), c.slug, 'high', 'service-city');
  }
}

// ---- zone head terms ----
for (const z of ZONES) {
  const city = CITIES.find((c) => c.slug === z.city)!;
  add(`maid service in ${z.name}`, paths.zone(z.city, z.slug), z.city, 'high', 'zone');
  add(`maid service in ${z.name} ${city.name}`, paths.zone(z.city, z.slug), z.city, 'medium', 'zone');
}

// ---- locality terms: the Appendix D family of 15, mapped across 7 pages ----
const HUB_VARIANTS = (name: string) => [
  `maid service in ${name}`,
  `maid agency in ${name}`,
  `maid provider in ${name}`,
  `house maid in ${name}`,
  `housemaid in ${name}`,
  `professional maid service in ${name}`,
  `best maid service in ${name}`,
  `verified maid service in ${name}`,
  `reliable maid service in ${name}`,
  `maid near me ${name}`,
];
const SERVICE_VARIANTS: Record<string, (n: string) => string[]> = {
  'full-time-maid': (n) => [`full time maid in ${n}`, `live in maid in ${n}`, `24 hours maid in ${n}`],
  'part-time-maid': (n) => [`part time maid in ${n}`, `hourly maid in ${n}`, `morning maid in ${n}`],
  cook: (n) => [`cook service in ${n}`, `home cook in ${n}`, `cook in ${n}`],
  'babysitter-nanny': (n) => [`babysitter in ${n}`, `nanny service in ${n}`, `japa maid in ${n}`],
  'elder-care': (n) => [`elder care maid in ${n}`, `caretaker for elderly in ${n}`],
  'domestic-help': (n) => [`domestic help in ${n}`, `house help in ${n}`],
};

for (const l of ALL_LOCALITIES) {
  const hub = paths.locality(l.city, l.slug);
  const priority = l.priority;
  const names = [l.name, ...l.altNames];
  // the umbrella family is owned by the locality hub, never by its own URL
  if (priority === 'very-high') {
    for (const v of HUB_VARIANTS(l.name)) add(v, hub, l.city, priority, 'locality hub');
    for (const alt of l.altNames) add(`maid service in ${alt}`, hub, l.city, priority, 'locality hub (alt name, same page)');
  } else {
    add(`maid service in ${l.name}`, hub, l.city, priority, 'locality hub');
    add(`maid agency in ${l.name}`, hub, l.city, priority, 'locality hub');
    add(`domestic help in ${l.name}`, hub, l.city, priority, 'locality hub');
  }
  // service families own their own URL
  for (const s of SERVICES) {
    const target = paths.serviceLocality(l.city, l.slug, s.slug);
    const variants = priority === 'very-high' ? (SERVICE_VARIANTS[s.slug]?.(l.name) ?? []) : [`${s.name.toLowerCase()} in ${l.name}`];
    for (const v of variants) add(v, target, l.city, priority, `service x locality (${s.slug})`);
  }
  void names;
}

// ---- trust queries ----
add('mybuddymaid', '/', 'brand', 'very-high', 'home');
add('mybuddymaid reviews', '/about', 'brand', 'high', 'trust');
add('maid police verification process', '/how-we-verify', 'national', 'high', 'trust');
add('maid replacement policy', '/replacement-policy', 'national', 'high', 'trust');
add('maid service charges india', '/pricing', 'national', 'high', 'trust');

// mark any target that is currently noindexed so tracking does not chase a gated page
const out = ['keyword,target_url,city,priority,page_type,target_indexable'];
for (const r of rows) {
  const g = gateFor(r.target);
  out.push(`"${r.keyword}",${r.target},${r.city},${r.priority},"${r.page_type}",${g.index ? 'yes' : 'no'}`);
}
const file = path.resolve(process.cwd(), '..', 'docs', 'seo', 'keywords.csv');
fs.writeFileSync(file, out.join('\n') + '\n');

const byType = new Map<string, number>();
for (const r of rows) byType.set(r.page_type.split(' (')[0], (byType.get(r.page_type.split(' (')[0]) ?? 0) + 1);
console.log(`gen-keywords: ${rows.length} tracked keywords -> docs/seo/keywords.csv`);
for (const [t, n] of [...byType].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${t}`);
const gated = rows.filter((r) => !gateFor(r.target).index).length;
console.log(`  ${gated} keywords point at a currently-noindexed target (see quality-report.md)`);
