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
import * as dns from 'node:dns';
import * as fs from 'node:fs';
import * as path from 'node:path';
dns.setDefaultResultOrder('ipv4first');
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

/**
 * Search radius per locality kind. A sector is ~1 km across; a township like Gaur City or
 * Jaypee Greens is 3-4 km across and its avenues/phases sit 1.5-2.6 km from the centroid
 * (measured 2026-09-06: "12th Avenue Gaur City 2" 1,648 m, "16th Avenue" 2,036 m, "Apex
 * Golf Avenue" 2,583 m; Jaypee's Kosmos 1.4-1.9 km). At 1,200 m they are never queried.
 */
function searchRadius(loc: Locality): number {
  return loc.kind === 'township' ? 3000 : 1200;
}
/** Beyond this an OSM hit is closer to somewhere we do not serve than to a locality we do. */
const assignCap = (loc: Locality) => searchRadius(loc) + 500;

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

/**
 * "Sector 48", "Noida Sector 101", "Sector-62A" — administrative areas, never entities.
 * Whole-name match only, after stripping the city name: "Amrapali Sapphire Sector 45" is
 * a society and must survive.
 */
function looksLikeSectorName(name: string, cityName: string): boolean {
  const stripped = name.replace(new RegExp(escapeRe(cityName), 'ig'), '').trim();
  return /^sector[\s-]*\d+[a-z]?$/i.test(stripped);
}
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * OSM carries plot and house codes as names ("H3/2", "C-14"). Nobody searches for those
 * and they cannot carry a facts block, so they are not entities.
 */
function looksLikeCode(name: string): boolean {
  return !/[A-Za-z]{3}/.test(name.replace(/\s+/g, ''));
}

/**
 * "Tower 12", "tower A", "Block C", "Site", "Pocket 7" — a generic label with no society
 * name attached. OSM mappers label individual buildings this way inside a complex whose
 * own name is on a different way. Nobody searches for "maid in Tower 12".
 */
function looksLikeGenericLabel(name: string): boolean {
  return /^(tower|block|wing|phase|building|site|pocket|plot|gate|type)(\s*-?\s*[a-z0-9]{1,3})?$/i.test(name.trim());
}

