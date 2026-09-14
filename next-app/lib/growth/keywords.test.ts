// Run: npx tsx --test lib/growth/keywords.test.ts
//
// The tracked set must be deterministic — a keyword list that drifts between weeks makes
// the week-over-week position meaningless — and it must read the real docs/seo/keywords.csv,
// whose fields carry quoted commas ("city (alt name, same page)").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pageTypeRank, parseCsv, parseKeywordsCsv, pickTracked } from './keywords';
import { CITY_BY_SLUG } from '../../data/seo';

const REPO = resolve(fileURLToPath(import.meta.url), '../../../..');
const rows = parseKeywordsCsv(readFileSync(resolve(REPO, 'docs/seo/keywords.csv'), 'utf8'));

test('parseCsv handles quoted commas, doubled quotes and CRLF', () => {
  assert.deepEqual(parseCsv('a,"b, c","say ""hi"""\r\n1,2,3\n'), [
    ['a', 'b, c', 'say "hi"'],
    ['1', '2', '3'],
  ]);
});

test('the real keyword set parses completely and every city is a data-layer city', () => {
  assert.ok(rows.length > 5000, `only ${rows.length} keywords parsed`);
  for (const r of rows) {
    assert.ok(r.city === 'national' || r.city === 'brand' || CITY_BY_SLUG.has(r.city as never), `unknown city ${r.city} for "${r.keyword}"`);
    assert.match(r.targetUrl, /^\//, `target of "${r.keyword}" is not a path`);
  }
});

test('pickTracked returns 20 indexable keywords, hubs before long tail, and is deterministic', () => {
  const a = pickTracked(rows, 'gurgaon');
  const b = pickTracked(rows, 'gurgaon');
  assert.equal(a.length, 20);
  assert.deepEqual(a, b);
  assert.ok(a.every((k) => k.targetIndexable && k.city === 'gurgaon'));
  const ranks = a.map((k) => pageTypeRank(k.pageType));
  for (let i = 1; i < ranks.length; i++) {
    if (a[i].priority === a[i - 1].priority) assert.ok(ranks[i] >= ranks[i - 1], 'page-type order breaks within a priority band');
  }
  assert.ok(ranks[0] <= 3, 'the first tracked keyword should target a hub page');
});
