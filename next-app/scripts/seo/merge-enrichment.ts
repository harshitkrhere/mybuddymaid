// scripts/seo/merge-enrichment.ts — merges agent-drafted fragment JSONs into the
// canonical generated files:
//   fragments/<batch>.json      -> localities/enrichment/<city>.json (per-slug merge)
//   fragments/faq-pools.json    -> faqs/service-faqs.ts + faqs/shared-faqs.ts
//   fragments/city-content.json -> content/city-content.json
//   fragments/zone-content.json -> content/zone-content.json
// Coordinates are re-applied from scripts/seo/.geocode-cache.json (city-qualified keys),
// so this script fully rebuilds each enrichment file and is safe to re-run.
// Symmetrises neighbour edges at the end.
//
// IMPORTANT: fragments are keyed by BATCH -> CITY below, never by slug lookup. Sector
// slugs such as `sector-50` exist in more than one city (Noida and Gurgaon both have
// one), so a slug-keyed merge silently writes a locality into the wrong city.
// Run: npx tsx scripts/seo/merge-enrichment.ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ALL_LOCALITIES } from '../../data/seo';

const ROOT = process.cwd();
const FRAG = path.join(ROOT, 'data', 'seo', 'localities', 'enrichment', 'fragments');
const ENR = path.join(ROOT, 'data', 'seo', 'localities', 'enrichment');
const CONTENT = path.join(ROOT, 'data', 'seo', 'content');
const FAQS = path.join(ROOT, 'data', 'seo', 'faqs');
const GEOCACHE = path.join(ROOT, 'scripts', 'seo', '.geocode-cache.json');

/** fragment basename (without .json) -> city slug. */
const BATCH_CITY: Record<string, string> = {
  'delhi-south-a': 'delhi',
  'delhi-south-b': 'delhi',
  'delhi-central-north': 'delhi',
  'delhi-northwest': 'delhi',
  'delhi-west': 'delhi',
  'delhi-southwest': 'delhi',
  'delhi-east-ne': 'delhi',
  'noida-central-a': 'noida',
  'noida-central-b': 'noida',
  'noida-expressway': 'noida',
  'greater-noida': 'greater-noida',
  'gurgaon-dlf': 'gurgaon',
  'gurgaon-sohna': 'gurgaon',
  'gurgaon-new-old': 'gurgaon',
  'mumbai-south': 'mumbai',
  'mumbai-western': 'mumbai',
  'mumbai-central-east-navi': 'mumbai',
  'pune-west-pcmc': 'pune',
  'pune-rest': 'pune',
  'bangalore-east-se': 'bangalore',
  'bangalore-rest': 'bangalore',
  mangalore: 'mangalore',
};

const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p: string, v: unknown) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
};

if (!fs.existsSync(FRAG)) {
  console.error(`No fragments directory at ${FRAG}`);
  process.exit(1);
}

const validSlugs = new Set(ALL_LOCALITIES.map((l) => `${l.city}/${l.slug}`));
const perCity: Record<string, Record<string, Record<string, unknown>>> = {};
let merged = 0;
let unknown = 0;

for (const file of fs.readdirSync(FRAG).filter((f) => f.endsWith('.json'))) {
  const base = file.replace(/\.json$/, '');
  const city = BATCH_CITY[base];
  if (!city) continue; // faq-pools / city-content / zone-content handled below
  const frag = readJson(path.join(FRAG, file)) as Record<string, Record<string, unknown>>;
  perCity[city] ??= {};
  for (const [slug, enr] of Object.entries(frag)) {
    if (!validSlugs.has(`${city}/${slug}`)) {
      console.warn(`  WARN ${file}: '${slug}' is not a ${city} locality — skipped`);
      unknown++;
      continue;
    }
    perCity[city][slug] = { ...(perCity[city][slug] ?? {}), ...enr };
    merged++;
  }
}

// Re-apply cached coordinates (keys are `city/slug`, so no cross-city collisions).
if (fs.existsSync(GEOCACHE)) {
  const cache = readJson(GEOCACHE) as Record<string, { lat: number; lng: number } | null>;
  let coords = 0;
  for (const [key, hit] of Object.entries(cache)) {
    if (!hit) continue;
    const [city, slug] = key.split('/');
    if (!perCity[city]?.[slug]) continue;
    const existing = perCity[city][slug] as { sourceRefs?: string[] };
    perCity[city][slug] = {
      ...existing,
      lat: Number(hit.lat.toFixed(5)),
      lng: Number(hit.lng.toFixed(5)),
      sourceRefs: [...new Set([...(existing.sourceRefs ?? []), 'OpenStreetMap Nominatim (ODbL 1.0)'])],
    };
    coords++;
  }
  console.log(`  applied ${coords} cached coordinate pairs`);
}

// Symmetrise neighbours within each city, dropping references to unknown slugs.
for (const [city, map] of Object.entries(perCity)) {
  for (const [slug, enr] of Object.entries(map) as [string, { neighbours?: string[] }][]) {
    enr.neighbours = (enr.neighbours ?? []).filter((n) => n !== slug && validSlugs.has(`${city}/${n}`));
  }
  for (const [slug, enr] of Object.entries(map) as [string, { neighbours?: string[] }][]) {
    for (const n of enr.neighbours ?? []) {
      const other = map[n] as { neighbours?: string[] } | undefined;
      if (!other) continue;
      other.neighbours ??= [];
      if (!other.neighbours.includes(slug)) other.neighbours.push(slug);
    }
  }
  writeJson(path.join(ENR, `${city}.json`), map);
  console.log(`  wrote enrichment/${city}.json (${Object.keys(map).length} localities)`);
}

// FAQ pools -> generated TS modules.
const faqPoolsPath = path.join(FRAG, 'faq-pools.json');
if (fs.existsSync(faqPoolsPath)) {
  const pools = readJson(faqPoolsPath) as { services: Record<string, unknown[]>; global: unknown[]; housing: Record<string, unknown[]> };
  fs.writeFileSync(
    path.join(FAQS, 'service-faqs.ts'),
    `// GENERATED by scripts/seo/merge-enrichment.ts — do not edit by hand.
// data/seo/faqs/service-faqs.ts — per-service FAQ pools (>= 8 each, brief §5).
import type { FAQ } from '../types';

export const SERVICE_FAQ_POOLS: Record<string, FAQ[]> = ${JSON.stringify(pools.services, null, 2)};
`,
  );
  fs.writeFileSync(
    path.join(FAQS, 'shared-faqs.ts'),
    `// GENERATED by scripts/seo/merge-enrichment.ts — do not edit by hand.
// data/seo/faqs/shared-faqs.ts — global + housing-profile FAQ pools (brief §6.3).
import type { FAQ } from '../types';

export const GLOBAL_FAQS: FAQ[] = ${JSON.stringify(pools.global, null, 2)};

export const HOUSING_FAQ_POOLS: Record<string, FAQ[]> = ${JSON.stringify(pools.housing, null, 2)};
`,
  );
  console.log(`  wrote faqs/service-faqs.ts (${Object.values(pools.services).flat().length} FAQs) + faqs/shared-faqs.ts`);
}

for (const frag of ['city-content.json', 'zone-content.json'] as const) {
  const p = path.join(FRAG, frag);
  if (fs.existsSync(p)) {
    writeJson(path.join(CONTENT, frag), readJson(p));
    console.log(`  wrote content/${frag}`);
  }
}

console.log(`merge-enrichment: merged ${merged} locality fragments (${unknown} skipped as wrong-city/unknown)`);
