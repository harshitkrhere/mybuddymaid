// scripts/growth/release-batch.ts — the two submissions that follow a deploy which released a
// sitemap shard (a Phase 5 entity batch, or a re-published core shard): IndexNow for the
// shard's URLs (reaches Bing, Yandex, Naver and the rest) and the sitemap index re-submitted
// to Bing. Google discovers the shard through the sitemap index it already has; the Google
// Indexing API is deliberately not used (scripts/seo/indexnow.ts explains why).
//
//   $env:INDEXNOW_KEY = '<key>'; $env:BING_WEBMASTER_API_KEY = '<key>'
//   npm run release:batch -- entities-gurgaon-pilot-1
import { spawnSync } from 'node:child_process';
import { args, fail } from './_env';

const shard = args[0];
if (!shard || shard.startsWith('--')) fail('usage: npm run release:batch -- <sitemap shard name, e.g. entities-gurgaon-pilot-1>');

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (label: string, scriptArgs: string[]) => {
  console.log(`\n> ${label}`);
  const r = spawnSync(npm, scriptArgs, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) fail(`${label} failed (exit ${r.status})`);
};

run(`IndexNow: ${shard}`, ['run', 'seo:indexnow', '--', '--batch', shard]);
run('Bing: re-submit the sitemap index', ['run', 'growth:bing', '--', '--submit-sitemap']);
console.log(`\nreleased ${shard}: now record the batch in docs/seo/rollout-log.md; the daily census picks the new URLs up on its own.`);
