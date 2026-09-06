// scripts/seo/import-entities.ts — Phase 5 entity importer (societies, blocks, landmarks,
// metro-station catchments inside Appendix-B localities).
//
// Sources, in order of preference:
//   1. an operator CSV:  npx tsx scripts/seo/import-entities.ts --csv path/to/file.csv
//      columns: name,locality,city,kind,pincode[,fact:<label>...]
//   2. OpenStreetMap via Overpass (attributed ODbL, no competitor scraping):
//      npx tsx scripts/seo/import-entities.ts --osm --city gurgaon --locality dlf-phase-1
//
// OSM supplies a name, a position and nothing else — Indian residential areas carry no
// building:levels/operator/start_date tags worth reading (measured in the pilot: 3 of 22
// candidates had more than four tags, and all three were metro stations). So `--osm`
// builds the *candidate list*; the facts that make a page worth serving come from the
// operator:
//   npx tsx scripts/seo/import-entities.ts --export-worksheet drafts.csv
//   ... operator fills the fact: columns ...
//   npx tsx scripts/seo/import-entities.ts --csv drafts.csv --promote
//
// Everything is imported as status "draft". A draft entity has NO URL at all — not a
// noindexed page, no page. `--promote` re-evaluates the readiness gate and moves entities
// with >= 5 *entity-specific* facts to "ready" (facts inherited from the parent locality
// do not count); the operator approves the rest by hand.
//   npx tsx scripts/seo/import-entities.ts --promote
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ALL_LOCALITIES, CITY_BY_SLUG, LOCALITY_BY_PATH, RESERVED_SLUGS } from '../../data/seo';
import { MIN_ENTITY_FACTS, meetsReadinessGate } from '../../data/seo/entities';
import type { Entity, EntityKind, Locality } from '../../data/seo/types';

const ROOT = process.cwd();
const STORE = path.join(ROOT, 'data', 'seo', 'entities.json');
const args = process.argv.slice(2);
const argValue = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

/** Beyond this an OSM hit is closer to somewhere we do not serve than to a locality we do. */
const MAX_ASSIGN_RADIUS_M = 2000;

/** Fact columns the operator fills in; the ones a household actually asks about. */
const WORKSHEET_FACTS = [
  'Towers or blocks',
  'Approximate homes',
  'Builder',
  'Possession year',
  'Typical flat sizes',
  'Helper entry process',
  'Helper ID card issued by',
  'Service lift for helpers',
];

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

// Acronyms that must survive title-casing of an ALL-CAPS OSM name.
const ACRONYMS = new Set(['DLF', 'IITL', 'ATS', 'AWHO', 'RWA', 'NRI', 'JP', 'GH', 'CGHS', 'HUDA', 'BPTP', 'SS', 'MVN', 'M3M']);
const LOWER_WORDS = new Set(['the', 'and', 'of', 'at', 'in', 'on', 'for', 'de', 'la']);

/**
 * OSM names are frequently shouted ("MAHAGUN MODERNE"). They are rendered verbatim into
 * the H1 and the title tag, so normalise them; the raw name is kept as an alt name.
 */
function normaliseName(raw: string): string {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (/[a-z]/.test(name)) return name; // already mixed case — leave that casing alone
  return name
    .split(' ')
    .map((word, i) => {
      const bare = word.replace(/[^A-Za-z0-9]/g, '');
      if (ACRONYMS.has(bare)) return word;
      const lower = word.toLowerCase();
      if (i > 0 && LOWER_WORDS.has(lower)) return lower;
      return lower.replace(/(^|[^a-z])([a-z])/g, (_m, p, c) => p + c.toUpperCase());
    })
    .join(' ');
}

/** "Sector 48", "Noida Sector 101", "Sector-62" — administrative areas, never entities. */
function looksLikeSectorName(name: string): boolean {
  return /(^|\s)sector[\s-]*\d+[a-z]?$/i.test(name.trim());
}

/**
 * OSM carries plot and house codes as names ("H3/2", "C-14"). Nobody searches for those
 * and they cannot carry a facts block, so they are not entities.
 */
function looksLikeCode(name: string): boolean {
  return !/[A-Za-z]{3}/.test(name.replace(/\s+/g, ''));
}

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;
function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * A radius search around one locality centroid also sweeps up its neighbours' societies.
 * Publishing "DLF Phase 3-U Block is a society in DLF Phase 1" would be a fabricated
 * fact, so the parent is the *nearest* Appendix-B locality, not the one that was queried.
 */
function nearestLocality(city: string, point: { lat: number; lng: number }): { loc: Locality; d: number } | null {
  let best: { loc: Locality; d: number } | null = null;
  for (const l of ALL_LOCALITIES) {
    if (l.city !== city || !l.lat || !l.lng) continue;
    const d = metres(point, { lat: l.lat, lng: l.lng });
    if (!best || d < best.d) best = { loc: l, d };
  }
  return best;
}

