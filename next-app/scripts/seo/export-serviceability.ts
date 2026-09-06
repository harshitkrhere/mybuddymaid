// scripts/seo/export-serviceability.ts — exports the service footprint from data/seo
// into the Vite booking app, so the SPA's location fields are driven by the same single
// source of truth as the SEO pages rather than a hard-coded list.
// Written to app/src/lib/serviceability.json and committed; re-run whenever the
// footprint changes, before `node scripts/build-spa.mjs`.
// Run: npx tsx scripts/seo/export-serviceability.ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ALL_LOCALITIES, CITIES, PINCODES, PLANS, SERVICES, ZONES } from '../../data/seo';

const ROOT = process.cwd();
const OUT = path.resolve(ROOT, '..', 'app', 'src', 'lib', 'serviceability.json');

const payload = {
  generatedBy: 'next-app/scripts/seo/export-serviceability.ts',
  note: 'Generated from next-app/data/seo — do not edit by hand.',
  cities: CITIES.map((c) => ({ slug: c.slug, name: c.name, altNames: c.altNames, state: c.state })),
  localities: ALL_LOCALITIES.map((l) => ({
    slug: l.slug,
    city: l.city,
    name: l.name,
    zone: l.zone,
    pincodes: l.pincodes,
  })).sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name)),
  zones: ZONES.map((z) => ({ slug: z.slug, city: z.city, name: z.name })),
  services: SERVICES.map((s) => ({
    slug: s.slug,
    name: s.name,
    shortDescription: s.shortDescription,
    /** Indicative monthly band for the metro tier — the booking app shows "from". */
    from: s.pricing.metro.from,
    to: s.pricing.metro.to,
  })),
  plans: PLANS,
  /** Booking-app service id -> data/seo service slug. */
  spaServiceMap: {
    'part-time': 'part-time-maid',
    'full-time': 'full-time-maid',
    cook: 'cook',
    nanny: 'babysitter-nanny',
    'elderly-care': 'elder-care',
  } as Record<string, string>,
  /** pincode -> locality slugs, for the serviceability check. */
  pincodes: Object.fromEntries(PINCODES.map((p) => [p.pin, { city: p.city, localities: p.localities }])),
};

fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');
console.log(
  `export-serviceability: ${payload.cities.length} cities, ${payload.localities.length} localities, ${Object.keys(payload.pincodes).length} pincodes, ${payload.services.length} services, ${payload.plans.length} plans -> ${path.relative(path.resolve(ROOT, '..'), OUT)}`,
);
