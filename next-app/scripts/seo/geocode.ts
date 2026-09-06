// scripts/seo/geocode.ts — one-off geocoder for localities (OpenStreetMap Nominatim).
// Run MANUALLY, never at build or request time:  npx tsx scripts/seo/geocode.ts
// - 1 request/second (Nominatim usage policy), identifying User-Agent
// - results cached into localities/enrichment/<city>.json (lat/lng) and
//   scripts/seo/.geocode-cache.json so re-runs only fetch missing localities
// - a result more than 60 km from the city centre is rejected as a mis-hit
// Data © OpenStreetMap contributors, ODbL 1.0 — attribution in docs/seo/README.md.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ALL_LOCALITIES, CITY_BY_SLUG } from '../../data/seo';

const ROOT = process.cwd();
const ENR = path.join(ROOT, 'data', 'seo', 'localities', 'enrichment');
const CACHE = path.join(ROOT, 'scripts', 'seo', '.geocode-cache.json');
const UA = 'MyBuddyMaid-SEO-geocoder/1.0 (info@mybuddymaid.in)';

type Hit = { lat: number; lng: number; display: string };
const cache: Record<string, Hit | null> = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
const readJson = (p: string) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

async function main() {
  const perCity: Record<string, Record<string, Record<string, unknown>>> = {};
  let fetched = 0;
  let rejected = 0;
  let missing = 0;
  for (const l of ALL_LOCALITIES) {
    const city = CITY_BY_SLUG.get(l.city)!;
    perCity[l.city] ??= readJson(path.join(ENR, `${l.city}.json`));
    const existing = perCity[l.city][l.slug] as { lat?: number; lng?: number } | undefined;
    if (existing?.lat && existing?.lng) continue;
    const key = `${l.city}/${l.slug}`;
    let hit = cache[key];
    if (hit === undefined) {
      const cityName = l.city === 'greater-noida' ? 'Greater Noida' : city.name;
      const queries = [
        `${l.name}, ${cityName}, ${city.state}, India`,
        ...(l.altNames[0] ? [`${l.altNames[0]}, ${cityName}, ${city.state}, India`] : []),
        `${l.name}, ${city.state}, India`,
      ];
      hit = null;
      for (const q of queries) {
        try {
          const h = await query(q);
          fetched++;
          await sleep(1100);
          if (h && haversineKm(h, city) <= 60) {
            hit = h;
            break;
          }
          if (h) rejected++;
        } catch (e) {
          console.warn(`  WARN ${key}: ${(e as Error).message}`);
          await sleep(2000);
        }
      }
      cache[key] = hit;
      fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2));
    }
    if (!hit) {
      missing++;
      console.warn(`  MISSING ${key}`);
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
  console.log(`geocode: ${fetched} requests, ${rejected} rejected as >60km, ${missing} localities without coordinates`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
