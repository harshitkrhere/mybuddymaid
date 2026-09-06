// scripts/seo/validate.ts — data-layer validator. Runs in prebuild and CI; ANY failure
// fails the build (exit 1). Checks the rules from the brief §5 plus metadata uniqueness
// from the Appendix D templates, and prints a count diff vs the previous run.
// Run: npx tsx scripts/seo/validate.ts
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ALL_LOCALITIES,
  CITIES,
  LOCALITY_BY_PATH,
  PINCODES,
  RESERVED_SLUGS,
  SERVICES,
  ZONES,
} from '../../data/seo';
import {
  cityMeta,
  homeMeta,
  localityMeta,
  maidServiceHubMeta,
  pincodeMeta,
  serviceCityMeta,
  serviceHubMeta,
  serviceLocalityMeta,
  zoneMeta,
  titleCaseSlug,
  type PageMeta,
} from '../../lib/seo-engine/meta';

const errors: string[] = [];
const warnings: string[] = [];
const err = (m: string) => errors.push(m);
const warn = (m: string) => warnings.push(m);

// ---------- Zod structural validation ----------
const faqSchema = z.object({
  id: z.string().min(3),
  q: z.string().min(8),
  a: z.string().min(20),
  scope: z.enum(['global', 'service', 'city', 'zone', 'locality', 'housing', 'entity']),
  tags: z.array(z.string()),
});

const localitySchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  city: z.string(),
  zone: z.string().min(1),
  name: z.string().min(2),
  altNames: z.array(z.string()),
  pincodes: z.array(z.string().regex(/^\d{6}$/)).min(1),
  priority: z.enum(['very-high', 'high', 'medium']),
  kind: z.enum(['locality', 'sector', 'township', 'road', 'belt']),
  lat: z.number().optional(),
  lng: z.number().optional(),
  neighbours: z.array(z.string()),
  landmarks: z.array(z.string()),
  housingProfile: z.enum(['gated-societies', 'independent-houses', 'mixed', 'builder-floors']),
  demandProfile: z.array(z.enum(['working-professionals', 'families', 'elderly', 'students'])).min(1),
  helperSourceAreas: z.array(z.string()),
  localIntro: z.string(),
  commuteNotes: z.string(),
  housingNotes: z.string(),
  localFaqs: z.array(faqSchema),
  reviewed: z.boolean(),
  sourceRefs: z.array(z.string()),
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
});

