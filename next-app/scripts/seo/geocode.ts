// scripts/seo/geocode.ts — one-off geocoder for localities (OpenStreetMap Nominatim).
// Run MANUALLY, never at build or request time:  npx tsx scripts/seo/geocode.ts
// - 1 request/second (Nominatim usage policy), identifying User-Agent
// - results cached into localities/enrichment/<city>.json (lat/lng) and
//   scripts/seo/.geocode-cache.json so re-runs only fetch missing localities
// - a result more than 60 km from the city centre is rejected as a mis-hit
// - a result within 50 m of a locality already geocoded in the same city is rejected
//   as a duplicate and the locality is left unresolved (2026-09-06: eleven Noida sectors
//   had silently inherited Sector 18's point, so Sector 150 listed Sector 18 — 15 km away
//   — as a neighbour and ~77 pages advertised it in their meta descriptions)
// - `--redo <slug,slug,...>` (or `--redo city/slug`) clears the cache and the stored
//   coordinates for those localities and re-geocodes them
// Data © OpenStreetMap contributors, ODbL 1.0 — attribution in docs/seo/README.md.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ALL_LOCALITIES, CITY_BY_SLUG } from '../../data/seo';

const ROOT = process.cwd();
const ENR = path.join(ROOT, 'data', 'seo', 'localities', 'enrichment');
const CACHE = path.join(ROOT, 'scripts', 'seo', '.geocode-cache.json');
const UA = 'MyBuddyMaid-SEO-geocoder/1.0 (info@mybuddymaid.in)';

type Hit = { lat: number; lng: number; display: string };
const args = process.argv.slice(2);
const redoArg = args[args.indexOf('--redo') + 1];
const REDO = new Set(args.includes('--redo') && redoArg ? redoArg.split(',').map((x) => x.trim()).filter(Boolean) : []);
const DUP_M = 50;

