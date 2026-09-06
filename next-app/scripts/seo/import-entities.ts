// scripts/seo/import-entities.ts — Phase 5 entity importer (societies, sectors,
// landmarks, metro-station catchments inside Appendix-B localities).
//
// Sources, in order of preference:
//   1. an operator CSV:  npx tsx scripts/seo/import-entities.ts --csv path/to/file.csv
//      columns: name,locality,city,kind,pincode[,fact:<label>...]
//   2. OpenStreetMap via Overpass (attributed ODbL, no competitor scraping):
//      npx tsx scripts/seo/import-entities.ts --osm --city gurgaon --locality dlf-phase-1
//
// Everything is imported as status "draft". A draft entity has NO URL at all — not a
// noindexed page, no page. `--promote` re-evaluates the readiness gate and moves entities
// with >= 5 entity-specific facts to "ready"; the operator approves the rest by hand.
//   npx tsx scripts/seo/import-entities.ts --promote
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ALL_LOCALITIES, CITY_BY_SLUG, LOCALITY_BY_PATH, RESERVED_SLUGS } from '../../data/seo';
import { MIN_ENTITY_FACTS } from '../../data/seo/entities';
import type { Entity, EntityKind } from '../../data/seo/types';

const ROOT = process.cwd();
const STORE = path.join(ROOT, 'data', 'seo', 'entities.json');
const args = process.argv.slice(2);
const argValue = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

const existing: Entity[] = fs.existsSync(STORE) ? JSON.parse(fs.readFileSync(STORE, 'utf8')) : [];
const byKey = new Map(existing.map((e) => [`${e.city}/${e.locality}/${e.slug}`, e]));
const TODAY = process.env.IMPORT_DATE ?? '2026-09-06';

function add(e: Entity): 'added' | 'updated' | 'rejected' {
  if (!LOCALITY_BY_PATH.has(`${e.city}/${e.locality}`)) return 'rejected';
  if (RESERVED_SLUGS.has(e.slug)) return 'rejected';
  // an entity slug must not collide with a service slug or a sibling locality
  if (ALL_LOCALITIES.some((l) => l.city === e.city && l.slug === e.slug)) return 'rejected';
  const key = `${e.city}/${e.locality}/${e.slug}`;
  const prev = byKey.get(key);
  if (prev) {
    // never downgrade a live entity, and never silently overwrite approved facts
    byKey.set(key, { ...prev, ...e, status: prev.status === 'live' ? 'live' : e.status, facts: { ...e.facts, ...prev.facts } });
    return 'updated';
  }
  byKey.set(key, e);
  return 'added';
}

// ---------------------------------------------------------------------------
// CSV import
// ---------------------------------------------------------------------------
function importCsv(file: string) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(',').map((h) => h.trim());
  let added = 0;
  let updated = 0;
  let rejected = 0;
  for (const line of lines.slice(1)) {
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim()) ?? [];
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cells[i] ?? ''));
    const city = row.city?.trim();
    const locality = row.locality?.trim();
    if (!row.name || !city || !locality) {
      rejected++;
      continue;
    }
    const facts: Record<string, string> = {};
    for (const h of header) if (h.startsWith('fact:') && row[h]) facts[h.slice(5)] = row[h];
    const loc = LOCALITY_BY_PATH.get(`${city}/${locality}`);
    if (loc) {
      // free, always-true facts derived from the parent locality
      facts['Parent locality'] ??= `${loc.name}, ${CITY_BY_SLUG.get(loc.city)!.name}`;
      facts['Pincode'] ??= row.pincode || loc.pincodes[0];
      facts['Housing type'] ??= loc.housingProfile.replace(/-/g, ' ');
      if (loc.landmarks.length) facts['Nearest landmark'] ??= loc.landmarks[0];
    }
    const e: Entity = {
      slug: slugify(row.name),
      city: city as Entity['city'],
      locality,
      kind: ((row.kind || 'society') as EntityKind),
      name: row.name,
      altNames: row.altNames ? row.altNames.split('|').map((s) => s.trim()).filter(Boolean) : [],
      pincode: row.pincode || LOCALITY_BY_PATH.get(`${city}/${locality}`)?.pincodes[0] || '',
      facts,
      source: row.source || `operator CSV ${path.basename(file)}`,
      licence: row.licence || 'operator-supplied',
      status: 'draft',
      updatedAt: TODAY,
    };
    const r = add(e);
    if (r === 'added') added++;
    else if (r === 'updated') updated++;
    else rejected++;
  }
  console.log(`CSV import: ${added} added, ${updated} updated, ${rejected} rejected`);
}