/** "vipin's appartment", "Manral's Home" — a private house, not a place. */
function looksLikePrivateHouse(name: string): boolean {
  return /['\u2019]s\s/i.test(name) || /\b(home|house|residence|villa|flat|apartment|appartment)\s*$/i.test(name) && /['\u2019]/.test(name);
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

// Only one importer may run at a time. Two instances each hold their own copy of the
// store and overwrite each other's per-locality writes (this happened on 2026-09-06 when
// a stopped background shell left its node child running: a dozen Gurgaon sectors were
// logged as imported and then lost). The lock records the pid so a stale lock from a
// killed process can be identified and removed.
const LOCK = path.join(ROOT, 'data', 'seo', '.entities.lock');
function acquireLock() {
  if (fs.existsSync(LOCK)) {
    const holder = fs.readFileSync(LOCK, 'utf8').trim();
    let alive = false;
    try {
      process.kill(Number(holder), 0);
      alive = true;
    } catch {
      alive = false;
    }
    if (alive) {
      console.error(`another importer (pid ${holder}) is running — refusing to start. Never run two in parallel.`);
      process.exit(2);
    }
    console.log(`removing stale lock from pid ${holder}`);
  }
  fs.writeFileSync(LOCK, String(process.pid));
  const release = () => {
    try {
      if (fs.existsSync(LOCK) && fs.readFileSync(LOCK, 'utf8').trim() === String(process.pid)) fs.unlinkSync(LOCK);
    } catch {
      /* best effort */
    }
  };
  process.on('exit', release);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.on(sig, () => process.exit(130));
}
acquireLock();

const existing: Entity[] = fs.existsSync(STORE) ? JSON.parse(fs.readFileSync(STORE, 'utf8')) : [];
const byKey = new Map(existing.map((e) => [`${e.city}/${e.locality}/${e.slug}`, e]));
const TODAY = process.env.IMPORT_DATE ?? new Date().toISOString().slice(0, 10);
const droppedKeys = new Set<string>();
const rejections = new Map<string, number>();
const rejectedNames = new Map<string, string[]>();
const VERBOSE = args.includes('--verbose');
const reject = (reason: string, name = '') => {
  rejections.set(reason, (rejections.get(reason) ?? 0) + 1);
  if (name) rejectedNames.set(reason, [...(rejectedNames.get(reason) ?? []), name]);
  return 'rejected' as const;
};

function add(e: Entity): 'added' | 'updated' | 'rejected' {
  const loc = LOCALITY_BY_PATH.get(`${e.city}/${e.locality}`);
  if (!loc) return reject('parent locality not in Appendix B');
  if (RESERVED_SLUGS.has(e.slug)) return reject('slug is reserved', e.name);
  // an entity slug must not collide with a service slug or a sibling locality
  if (ALL_LOCALITIES.some((l) => l.city === e.city && l.slug === e.slug)) return reject('slug collides with a locality', e.name);
  // a sector is a locality-level unit in this data model: if it is serviceable it belongs
  // in Appendix B, and if it is not, it must not get a page under another sector's URL
  const cityName = CITY_BY_SLUG.get(e.city)!.name;
  if (looksLikeSectorName(e.name, cityName)) return reject('name is a sector, not an entity', e.name);
  if (looksLikeCode(e.name)) return reject('name is a plot/house code, not a place', e.name);
  if (looksLikeGenericLabel(e.name)) return reject('generic tower/block label with no society name', e.name);
  if (looksLikePrivateHouse(e.name)) return reject('private house, not a place', e.name);
  // An entity whose name IS the parent restates the locality page's intent (rule 2).
  // EXACT match on the whole normalised name only — never prefix or substring. "Gaur City
  // 7th Avenue" under Gaur City is a distinct tower-level entity and is the brief's own
  // example of the long-tail this system exists for.
  const bare = (s: string) => slugify(s.replace(new RegExp(escapeRe(cityName), 'ig'), ''));
  if (bare(e.name) === bare(loc.name) || loc.altNames.some((a) => bare(e.name) === bare(a))) {
    return reject('name is exactly the parent locality', e.name);
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
  let dropped = 0;
  let untriaged = 0;
  const triage = header.includes('serve?');
  const keepUntriaged = args.includes('--keep-untriaged');
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
    if (triage) {
      const serve = (row['serve?'] ?? '').trim().toLowerCase();
      const yes = serve === 'y' || serve === 'yes';
      if (!yes) {
        const explicitNo = serve === 'n' || serve === 'no';
        if (explicitNo || !keepUntriaged) {
          // drop the candidate — drafts only; a ready/live entity is never deleted by a CSV
          const key = `${city}/${locality}/${slugify(normaliseName(row.name))}`;
          const prev = byKey.get(key);
          if (prev && prev.status === 'draft') {
            byKey.delete(key);
            droppedKeys.add(key);
            dropped++;
          }
        } else {
          untriaged++;
        }
        continue;
      }
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
  console.log(
    `CSV import: ${added} added, ${updated} updated, ${rejected} rejected` +
      (triage ? `, ${dropped} dropped (serve? not y)` + (untriaged ? `, ${untriaged} left untriaged` : '') : ''),
  );
}

// ---------------------------------------------------------------------------
// Overpass transport — the public API rate-limits, so one request at a time, a pause
// between them, and a backoff retry on 429/502/503/504. Never fire localities in parallel.
// ---------------------------------------------------------------------------
type OverpassResult = {
  elements: { tags?: Record<string, string>; lat?: number; lon?: number; center?: { lat: number; lon: number } }[];
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const OVERPASS_GAP_MS = Number(process.env.OVERPASS_GAP_MS ?? 3000);
// Public mirrors, tried in turn when the previous one is unreachable or rate-limited.
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
let mirror = 0;
let lastOverpassAt = 0;
async function overpass(query: string): Promise<OverpassResult> {
  const waits = [10_000, 30_000, 60_000, 120_000, 180_000];
  for (let attempt = 0; ; attempt++) {
    const since = Date.now() - lastOverpassAt;
    if (since < OVERPASS_GAP_MS) await sleep(OVERPASS_GAP_MS - since);
    lastOverpassAt = Date.now();
    let res: Response | null = null;
    try {
      res = await fetch(OVERPASS_MIRRORS[mirror], {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'User-Agent': 'MyBuddyMaid-SEO/1.0 (info@mybuddymaid.in)' },
        body: `data=${encodeURIComponent(query)}`,
        // a mirror that accepts the connection and never answers must count as a failure,
        // or one hung request stalls the whole city
        signal: AbortSignal.timeout(120_000),
      });
    } catch (err) {
      if (attempt >= waits.length) throw err;
      res = null; // transport error — retried below
    }
    let status: number | string = res?.status ?? 'network error';
    if (res?.ok) {
      const data = (await res.json()) as OverpassResult & { remark?: string };
      if (!data.remark) return data;
      status = `partial result (${data.remark.slice(0, 60)})`;
    }
    if (attempt >= waits.length || (res && !res.ok && ![429, 502, 503, 504].includes(res.status))) {
      throw new Error(`Overpass returned ${status}`);
    }
    // switch mirror on every failure; the wait still grows so a global outage backs off
    mirror = (mirror + 1) % OVERPASS_MIRRORS.length;
    process.stdout.write(`  overpass ${status}, retrying on ${new URL(OVERPASS_MIRRORS[mirror]).host} in ${waits[attempt] / 1000}s\n`);
    await sleep(waits[attempt]);
  }
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
  const r = searchRadius(loc); // metres
  const around = `(around:${r},${loc.lat},${loc.lng})`;
  // nwr = node|way|relation. Large townships are often relations, and their avenues and
  // phases are ways inside them — both must come back or the tower-level long tail is lost.
  const query = `[out:json][timeout:90];
(
  nwr["landuse"="residential"]["name"]${around};
  nwr["building"="residential"]["name"]${around};
  nwr["building"="apartments"]["name"]${around};
  nwr["residential"]["name"]${around};
  nwr["place"~"^(neighbourhood|quarter)$"]["name"]${around};
  node["railway"="station"]["station"="subway"]["name"]${around};
);
out center tags 400;`;
  const data = await overpass(query);
  let added = 0;
  let rejected = 0;
  let reassigned = 0;
  const stems = new Set(data.elements.map((el) => el.tags?.name).filter((n): n is string => !!n).map((n) => normaliseName(n).toLowerCase()));
  for (const el of data.elements) {
    const raw = el.tags?.name;
    if (!raw) continue;
    const kind: EntityKind =
      el.tags?.railway === 'station' ? 'metro-station' : el.tags?.place === 'neighbourhood' ? 'landmark' : 'society';
    const point = el.center ?? { lat: el.lat!, lon: el.lon! };
    // the search radius overlaps neighbouring localities — attribute to the nearest one
    const nearest = nearestLocality(city, { lat: point.lat, lng: point.lon });
    if (!nearest || nearest.d > assignCap(nearest.loc)) {
      rejected++;
      reject('too far from any Appendix-B locality', raw);
      continue;
    }
    // Individual towers ("Kosmos 43" when "Kosmos" is itself a candidate) are buildings,
    // not places anyone searches for; the society is the entity. Folded, never published.
    // "12th Avenue Gaur City 2" survives: its stem is not a candidate.
    const stem = raw.trim().match(/^(.+?)\s+\d+[A-Za-z]?$/)?.[1];
    if (stem && stems.has(normaliseName(stem).toLowerCase())) {
      rejected++;
      reject('tower within a society that is itself a candidate', raw);
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
  const drafts = [...byKey.values()]
    .filter((e) => e.status === 'draft' && !meetsReadinessGate(e))
    .sort((a, b) => a.city.localeCompare(b.city) || a.locality.localeCompare(b.locality) || a.name.localeCompare(b.name));
  // `serve?` comes first so the operator can triage top-to-bottom: y = we place helpers
  // here, anything else = drop on re-import. source and licence round-trip so an OSM
  // candidate does not lose its ODbL attribution (README §9).
  const header = ['serve?', 'name', 'locality', 'city', 'kind', 'pincode', 'source', 'licence', ...WORKSHEET_FACTS.map((f) => `fact:${f}`)];
  const q = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows = drafts.map((e) =>
    ['', e.name, e.locality, e.city, e.kind, e.pincode, e.source, e.licence, ...WORKSHEET_FACTS.map((f) => e.facts?.[f] ?? '')]
      .map(q)
      .join(','),
  );
  fs.writeFileSync(file, [header.join(','), ...rows].join('\n') + '\n');
  console.log(
    `worksheet: ${drafts.length} drafts written to ${file} — mark serve? = y on the societies we place in, ` +
      `fill their fact: columns (>= ${MIN_ENTITY_FACTS} per row), then --csv ${path.basename(file)} --promote; ` +
      `rows not marked y are dropped (add --keep-untriaged to drop only explicit n)`,
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

function writeStore(): Entity[] {
  // Merge with whatever is on disk first: anything another writer persisted that this
  // process never saw is kept; this process's own view wins for keys it holds. Rows this
  // run deliberately dropped (serve? triage) are tracked so the merge does not resurrect them.
  if (fs.existsSync(STORE)) {
    const onDisk: Entity[] = JSON.parse(fs.readFileSync(STORE, 'utf8'));
    for (const e of onDisk) {
      const key = `${e.city}/${e.locality}/${e.slug}`;
      if (!byKey.has(key) && !droppedKeys.has(key)) byKey.set(key, e);
    }
  }
  const out = [...byKey.values()].sort((a, b) =>
    `${a.city}/${a.locality}/${a.slug}`.localeCompare(`${b.city}/${b.locality}/${b.slug}`),
  );
  const tmp = `${STORE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(out, null, 2) + '\n');
  fs.renameSync(tmp, STORE);
  return out;
}

async function main() {
  const csv = argValue('--csv');
  const worksheet = argValue('--export-worksheet');
  if (csv) importCsv(csv);
  if (args.includes('--osm')) {
    const city = argValue('--city') ?? '';
    if (args.includes('--all')) {
      const locs = ALL_LOCALITIES.filter((l) => l.city === city);
      if (!locs.length) {
        console.error(`Unknown city ${city}`);
        process.exit(1);
      }
      const from = argValue('--from');
      const failed: string[] = [];
      let started = !from;
      let i = 0;
      for (const l of locs) {
        i++;
        if (!started && l.slug !== from) continue;
        started = true;
        if (!l.lat || !l.lng) {
          console.log(`[${i}/${locs.length}] ${city}/${l.slug}: skipped, no coordinates`);
          continue;
        }
        process.stdout.write(`[${i}/${locs.length}] `);
        try {
          await importOsm(city, l.slug);
        } catch (err) {
          // Overpass exhausted its retries for this one locality: skip it, keep going, and
          // list it at the end so `--from <slug>` (or a single --locality run) can fill it
          failed.push(l.slug);
          console.log(`${city}/${l.slug}: FAILED after retries (${(err as Error).message}) — continuing`);
        }
        // persist after every locality so a rate-limit failure mid-run loses nothing
        writeStore();
        if (VERBOSE) printRejections(`${city}/${l.slug}`);
      }
      if (failed.length) console.log(`\nlocalities that failed and need a re-run: ${failed.join(' ')}`);
    } else {
      await importOsm(city, argValue('--locality') ?? '');
    }
  }
  if (args.includes('--promote')) promote();
  if (!csv && !worksheet && !args.includes('--osm') && !args.includes('--promote')) {
    console.log(
      'Usage: --csv <file> [--keep-untriaged] | --osm --city <city> (--locality <locality> | --all [--from <slug>]) [--verbose] | --export-worksheet <file> | --promote',
    );
    process.exit(0);
  }

  const out = writeStore();
  if (worksheet) exportWorksheet(worksheet);
  const counts = { draft: 0, ready: 0, live: 0 } as Record<string, number>;
  for (const e of out) counts[e.status]++;
  console.log(`entities.json: ${out.length} total — ${counts.draft} draft, ${counts.ready} ready, ${counts.live} live`);
  if (rejections.size) printRejections('total');
}

/**
 * Per-reason tally, with names. The parent-locality rule is the one that could silently
 * eat tower-level entities, so its names are always listed; the rest only under --verbose.
 * Called per locality in verbose --all runs so a crash later cannot lose the evidence.
 */
function printRejections(scope: string) {
  console.log(`rejected (${scope}):`);
  for (const [reason, n] of [...rejections].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n} x ${reason}`);
    const names = rejectedNames.get(reason) ?? [];
    if (names.length && (VERBOSE || reason === 'name is exactly the parent locality')) {
      console.log(`      ${[...new Set(names)].join(' | ')}`);
    }
  }
  rejections.clear();
  rejectedNames.clear();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
