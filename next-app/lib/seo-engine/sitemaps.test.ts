// Run: npx tsx --test lib/seo-engine/sitemaps.test.ts
//
// FIN-SEO04: /privacy-policy and /terms-of-service were indexable and linked from every
// footer but absent from TRUST_PAGES, so they were the only indexable pages on the site
// outside the sitemap and the IndexNow list. Data-driven, like lib/blog/legacy-header.test.ts:
// the assertions run over the real shards, so they fail if the trust list drifts again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allIndexableUrls, buildShards } from './sitemaps';

const LEGAL_PAGES = ['/privacy-policy', '/terms-of-service'];
const shards = buildShards();

test('both legal pages are in the global-core shard (FIN-SEO04)', () => {
  const core = shards.find((s) => s.name === 'global-core-1');
  assert.ok(core, 'global-core-1 shard exists');
  for (const path of LEGAL_PAGES) {
    assert.ok(core.urls.some((u) => u.loc === path), `${path} is missing from global-core-1`);
  }
});

test('both legal pages are in the indexable URL list the crawl and IndexNow tooling reads (FIN-SEO04)', () => {
  const urls = allIndexableUrls();
  for (const path of LEGAL_PAGES) assert.ok(urls.includes(path), `${path} is missing from allIndexableUrls()`);
});

test('every sitemap entry is a unique site-relative path with a dated lastmod', () => {
  const seen = new Set<string>();
  for (const u of shards.flatMap((s) => s.urls)) {
    assert.match(u.loc, /^\/\S*$/, `not site-relative: ${u.loc}`);
    assert.match(u.lastmod, /^\d{4}-\d{2}-\d{2}/, `lastmod is not a date: ${u.loc} → ${u.lastmod}`);
    assert.ok(!seen.has(u.loc), `duplicate sitemap entry: ${u.loc}`);
    seen.add(u.loc);
  }
});