// ---------------------------------------------------------------------------
// OpenStreetMap (Overpass) candidate import — ODbL, attributed
// ---------------------------------------------------------------------------
async function importOsm(city: string, localitySlug: string) {
  const loc = LOCALITY_BY_PATH.get(`${city}/${localitySlug}`);
  if (!loc) {
    console.error(`Unknown locality ${city}/${localitySlug}`);
    process.exit(1);
  }
  if (!loc.lat || !loc.lng) {
    console.error(`${city}/${localitySlug} has no coordinates — run scripts/seo/geocode.ts first`);
    process.exit(1);
  }
  const r = 1200; // metres
  const query = `[out:json][timeout:60];
(
  way["landuse"="residential"]["name"](around:${r},${loc.lat},${loc.lng});
  way["building"="residential"]["name"](around:${r},${loc.lat},${loc.lng});
  node["place"="neighbourhood"]["name"](around:${r},${loc.lat},${loc.lng});
  node["railway"="station"]["station"="subway"]["name"](around:${r},${loc.lat},${loc.lng});
);
out center tags 200;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'User-Agent': 'MyBuddyMaid-SEO/1.0 (info@mybuddymaid.in)' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) {
    console.error(`Overpass returned ${res.status}`);
    process.exit(1);
  }
  const data = (await res.json()) as { elements: { tags?: Record<string, string>; lat?: number; lon?: number; center?: { lat: number; lon: number } }[] };
  let added = 0;
  let rejected = 0;
  for (const el of data.elements) {
    const name = el.tags?.name;
    if (!name) continue;
    const kind: EntityKind = el.tags?.railway === 'station' ? 'metro-station' : el.tags?.place === 'neighbourhood' ? 'landmark' : 'society';
    const point = el.center ?? { lat: el.lat, lon: el.lon };
    const e: Entity = {
      slug: slugify(name),
      city: city as Entity['city'],
      locality: localitySlug,
      kind,
      name,
      altNames: [],
      pincode: loc.pincodes[0],
      lat: point.lat,
      lng: point.lon,
      // OSM gives us a name and a position; the remaining facts must be supplied by the
      // operator before the entity can pass the readiness gate.
      facts: {
        'Parent locality': `${loc.name}, ${CITY_BY_SLUG.get(loc.city)!.name}`,
        Pincode: loc.pincodes[0],
        'Housing type': loc.housingProfile.replace(/-/g, ' '),
        ...(loc.landmarks.length ? { 'Nearest landmark': loc.landmarks[0] } : {}),
      },
      source: 'OpenStreetMap via Overpass API',
      licence: 'ODbL 1.0 — © OpenStreetMap contributors',
      status: 'draft',
      updatedAt: TODAY,
    };
    const r2 = add(e);
    if (r2 === 'rejected') rejected++;
    else added++;
  }
  console.log(`OSM import for ${city}/${localitySlug}: ${added} candidates imported as draft, ${rejected} rejected`);
}

// ---------------------------------------------------------------------------
// readiness gate
// ---------------------------------------------------------------------------
function promote() {
  let promoted = 0;
  let held = 0;
  for (const [key, e] of byKey) {
    if (e.status !== 'draft') continue;
    if (Object.keys(e.facts ?? {}).length >= MIN_ENTITY_FACTS) {
      byKey.set(key, { ...e, status: 'ready', updatedAt: TODAY });
      promoted++;
    } else {
      held++;
    }
  }
  console.log(`readiness gate: ${promoted} promoted to ready, ${held} held as draft (< ${MIN_ENTITY_FACTS} facts)`);
}

async function main() {
  const csv = argValue('--csv');
  if (csv) importCsv(csv);
  if (args.includes('--osm')) await importOsm(argValue('--city') ?? '', argValue('--locality') ?? '');
  if (args.includes('--promote')) promote();
  if (!csv && !args.includes('--osm') && !args.includes('--promote')) {
    console.log('Usage: --csv <file> | --osm --city <city> --locality <locality> | --promote');
    process.exit(0);
  }

  const out = [...byKey.values()].sort((a, b) => `${a.city}/${a.locality}/${a.slug}`.localeCompare(`${b.city}/${b.locality}/${b.slug}`));
  fs.writeFileSync(STORE, JSON.stringify(out, null, 2) + '\n');
  const counts = { draft: 0, ready: 0, live: 0 } as Record<string, number>;
  for (const e of out) counts[e.status]++;
  console.log(`entities.json: ${out.length} total — ${counts.draft} draft, ${counts.ready} ready, ${counts.live} live`);

}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