/** Locality-level facts every entity under a parent inherits. Excluded from the gate. */
function inheritedFacts(loc: Locality): Record<string, string> {
  return {
    'Parent locality': `${loc.name}, ${CITY_BY_SLUG.get(loc.city)!.name}`,
    Pincode: loc.pincodes[0],
    'Housing type': loc.housingProfile.replace(/-/g, ' '),
    ...(loc.landmarks.length ? { 'Nearest landmark': loc.landmarks[0] } : {}),
  };
}

const existing: Entity[] = fs.existsSync(STORE) ? JSON.parse(fs.readFileSync(STORE, 'utf8')) : [];
const byKey = new Map(existing.map((e) => [`${e.city}/${e.locality}/${e.slug}`, e]));
const TODAY = process.env.IMPORT_DATE ?? new Date().toISOString().slice(0, 10);
const rejections = new Map<string, number>();
const reject = (reason: string) => {
  rejections.set(reason, (rejections.get(reason) ?? 0) + 1);
  return 'rejected' as const;
};

function add(e: Entity): 'added' | 'updated' | 'rejected' {
  const loc = LOCALITY_BY_PATH.get(`${e.city}/${e.locality}`);
  if (!loc) return reject('parent locality not in Appendix B');
  if (RESERVED_SLUGS.has(e.slug)) return reject('slug is reserved');
  // an entity slug must not collide with a service slug or a sibling locality
  if (ALL_LOCALITIES.some((l) => l.city === e.city && l.slug === e.slug)) return reject('slug collides with a locality');
  // a sector is a locality-level unit in this data model: if it is serviceable it belongs
  // in Appendix B, and if it is not, it must not get a page under another sector's URL
  if (looksLikeSectorName(e.name)) return reject('name is a sector, not an entity');
  if (looksLikeCode(e.name)) return reject('name is a plot/house code, not a place');
  // an entity whose name is just the parent restates the locality page's intent (rule 2)
  const bare = (s: string) => slugify(s.replace(new RegExp(CITY_BY_SLUG.get(e.city)!.name, 'ig'), ''));
  if (bare(e.name) === bare(loc.name) || loc.altNames.some((a) => bare(e.name) === bare(a))) {
    return reject('name duplicates the parent locality');
  }
  const key = `${e.city}/${e.locality}/${e.slug}`;
  const prev = byKey.get(key);
  if (prev) {
    // never downgrade a live entity, and never silently overwrite approved facts
    byKey.set(key, {
      ...prev,
      ...e,
      status: prev.status === 'live' ? 'live' : e.status,
      altNames: [...new Set([...(prev.altNames ?? []), ...(e.altNames ?? [])])],
      facts: { ...e.facts, ...prev.facts },
    });
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
    const cells =
      line
        .match(/("([^"]|"")*"|[^,]*)(,|$)/g)
        ?.map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim()) ?? [];
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cells[i] ?? ''));
    const city = row.city?.trim();
    const locality = row.locality?.trim();
    if (!row.name || !city || !locality) {
      rejected++;
      reject('CSV row missing name/city/locality');
      continue;
    }
    const facts: Record<string, string> = {};
    for (const h of header) if (h.startsWith('fact:') && row[h]?.trim()) facts[h.slice(5)] = row[h].trim();
    const loc = LOCALITY_BY_PATH.get(`${city}/${locality}`);
    // free, always-true facts derived from the parent locality
    if (loc) for (const [k, v] of Object.entries(inheritedFacts(loc))) facts[k] ??= v;
    if (row.pincode) facts.Pincode = row.pincode;
    const name = normaliseName(row.name);
    const e: Entity = {
      slug: slugify(name),
      city: city as Entity['city'],
      locality,
      kind: (row.kind || 'society') as EntityKind,
      name,
      altNames: (row.altNames ? row.altNames.split('|') : [])
        .concat(name === row.name.trim() ? [] : [row.name.trim()])
        .map((s) => s.trim())
        .filter(Boolean),
      pincode: row.pincode || loc?.pincodes[0] || '',
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
  way["building"="apartments"]["name"](around:${r},${loc.lat},${loc.lng});
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
  const data = (await res.json()) as {
    elements: { tags?: Record<string, string>; lat?: number; lon?: number; center?: { lat: number; lon: number } }[];
  };
  let added = 0;
  let rejected = 0;
  let reassigned = 0;
  for (const el of data.elements) {
    const raw = el.tags?.name;
    if (!raw) continue;
    const kind: EntityKind =
      el.tags?.railway === 'station' ? 'metro-station' : el.tags?.place === 'neighbourhood' ? 'landmark' : 'society';
    const point = el.center ?? { lat: el.lat!, lon: el.lon! };
    // the search radius overlaps neighbouring localities — attribute to the nearest one
    const nearest = nearestLocality(city, { lat: point.lat, lng: point.lon });
    if (!nearest || nearest.d > MAX_ASSIGN_RADIUS_M) {
      rejected++;
      reject(`> ${MAX_ASSIGN_RADIUS_M} m from any Appendix-B locality`);
      continue;
    }
    const parent = nearest.loc;
    if (parent.slug !== localitySlug) reassigned++;
    const name = normaliseName(raw);
    const e: Entity = {
      slug: slugify(name),
      city: city as Entity['city'],
      locality: parent.slug,
      kind,
      name,
      altNames: name === raw.trim() ? [] : [raw.trim()],
      pincode: parent.pincodes[0],
      lat: point.lat,
      lng: point.lon,
      // OSM gives us a name and a position; the remaining facts must be supplied by the
      // operator before the entity can pass the readiness gate.
      facts: inheritedFacts(parent),
      source: 'OpenStreetMap via Overpass API',
      licence: 'ODbL 1.0 — © OpenStreetMap contributors',
      status: 'draft',
      updatedAt: TODAY,
    };
    const r2 = add(e);
    if (r2 === 'rejected') rejected++;
    else added++;
  }
  console.log(
    `OSM import for ${city}/${localitySlug}: ${added} candidates imported as draft, ${rejected} rejected` +
      (reassigned ? `, ${reassigned} attributed to a nearer locality` : ''),
  );
}

