// scripts/growth/freshness.ts — the monthly content-freshness list: the pages that earned the
// most clicks in the latest Search Console snapshot whose data-layer facts are older than
// `--days` (default 90). Printed as markdown for the monthly workflow to open as an issue;
// it changes nothing itself. Pricing and local facts age; a page that ranks and is stale is
// the one worth re-verifying first.
//
//   npm run growth:freshness -- --days 90 --top 30
import { allCorePages } from '../../lib/seo-engine/compose';
import type { GscSnapshot } from '../../lib/growth/types';
import { argValue, endDate, latestSnapshot } from './_env';

const days = Number(argValue('--days') ?? 90);
const top = Number(argValue('--top') ?? 30);
const snap = latestSnapshot<GscSnapshot>('gsc', endDate());
if (!snap) {
  console.log('No Search Console snapshot yet — run `npm run growth:gsc` first.');
  process.exit(0);
}
const updated = new Map(allCorePages().map((p) => [p.path, p.updatedAt]));
const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
const rows = snap.data.topPages.filter((p) => (updated.get(p.path) ?? '9999') < cutoff).slice(0, top);
console.log(`## Content freshness — ${rows.length} of the top ${snap.data.topPages.length} pages by clicks have data older than ${days} days (before ${cutoff})\n`);
console.log('| Page | Clicks (week) | Impressions | Data updated |');
console.log('|---|---:|---:|---|');
for (const r of rows) console.log(`| ${r.path} | ${r.clicks} | ${r.impressions} | ${updated.get(r.path) ?? 'n/a'} |`);
console.log('\nRe-verify pricing bands, landmarks and local FAQs for these first; bump `updatedAt` in the data layer when done so the sitemap lastmod moves.');
