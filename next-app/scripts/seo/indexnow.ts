// scripts/seo/indexnow.ts — submits new/changed URLs to IndexNow (Bing, Yandex, Naver
// and others) after a deploy. Batches of <= 10,000 URLs per request, as the API requires.
// The key file must be reachable at https://mybuddymaid.in/<key>.txt containing the key.
//
//   INDEXNOW_KEY=<32-64 hex chars> npx tsx scripts/seo/indexnow.ts            # all indexable URLs
//   INDEXNOW_KEY=... npx tsx scripts/seo/indexnow.ts --since 2026-09-01       # changed since a date
//   INDEXNOW_KEY=... npx tsx scripts/seo/indexnow.ts --batch entities-gurgaon-1
//   npx tsx scripts/seo/indexnow.ts --write-key                               # emit public/<key>.txt
//
// NOTE: do NOT use the Google Indexing API for these pages — it is only for JobPosting
// and BroadcastEvent, and misuse risks a manual action. Google discovers these pages
// through the sitemap index instead.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { allIndexableUrls, buildShards } from '../../lib/seo-engine/sitemaps';
import { SITE_URL } from '../../lib/seo-engine/meta';
import { allCorePages } from '../../lib/seo-engine/compose';

const KEY = process.env.INDEXNOW_KEY ?? '';
const HOST = new URL(SITE_URL).host;
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_BATCH = 10000;

const args = process.argv.slice(2);
const argValue = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

if (args.includes('--write-key')) {
  if (!/^[a-f0-9]{32,64}$/i.test(KEY)) {
    console.error('INDEXNOW_KEY must be 32-64 hexadecimal characters');
    process.exit(1);
  }
  const file = path.join(process.cwd(), 'public', `${KEY}.txt`);
  fs.writeFileSync(file, KEY);
  console.log(`wrote ${file} — deploy it so https://${HOST}/${KEY}.txt serves the key`);
  process.exit(0);
}

if (!/^[a-f0-9]{32,64}$/i.test(KEY)) {
  console.error('Set INDEXNOW_KEY to a 32-64 character hex key (and publish public/<key>.txt first).');
  process.exit(1);
}

function urlsToSubmit(): string[] {
  const batch = argValue('--batch');
  if (batch) {
    const shard = buildShards().find((s) => s.name === batch || s.name.startsWith(`${batch}-`));
    if (!shard) {
      console.error(`No sitemap shard named '${batch}'. Available: ${buildShards().map((s) => s.name).join(', ')}`);
      process.exit(1);
    }
    return shard.urls.map((u) => u.loc);
  }
  const since = argValue('--since');
  if (since) {
    const out: string[] = [];
    for (const p of allCorePages()) if (p.updatedAt >= since) out.push(p.path);
    return out;
  }
  return allIndexableUrls();
}

async function main() {
  const paths = [...new Set(urlsToSubmit())];
  const urls = paths.map((p) => `${SITE_URL}${p}`);
  console.log(`submitting ${urls.length} URLs to IndexNow as ${HOST}`);

  let submitted = 0;
  for (let i = 0; i < urls.length; i += MAX_BATCH) {
    const urlList = urls.slice(i, i + MAX_BATCH);
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `${SITE_URL}/${KEY}.txt`, urlList }),
    });
    // IndexNow returns 200 (accepted) or 202 (accepted, key pending validation).
    if (res.status !== 200 && res.status !== 202) {
      console.error(`batch ${i / MAX_BATCH + 1}: HTTP ${res.status} ${await res.text()}`);
      process.exit(1);
    }
    submitted += urlList.length;
    console.log(`  batch ${i / MAX_BATCH + 1}: ${urlList.length} URLs, HTTP ${res.status}`);
  }
  console.log(`indexnow: submitted ${submitted} URLs`);

}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
