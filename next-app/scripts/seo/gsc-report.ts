// scripts/seo/gsc-report.ts — weekly Search Console export, broken down by city,
// locality and service so performance is readable against the page architecture rather
// than as one flat URL list.
//
// Requires a Google service account with access to the Search Console property:
//   1. Create a service account, download its JSON key.
//   2. In Search Console, add its client_email as a user on the property.
//   3. GSC_SERVICE_ACCOUNT_JSON=/path/to/key.json npx tsx scripts/seo/gsc-report.ts
//
// Optional flags: --days 28 (default) · --site sc-domain:mybuddymaid.in
// Output: reports/gsc-YYYY-MM-DD.csv plus a summary table on stdout.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createSign } from 'node:crypto';
import { ALL_LOCALITIES, CITY_BY_SLUG, SERVICE_BY_SLUG } from '../../data/seo';

const KEY_FILE = process.env.GSC_SERVICE_ACCOUNT_JSON;
const args = process.argv.slice(2);
const argValue = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};
const SITE = argValue('--site') ?? 'sc-domain:mybuddymaid.in';
const DAYS = Number(argValue('--days') ?? 28);
const END = argValue('--end');

if (!KEY_FILE || !fs.existsSync(KEY_FILE)) {
  console.error('Set GSC_SERVICE_ACCOUNT_JSON to the path of a service-account key with access to the property.');
  process.exit(1);
}

interface KeyFile {
  client_email: string;
  private_key: string;
}

/** Mint a Google OAuth access token from the service-account key (JWT bearer flow). */
async function accessToken(key: KeyFile): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const header = b64({ alg: 'RS256', typ: 'JWT' });
  const claims = b64({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  });
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(key.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

interface Row {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** Classify a URL against the page architecture. */
function classify(url: string) {
  const p = new URL(url).pathname.replace(/\/$/, '') || '/';
  const seg = p.split('/').filter(Boolean);
  if (p === '/') return { type: 'home', city: '', locality: '', service: '' };
  if (seg[0] === 'services') {
    return { type: seg.length === 2 ? 'service-hub' : 'service-city', city: seg[2] ?? '', locality: '', service: seg[1] ?? '' };
  }
  if (seg[0] === 'pincode') return { type: 'pincode', city: '', locality: '', service: '' };
  if (seg[0] === 'blog') return { type: 'blog', city: '', locality: '', service: '' };
  if (seg.length === 1) return { type: CITY_BY_SLUG.has(seg[0] as never) ? 'city' : 'trust', city: seg[0], locality: '', service: '' };
  if (seg.length === 2) {
    const isLocality = ALL_LOCALITIES.some((l) => l.city === seg[0] && l.slug === seg[1]);
    return { type: isLocality ? 'locality' : 'zone', city: seg[0], locality: isLocality ? seg[1] : '', service: '' };
  }
  if (seg.length === 3 && SERVICE_BY_SLUG.has(seg[2] as never)) {
    return { type: 'service-locality', city: seg[0], locality: seg[1], service: seg[2] };
  }
  return { type: 'entity', city: seg[0], locality: seg[1], service: seg[3] ?? '' };
}

async function main() {
  const key = JSON.parse(fs.readFileSync(KEY_FILE!, 'utf8')) as KeyFile;
  const token = await accessToken(key);
  const end = END ? new Date(END) : new Date(Date.now() - 2 * 86400000); // GSC lags ~2 days
  const start = new Date(end.getTime() - DAYS * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const rows: Row[] = [];
  let startRow = 0;
  for (;;) {
    const res = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          startDate: iso(start),
          endDate: iso(end),
          dimensions: ['page', 'query'],
          rowLimit: 25000,
          startRow,
          type: 'web',
        }),
      },
    );
    if (!res.ok) throw new Error(`GSC query failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { rows?: Row[] };
    const batch = body.rows ?? [];
    rows.push(...batch);
    if (batch.length < 25000) break;
    startRow += batch.length;
  }

  const outDir = path.resolve(process.cwd(), '..', 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `gsc-${iso(end)}.csv`);
  const lines = ['page,query,page_type,city,locality,service,clicks,impressions,ctr,position'];
  for (const r of rows) {
    const [page, query] = r.keys;
    const c = classify(page);
    lines.push(
      `${page},"${query.replace(/"/g, '""')}",${c.type},${c.city},${c.locality},${c.service},${r.clicks},${r.impressions},${r.ctr.toFixed(4)},${r.position.toFixed(1)}`,
    );
  }
  fs.writeFileSync(file, lines.join('\n') + '\n');

  const byType = new Map<string, { clicks: number; impressions: number; pages: Set<string> }>();
  for (const r of rows) {
    const c = classify(r.keys[0]);
    const agg = byType.get(c.type) ?? { clicks: 0, impressions: 0, pages: new Set<string>() };
    agg.clicks += r.clicks;
    agg.impressions += r.impressions;
    agg.pages.add(r.keys[0]);
    byType.set(c.type, agg);
  }
  console.log(`\nGSC ${iso(start)} to ${iso(end)} — ${rows.length} page/query rows -> ${file}\n`);
  console.log('| Page type | Pages with impressions | Clicks | Impressions |');
  console.log('|---|---|---|---|');
  for (const [t, a] of [...byType].sort((x, y) => y[1].clicks - x[1].clicks)) {
    console.log(`| ${t} | ${a.pages.size} | ${a.clicks} | ${a.impressions} |`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
