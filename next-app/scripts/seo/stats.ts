// scripts/seo/stats.ts — prints page counts per type and the total indexable count.
// Run: npx tsx scripts/seo/stats.ts
import { ALL_LOCALITIES, CITIES, PINCODES, SERVICES, ZONES } from '../../data/seo';

const localityCount = ALL_LOCALITIES.length;
const svc = SERVICES.length;
const indexablePins = PINCODES.filter((p) => p.localities.length >= 2);
const redirectPins = PINCODES.filter((p) => p.localities.length === 1);
const serviceablePins = PINCODES.filter((p) => p.localities.length === 0);

const rows: [string, number][] = [
  ['home', 1],
  ['national maid-service overview (/services/maid-service)', 1],
  ['service hubs (/services/[service])', svc],
  ['service x city (/services/[service]/[city])', svc * CITIES.length],
  ['city hubs (/[city])', CITIES.length],
  ['zone hubs (/[city]/[zone])', ZONES.length],
  ['locality hubs (/[city]/[locality])', localityCount],
  ['service x locality (/[city]/[locality]/[service])', svc * localityCount],
  ['pincode pages (indexable, many-to-many)', indexablePins.length],
  ['trust pages (/how-we-verify /replacement-policy /pricing /about /contact)', 5],
];

console.log('--- stats.ts: page counts by type ---');
let total = 0;
for (const [label, n] of rows) {
  console.log(`${String(n).padStart(6)}  ${label}`);
  total += n;
}
console.log('------');
console.log(`${String(total).padStart(6)}  TOTAL core indexable pages`);
console.log('');
console.log(`Pincode records: ${PINCODES.length} total — ${indexablePins.length} indexable (>=2 localities), ${redirectPins.length} redirect to their locality hub (1:1), ${serviceablePins.length} serviceable-only (zone/city-level, no page)`);
console.log('');
console.log('Per city:');
for (const c of CITIES) {
  const locs = ALL_LOCALITIES.filter((l) => l.city === c.slug);
  const zones = ZONES.filter((z) => z.city === c.slug);
  const vh = locs.filter((l) => l.priority === 'very-high').length;
  const hi = locs.filter((l) => l.priority === 'high').length;
  const md = locs.filter((l) => l.priority === 'medium').length;
  console.log(
    `  ${c.slug.padEnd(14)} zones=${String(zones.length).padStart(2)} localities=${String(locs.length).padStart(3)} (very-high=${vh}, high=${hi}, medium=${md}) svc-x-loc=${locs.length * svc}`,
  );
}
console.log('');
const enriched = ALL_LOCALITIES.filter((l) => l.neighbours.length > 0).length;
const withIntro = ALL_LOCALITIES.filter((l) => l.localIntro.length >= 120).length;
const reviewed = ALL_LOCALITIES.filter((l) => l.reviewed).length;
console.log(`Enrichment: ${enriched}/${localityCount} have neighbours, ${withIntro}/${localityCount} have localIntro, ${reviewed}/${localityCount} reviewed`);