// ---------------------------------------------------------------------------
// operator worksheet
// ---------------------------------------------------------------------------
function exportWorksheet(file: string) {
  const drafts = [...byKey.values()].filter((e) => e.status === 'draft' && !meetsReadinessGate(e));
  // source and licence round-trip so re-importing an OSM candidate through the worksheet
  // does not strip its ODbL attribution (README §9).
  const header = ['name', 'locality', 'city', 'kind', 'pincode', 'source', 'licence', ...WORKSHEET_FACTS.map((f) => `fact:${f}`)];
  const q = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows = drafts.map((e) =>
    [e.name, e.locality, e.city, e.kind, e.pincode, e.source, e.licence, ...WORKSHEET_FACTS.map((f) => e.facts?.[f] ?? '')]
      .map(q)
      .join(','),
  );
  fs.writeFileSync(file, [header.join(','), ...rows].join('\n') + '\n');
  console.log(
    `worksheet: ${drafts.length} drafts written to ${file} — fill the fact: columns ` +
      `(>= ${MIN_ENTITY_FACTS} per row) and re-import with --csv ${path.basename(file)} --promote`,
  );
}

// ---------------------------------------------------------------------------
// readiness gate
// ---------------------------------------------------------------------------
function promote() {
  let promoted = 0;
  let held = 0;
  for (const [key, e] of byKey) {
    if (e.status !== 'draft') continue;
    if (meetsReadinessGate(e)) {
      byKey.set(key, { ...e, status: 'ready', updatedAt: TODAY });
      promoted++;
    } else {
      held++;
    }
  }
  console.log(
    `readiness gate: ${promoted} promoted to ready, ${held} held as draft ` +
      `(< ${MIN_ENTITY_FACTS} entity-specific facts; facts inherited from the locality do not count)`,
  );
}

async function main() {
  const csv = argValue('--csv');
  const worksheet = argValue('--export-worksheet');
  if (csv) importCsv(csv);
  if (args.includes('--osm')) await importOsm(argValue('--city') ?? '', argValue('--locality') ?? '');
  if (args.includes('--promote')) promote();
  if (!csv && !worksheet && !args.includes('--osm') && !args.includes('--promote')) {
    console.log(
      'Usage: --csv <file> | --osm --city <city> --locality <locality> | --export-worksheet <file> | --promote',
    );
    process.exit(0);
  }

  const out = [...byKey.values()].sort((a, b) =>
    `${a.city}/${a.locality}/${a.slug}`.localeCompare(`${b.city}/${b.locality}/${b.slug}`),
  );
  fs.writeFileSync(STORE, JSON.stringify(out, null, 2) + '\n');
  if (worksheet) exportWorksheet(worksheet);
  const counts = { draft: 0, ready: 0, live: 0 } as Record<string, number>;
  for (const e of out) counts[e.status]++;
  console.log(`entities.json: ${out.length} total — ${counts.draft} draft, ${counts.ready} ready, ${counts.live} live`);
  if (rejections.size) {
    console.log('rejected:');
    for (const [reason, n] of [...rejections].sort((a, b) => b[1] - a[1])) console.log(`  ${n} x ${reason}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