for (const l of ALL_LOCALITIES) {
  const r = localitySchema.safeParse(l);
  if (!r.success) err(`locality ${l.city}/${l.slug}: schema — ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
}

// ---------- Slug rules ----------
const citySlugs = new Set(CITIES.map((c) => c.slug));
if (citySlugs.size !== CITIES.length) err('duplicate city slugs');
for (const c of CITIES) if (RESERVED_SLUGS.has(c.slug)) err(`city slug '${c.slug}' is reserved`);

for (const city of CITIES) {
  const areaSlugs = new Map<string, string>();
  for (const zn of ZONES.filter((z2) => z2.city === city.slug)) {
    if (RESERVED_SLUGS.has(zn.slug)) err(`zone slug '${zn.slug}' is reserved`);
    if (areaSlugs.has(zn.slug)) err(`${city.slug}: area slug collision '${zn.slug}' (${areaSlugs.get(zn.slug)} vs zone)`);
    areaSlugs.set(zn.slug, 'zone');
  }
  for (const l of ALL_LOCALITIES.filter((l2) => l2.city === city.slug)) {
    if (RESERVED_SLUGS.has(l.slug)) err(`locality slug '${l.slug}' is reserved`);
    if (areaSlugs.has(l.slug)) err(`${city.slug}: area slug collision '${l.slug}' (${areaSlugs.get(l.slug)} vs locality)`);
    areaSlugs.set(l.slug, 'locality');
    if (/\d{6}/.test(l.slug)) err(`locality slug '${l.slug}' contains a pincode`);
  }
}

// ---------- Pincode prefix rules ----------
const PIN_RULES: Record<string, RegExp> = {
  delhi: /^11\d{4}$/,
  noida: /^2013\d{2}$/,
  'greater-noida': /^(2013|2032)\d{2}$/,
  gurgaon: /^122\d{3}$/,
  mumbai: /^400\d{3}$/,
  pune: /^411\d{3}$/,
  bangalore: /^560\d{3}$/,
  mangalore: /^575\d{3}$/,
};
for (const l of ALL_LOCALITIES)
  for (const pin of l.pincodes)
    if (!PIN_RULES[l.city]?.test(pin)) err(`locality ${l.city}/${l.slug}: pincode ${pin} fails ${l.city} prefix rule`);
for (const z2 of ZONES)
  for (const pin of z2.zonePincodes)
    if (!PIN_RULES[z2.city]?.test(pin)) err(`zone ${z2.city}/${z2.slug}: pincode ${pin} fails prefix rule`);
for (const c of CITIES)
  for (const pin of c.cityLevelPincodes)
    if (!PIN_RULES[c.slug]?.test(pin)) err(`city ${c.slug}: city-level pincode ${pin} fails prefix rule`);

// ---------- Structure minimums ----------
const zonesByCity = new Map<string, number>();
for (const z2 of ZONES) zonesByCity.set(z2.city, (zonesByCity.get(z2.city) ?? 0) + 1);
for (const c of CITIES) {
  if ((zonesByCity.get(c.slug) ?? 0) < 1) err(`city ${c.slug}: no zones`);
  if (c.heroLocalities.length < 3) err(`city ${c.slug}: needs >= 3 hero localities`);
  for (const h of c.heroLocalities)
    if (!LOCALITY_BY_PATH.has(`${c.slug}/${h}`)) err(`city ${c.slug}: hero locality '${h}' does not exist`);
  for (const zref of c.zones)
    if (!ZONES.some((z2) => z2.city === c.slug && z2.slug === zref)) err(`city ${c.slug}: zone ref '${zref}' does not exist`);
}
for (const z2 of ZONES) {
  if (z2.localities.length < 3) err(`zone ${z2.city}/${z2.slug}: has ${z2.localities.length} localities (< 3)`);
  if (!citySlugs.has(z2.city)) err(`zone ${z2.slug}: unknown city ${z2.city}`);
}
for (const l of ALL_LOCALITIES) {
  if (!ZONES.some((z2) => z2.city === l.city && z2.slug === l.zone)) err(`locality ${l.city}/${l.slug}: unknown zone '${l.zone}'`);
}

// ---------- Neighbours: existence + symmetry + minimum (only once enrichment landed) ----------
const enriched = ALL_LOCALITIES.filter((l) => l.neighbours.length > 0);
for (const l of enriched) {
  for (const n of l.neighbours) {
    const nb = LOCALITY_BY_PATH.get(`${l.city}/${n}`);
    if (!nb) err(`locality ${l.city}/${l.slug}: neighbour '${n}' does not exist in ${l.city}`);
    else if (nb.neighbours.length > 0 && !nb.neighbours.includes(l.slug))
      err(`neighbour asymmetry: ${l.city}/${l.slug} lists ${n}, but ${n} does not list it back`);
  }
  if (l.neighbours.length < 4) err(`locality ${l.city}/${l.slug}: only ${l.neighbours.length} neighbours (< 4)`);
}
if (enriched.length < ALL_LOCALITIES.length)
  warn(`${ALL_LOCALITIES.length - enriched.length}/${ALL_LOCALITIES.length} localities not yet enriched (no neighbours) — pages for them will be gated noindex`);

// ---------- Services ----------
const tiers = ['metro-premium', 'metro', 'tier-2'] as const;
for (const s of SERVICES) {
  for (const t of tiers) {
    const b = s.pricing[t];
    if (!b || !(b.from > 0) || !(b.to > b.from)) err(`service ${s.slug}: bad pricing band for tier ${t}`);
  }
  if (s.faqPool.length < 8) err(`service ${s.slug}: faqPool has ${s.faqPool.length} (< 8)`);
  if (s.tasksIncluded.length < 3) err(`service ${s.slug}: tasksIncluded ${s.tasksIncluded.length} (< 3)`);
}

// ---------- Metadata uniqueness (titles + descriptions from Appendix D templates) ----------
const metas: PageMeta[] = [homeMeta(), maidServiceHubMeta()];
for (const c of CITIES) metas.push(cityMeta(c));
for (const z2 of ZONES) metas.push(zoneMeta(z2, CITIES.find((c) => c.slug === z2.city)!));
for (const l of ALL_LOCALITIES) {
  const c = CITIES.find((c2) => c2.slug === l.city)!;
  metas.push(localityMeta(l, c));
  for (const s of SERVICES) metas.push(serviceLocalityMeta(s, l, c));
}
for (const s of SERVICES) {
  metas.push(serviceHubMeta(s));
  for (const c of CITIES) metas.push(serviceCityMeta(s, c));
}
for (const p of PINCODES.filter((p2) => p2.localities.length >= 2)) {
  metas.push(pincodeMeta(p, p.localities.map(titleCaseSlug)));
}
const seenTitle = new Map<string, string>();
const seenDesc = new Map<string, string>();
for (const m of metas) {
  if (seenTitle.has(m.title)) err(`duplicate title '${m.title}' (${seenTitle.get(m.title)} vs ${m.canonicalPath})`);
  seenTitle.set(m.title, m.canonicalPath);
  if (seenDesc.has(m.description)) err(`duplicate description on ${seenDesc.get(m.description)} vs ${m.canonicalPath}`);
  seenDesc.set(m.description, m.canonicalPath);
  if (m.title.length > 68) warn(`title > 68 chars (${m.title.length}): ${m.canonicalPath}`);
  if (m.description.length > 160) err(`description > 160 chars: ${m.canonicalPath}`);
}

// ---------- Count diff vs previous run ----------
const countsPath = path.join(process.cwd(), 'scripts', 'seo', '.counts.json');
const counts = {
  cities: CITIES.length,
  zones: ZONES.length,
  localities: ALL_LOCALITIES.length,
  services: SERVICES.length,
  pincodes: PINCODES.length,
  indexablePincodes: PINCODES.filter((p) => p.localities.length >= 2).length,
  metas: metas.length,
};
let prev: Record<string, number> | null = null;
try {
  prev = JSON.parse(fs.readFileSync(countsPath, 'utf8'));
} catch {}
console.log('--- validate.ts counts ---');
for (const [k, v] of Object.entries(counts)) {
  const d = prev && prev[k] !== undefined ? v - prev[k] : null;
  console.log(`${k}: ${v}${d !== null && d !== 0 ? ` (${d > 0 ? '+' : ''}${d} vs previous run)` : ''}`);
  if (d !== null && d < 0) warn(`count '${k}' DECREASED by ${-d} — verify this deletion is intentional`);
}
fs.writeFileSync(countsPath, JSON.stringify(counts, null, 2));

// ---------- Report ----------
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings.slice(0, 40)) console.log(`  WARN ${w}`);
  if (warnings.length > 40) console.log(`  ... and ${warnings.length - 40} more`);
}
if (errors.length) {
  console.error(`\n${errors.length} error(s):`);
  for (const e of errors.slice(0, 80)) console.error(`  FAIL ${e}`);
  if (errors.length > 80) console.error(`  ... and ${errors.length - 80} more`);
  process.exit(1);
}
console.log('\nvalidate.ts: GREEN');