/** District names Nominatim indexes; a sector query without one often resolves to the city. */
const DISTRICT: Record<string, string> = {
  noida: 'Gautam Buddh Nagar',
  'greater-noida': 'Gautam Buddh Nagar',
  gurgaon: 'Gurugram',
  delhi: 'Delhi',
  mumbai: 'Mumbai Suburban',
  pune: 'Pune',
  bangalore: 'Bengaluru Urban',
  mangalore: 'Dakshina Kannada',
};
const cache: Record<string, Hit | null> = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
const readJson = (p: string) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Localities in the same city already holding a point; a new hit must not land on one. */
function duplicateOf(city: string, hit: Hit, self: string, perCityMap: Record<string, Record<string, unknown>>): string | null {
  for (const [slug, rec] of Object.entries(perCityMap)) {
    if (slug === self) continue;
    const r = rec as { lat?: number; lng?: number };
    if (!r.lat || !r.lng) continue;
    if (haversineKm(hit, { lat: r.lat, lng: r.lng }) * 1000 < DUP_M) return slug;
  }
  return null;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function query(q: string): Promise<Hit | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Nominatim ${res.status} for ${q}`);
  const arr = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  if (!arr.length) return null;
  return { lat: Number(arr[0].lat), lng: Number(arr[0].lon), display: arr[0].display_name };
}

/**
 * Fallback when Nominatim has no entry: the sector as an OSM `place=*` node/way/relation
 * named exactly "Sector N" or "Noida Sector N" within 30 km of the city centre. Overpass,
 * one request, exact-name match only — no fuzzy hits, and the display-name guard still
 * applies because we build the display from the matched tag.
 */
async function overpassPlace(l: { name: string; altNames: string[] }, city: { lat: number; lng: number; name: string; altNames: string[] }): Promise<Hit | null> {
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const names = [l.name, ...l.altNames, `${city.name} ${l.name}`].map(esc).join('|');
  // urban place types only, within 20 km: a place=village called "Sector 77" 22 km south
  // in Dadri tehsil is not Noida Sector 77 (it was returned on 2026-09-06 and rejected)
  const cityNames = [city.name, ...city.altNames].map(esc).join('|');
  // Search INSIDE the city's administrative boundary, not a radius: Faridabad's Sector 37
  // sits 10 km from Noida's centre and a radius returned it as Noida Sector 37 on
  // 2026-09-06. place=* nodes first; Noida also maps many sectors only as a named
  // landuse=residential polygon, whose centre is a fine centroid.
  const q = `[out:json][timeout:60];
area["boundary"="administrative"]["name"~"^(${cityNames})$",i]->.city;
(
  nwr(area.city)["place"~"^(suburb|quarter|neighbourhood|locality)$"]["name"~"^(${names})$",i];
  nwr(area.city)["landuse"="residential"]["name"~"^(${names})$",i];
);out center tags 10;`;
  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
      body: `data=${encodeURIComponent(q)}`,
      signal: AbortSignal.timeout(90_000),
    });
    if (res.ok) break;
    if (![429, 502, 503, 504].includes(res.status)) break;
    await sleep(15_000 * (attempt + 1));
  }
  if (!res?.ok) throw new Error(`Overpass ${res?.status}`);
  const data = (await res.json()) as { remark?: string; elements: { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] };
  if (data.remark) throw new Error(`Overpass partial: ${data.remark.slice(0, 50)}`);
  // prefer the administrative-ish place ranks over a bare locality tag
  const rank = (t: Record<string, string> = {}) => (['suburb', 'quarter', 'neighbourhood', 'locality'].indexOf(t.place ?? '') + 1) || (t.landuse === 'residential' ? 5 : 9);
  const el = data.elements.filter((e) => e.tags?.name).sort((a, b) => rank(a.tags) - rank(b.tags))[0];
  if (!el) return null;
  const pt = el.center ?? { lat: el.lat!, lon: el.lon! };
  return { lat: pt.lat, lng: pt.lon, display: `${el.tags!.name} (OSM ${el.tags!.place ? `place=${el.tags!.place}` : 'landuse=residential'}, via Overpass)` };
}

async function main() {
  const perCity: Record<string, Record<string, Record<string, unknown>>> = {};
  let fetched = 0;
  let rejected = 0;
  let duplicates = 0;
  let missing = 0;
  for (const l of ALL_LOCALITIES) {
    const city = CITY_BY_SLUG.get(l.city)!;
    perCity[l.city] ??= readJson(path.join(ENR, `${l.city}.json`));
    const key = `${l.city}/${l.slug}`;
    const redo = REDO.has(l.slug) || REDO.has(key);
    if (redo) {
      delete cache[key];
      const rec = (perCity[l.city][l.slug] ?? {}) as { lat?: number; lng?: number };
      delete rec.lat;
      delete rec.lng;
      perCity[l.city][l.slug] = rec;
    }
    const existing = perCity[l.city][l.slug] as { lat?: number; lng?: number } | undefined;
    if (existing?.lat && existing?.lng) continue;
    let hit = cache[key];
    if (hit === undefined) {
      const cityName = l.city === 'greater-noida' ? 'Greater Noida' : city.name;
      const district = DISTRICT[l.city];
      // Most specific first. "Noida Sector 150" as one phrase is how the sector is named
      // in OSM; the district form stops Nominatim collapsing to the city relation.
      const queries = [
        `${cityName} ${l.name}, ${district}, ${city.state}, India`,
        `${l.name}, ${cityName}, ${district}, ${city.state}, India`,
        `${l.name}, ${cityName}, ${city.state}, India`,
        ...(l.altNames[0] ? [`${l.altNames[0]}, ${cityName}, ${district}, ${city.state}, India`] : []),
        `${l.name}, ${city.state}, India`,
      ];
      hit = null;
      for (const q of queries) {
        try {
          const h = await query(q);
          fetched++;
          await sleep(1100);
          if (!h) continue;
          if (haversineKm(h, city) > 60) {
            rejected++;
            continue;
          }
          // a house number on some road ("74, Sector 31 B Block Road, Greater Noida") is
          // not Sector 74: the result must actually name the locality
          const names = [l.name, ...l.altNames].map((n) => n.toLowerCase());
          // "Sector 37 Rho 2, Greater Noida" is not Noida's Sector 37: a result that names
          // a *different* city in the data layer is that city's place, not ours
          const disp = h.display.toLowerCase();
          const otherCity = [...CITY_BY_SLUG.values()].find(
            (c) => c.slug !== l.city && !cityName.toLowerCase().includes(c.name.toLowerCase()) && disp.includes(c.name.toLowerCase()),
          );
          if (otherCity) {
            rejected++;
            console.warn(`  MISS ${key}: "${q}" → "${h.display.slice(0, 70)}" is in ${otherCity.name} — rejected`);
            continue;
          }
          if (!names.some((n) => disp.includes(n))) {
            rejected++;
            console.warn(`  MISS ${key}: "${q}" → "${h.display.slice(0, 70)}" does not name the locality — rejected`);
            continue;
          }
          const dup = duplicateOf(l.city, h, l.slug, perCity[l.city]);
          if (dup) {
            // the same point as a sibling means Nominatim answered for something else —
            // the city, the district, or that sibling. Not this locality.
            duplicates++;
            console.warn(`  DUP  ${key}: "${q}" → ${h.lat.toFixed(4)},${h.lng.toFixed(4)} is ${dup}'s point — rejected`);
            continue;
          }
          hit = h;
          break;
        } catch (e) {
          console.warn(`  WARN ${key}: ${(e as Error).message}`);
          await sleep(2000);
        }
      }
      if (!hit) {
        try {
          const h = await overpassPlace(l, city);
          fetched++;
          await sleep(2000);
          const nearerCity = h && [...CITY_BY_SLUG.values()].find((c) => c.slug !== l.city && haversineKm(h, c) < haversineKm(h, city));
          if (h && nearerCity) {
            rejected++;
            console.warn(`  MISS ${key}: Overpass "${h.display}" is nearer ${nearerCity.name} than ${cityName} — rejected`);
          } else if (h && haversineKm(h, city) <= 60) {
            const dup = duplicateOf(l.city, h, l.slug, perCity[l.city]);
            if (dup) {
              duplicates++;
              console.warn(`  DUP  ${key}: Overpass place → ${dup}'s point — rejected`);
            } else {
              hit = h;
            }
          }
        } catch (e) {
          console.warn(`  WARN ${key}: ${(e as Error).message}`);
          await sleep(5000);
        }
      }
      cache[key] = hit;
      fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2));
    }
    if (!hit) {
      // unresolved: no coordinates. getNearby() then falls back to the curated neighbour
      // list, which is right; inheriting a wrong point is not.
      missing++;
      console.warn(`  MISSING ${key} — left without coordinates; curated neighbours apply`);
      continue;
    }
    perCity[l.city][l.slug] = {
      ...(perCity[l.city][l.slug] ?? {}),
      lat: Number(hit.lat.toFixed(5)),
      lng: Number(hit.lng.toFixed(5)),
      sourceRefs: Array.from(new Set([...(((perCity[l.city][l.slug] ?? {}) as { sourceRefs?: string[] }).sourceRefs ?? []), 'OpenStreetMap Nominatim (ODbL 1.0)'])),
    };
    console.log(`  ${key} → ${hit.lat.toFixed(4)}, ${hit.lng.toFixed(4)}  (${hit.display.slice(0, 60)})`);
  }
  for (const [city, map] of Object.entries(perCity)) {
    fs.writeFileSync(path.join(ENR, `${city}.json`), JSON.stringify(map, null, 2) + '\n');
  }
  console.log(
    `geocode: ${fetched} requests, ${rejected} rejected as >60km, ${duplicates} rejected as a sibling's point, ${missing} localities without coordinates`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
