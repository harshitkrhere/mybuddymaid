// Run: npx tsx --test lib/__tests__/third-party-scripts.test.ts
//
// FIN-PF01: the AdSense loader ran on all 35 blog posts and inside the booking SPA's shell
// with no <ins class="adsbygoogle"> anywhere in either project — roughly 150 KB of
// third-party script plus its connections, and a content-policy review risk, for zero
// revenue. It is gone from both places; this keeps it gone unless real ad units arrive with
// it. public/ads.txt is deliberately untouched so monetising later stays a decision.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(fileURLToPath(import.meta.url), '../../../..');
/** Both front-ends: the Next.js site and the Vite booking app it embeds. */
const SCANNED = ['next-app/app', 'next-app/components', 'next-app/lib', 'app/index.html', 'app/src'];
const AD_LOADER = /adsbygoogle|googlesyndication/;

function walk(p: string, out: string[] = []): string[] {
  if (statSync(p).isDirectory()) for (const name of readdirSync(p)) walk(join(p, name), out);
  else if (/\.(tsx?|jsx?|html)$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p);
  return out;
}

test('no source file in either front-end loads AdSense (FIN-PF01)', () => {
  const hits = SCANNED.flatMap((p) => walk(join(REPO, p)))
    .filter((file) => AD_LOADER.test(readFileSync(file, 'utf8')))
    .map((file) => relative(REPO, file));
  assert.deepEqual(hits, []);
});
