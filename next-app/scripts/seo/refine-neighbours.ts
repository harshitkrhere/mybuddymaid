// scripts/seo/refine-neighbours.ts — refines curated neighbours by distance once
// coordinates exist: the 6–10 closest same-city localities within ~8 km, with
// geography guards where straight-line distance lies (the Yamuna in Delhi, the harbour
// between Mumbai and Navi Mumbai), then symmetrised, then hand overrides applied from
// localities/enrichment/neighbour-overrides.json  { "city/slug": { add: [], remove: [] } }.
// Localities without coordinates keep their curated list.
// Run: npx tsx scripts/seo/refine-neighbours.ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ALL_LOCALITIES } from '../../data/seo';

const ROOT = process.cwd();
const ENR = path.join(ROOT, 'data', 'seo', 'localities', 'enrichment');
const OVERRIDES = path.join(ENR, 'neighbour-overrides.json');
const MAX_KM = 8;
const CURATED_MAX_KM = 14; // curated (hand-drafted) neighbours are kept up to this distance
const MIN_N = 6;
const MAX_N = 10;

type Enr = { lat?: number; lng?: number; neighbours?: string[] };
const readJson = (p: string) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {});
const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

const TRANS_YAMUNA = new Set(['east-delhi', 'north-east-delhi']);
// Navi Mumbai is across the harbour, but the Vashi and Airoli bridges make the eastern
// suburbs a genuine commute for helpers; the island city and western suburbs are not.
const NAVI_LINKED = new Set(['navi-mumbai', 'eastern-suburbs']);
function allowed(a: { city: string; zone: string }, b: { city: string; zone: string }) {
  if (a.city === 'delhi' && TRANS_YAMUNA.has(a.zone) !== TRANS_YAMUNA.has(b.zone)) return false;
  if (a.city === 'mumbai' && (a.zone === 'navi-mumbai' || b.zone === 'navi-mumbai')) {
    return NAVI_LINKED.has(a.zone) && NAVI_LINKED.has(b.zone);
  }
  return true;
}

const overrides: Record<string, { add?: string[]; remove?: string[] }> = readJson(OVERRIDES);
const byCity = new Map<string, typeof ALL_LOCALITIES>();
for (const l of ALL_LOCALITIES) byCity.set(l.city, [...(byCity.get(l.city) ?? []), l]);

let refined = 0;
let kept = 0;
for (const [city, locs] of byCity) {
  const file = path.join(ENR, `${city}.json`);
  const enr: Record<string, Enr> = readJson(file);
  const coord = (slug: string) => {
    const e = enr[slug];
    return e?.lat && e?.lng ? { lat: e.lat, lng: e.lng } : null;
  };
  for (const l of locs) {
    const me = coord(l.slug);
    enr[l.slug] ??= {};
    if (!me) {
      kept++;
      continue;
    }
    const ranked = locs
      .filter((o) => o.slug !== l.slug && coord(o.slug) && allowed(l, o))
      .map((o) => ({ slug: o.slug, d: km(me, coord(o.slug)!) }))
      .sort((a, b) => a.d - b.d);
    const dist = new Map(ranked.map((r) => [r.slug, r.d]));
    // Curated neighbours are referenced by name in the drafted locality prose, so keep
    // the ones that survive a sanity distance check (<= CURATED_MAX_KM), then top up
    // with the nearest remaining localities.
    const curated = (enr[l.slug].neighbours ?? []).filter(
      (n) => n !== l.slug && dist.has(n) && dist.get(n)! <= CURATED_MAX_KM,
    );
    const list = [...curated];
    for (const r of ranked) {
      if (list.length >= MAX_N) break;
      if (r.d > MAX_KM && list.length >= MIN_N) break;
      if (!list.includes(r.slug)) list.push(r.slug);
    }
    enr[l.slug].neighbours = list.slice(0, MAX_N);
    refined++;
  }
  // symmetrise
  for (const l of locs) {
    for (const n of enr[l.slug]?.neighbours ?? []) {
      enr[n] ??= {};
      enr[n].neighbours ??= [];
      if (!enr[n].neighbours!.includes(l.slug)) enr[n].neighbours!.push(l.slug);
    }
  }
  // overrides (applied symmetrically)
  for (const l of locs) {
    const o = overrides[`${city}/${l.slug}`];
    if (!o) continue;
    for (const r of o.remove ?? []) {
      enr[l.slug].neighbours = (enr[l.slug].neighbours ?? []).filter((x) => x !== r);
      if (enr[r]) enr[r].neighbours = (enr[r].neighbours ?? []).filter((x) => x !== l.slug);
    }
    for (const a of o.add ?? []) {
      if (!locs.some((x) => x.slug === a)) continue;
      enr[l.slug].neighbours = Array.from(new Set([...(enr[l.slug].neighbours ?? []), a]));
      enr[a] ??= {};
      enr[a].neighbours = Array.from(new Set([...(enr[a].neighbours ?? []), l.slug]));
    }
  }
  fs.writeFileSync(file, JSON.stringify(enr, null, 2) + '\n');
}
console.log(`refine-neighbours: ${refined} refined by distance, ${kept} kept curated lists (no coordinates)`);
