// scripts/seo/check-redirects.ts — requests every old URL in docs/seo/redirects.csv
// against a local build or preview deployment and asserts exactly ONE 301 hop to a 200
// (or a deliberate 410), with no chains and no loops.
//
//   npx next build && npx next start &
//   npx tsx scripts/seo/check-redirects.ts
//   BASE_URL=https://preview.example npx tsx scripts/seo/check-redirects.ts
//   SAMPLE=200 npx tsx scripts/seo/check-redirects.ts   # spot-check instead of all
import * as fs from 'node:fs';
import * as path from 'node:path';

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const CONCURRENCY = Number(process.env.CHECK_CONCURRENCY ?? 16);
const SAMPLE = Number(process.env.SAMPLE ?? 0);
const CSV = path.resolve(process.cwd(), '..', 'docs', 'seo', 'redirects.csv');

interface Row {
  old: string;
  to: string;
  status: number;
  reason: string;
}

const rows: Row[] = fs
  .readFileSync(CSV, 'utf8')
  .split(/\r?\n/)
  .slice(1)
  .filter(Boolean)
  .map((line) => {
    const m = line.match(/^([^,]*),([^,]*),(\d+),"(.*)"$/);
    if (!m) throw new Error(`Unparsable redirects.csv line: ${line}`);
    return { old: m[1], to: m[2], status: Number(m[3]), reason: m[4] };
  });

const sampled = SAMPLE > 0 ? rows.filter((_, i) => i % Math.ceil(rows.length / SAMPLE) === 0) : rows;
const errors: string[] = [];
let ok301 = 0;
let ok410 = 0;
let checked = 0;

async function check(row: Row) {
  // Both the clean legacy URL and its .html variant must resolve in a single hop.
  for (const variant of [row.old, row.old === '/' ? null : `${row.old}.html`].filter(Boolean) as string[]) {
    let res: Response;
    try {
      res = await fetch(`${BASE}${variant}`, { redirect: 'manual' });
    } catch (e) {
      errors.push(`${variant}: request failed (${(e as Error).message})`);
      continue;
    }

    if (row.status === 410) {
      if (res.status !== 410) errors.push(`${variant}: expected 410 Gone, got ${res.status}`);
      else ok410++;
      continue;
    }

    if (res.status !== 301) {
      errors.push(`${variant}: expected 301, got ${res.status}`);
      continue;
    }
    const loc = res.headers.get('location') ?? '';
    const dest = new URL(loc, BASE);
    if (dest.pathname !== row.to) {
      errors.push(`${variant}: 301 -> ${dest.pathname}, expected ${row.to}`);
      continue;
    }
    if (dest.pathname === variant) {
      errors.push(`${variant}: redirects to itself (loop)`);
      continue;
    }
    // second hop must be a terminal 200 — no chains
    const final = await fetch(dest.toString(), { redirect: 'manual' });
    if (final.status !== 200) {
      errors.push(`${variant}: 301 -> ${dest.pathname} which returned ${final.status} (chain or dead target)`);
      continue;
    }
    ok301++;
  }
}

async function main() {
  console.log(`checking ${sampled.length} of ${rows.length} redirect rows against ${BASE}`);
  for (let i = 0; i < sampled.length; i += CONCURRENCY) {
    await Promise.all(sampled.slice(i, i + CONCURRENCY).map(check));
    checked = Math.min(i + CONCURRENCY, sampled.length);
    process.stdout.write(`  checked ${checked}/${sampled.length}\r`);
  }

  console.log(`\n${ok301} single-hop 301s verified, ${ok410} 410s verified`);
  if (errors.length) {
    console.error(`${errors.length} error(s):`);
    for (const e of errors.slice(0, 60)) console.error(`  FAIL ${e}`);
    if (errors.length > 60) console.error(`  ... and ${errors.length - 60} more`);
    process.exit(1);
  }
  console.log('check-redirects: GREEN — every old URL resolves in one hop, no chains, no loops');

}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
