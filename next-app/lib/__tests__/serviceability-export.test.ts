// Run: npx tsx --test lib/__tests__/serviceability-export.test.ts
//
// The booking app reads its footprint, its plans and the paused-checkout flag from a committed
// JSON export of data/seo (app/src/lib/serviceability.json, written by `npm run seo:export-spa`).
// A stale export means the two front-ends disagree about money or about whether checkout is
// open (FIN-U01, FIN-P05). Data-driven, over the real files: this fails the moment the export
// lags the source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLANS, PURCHASES_PAUSED, SERVICES } from '../../data/seo';

const REPO = resolve(fileURLToPath(import.meta.url), '../../../..');
const exported = JSON.parse(readFileSync(resolve(REPO, 'app/src/lib/serviceability.json'), 'utf8'));

test('serviceability.json carries the current paused-checkout flag (FIN-U01)', () => {
  assert.equal(exported.purchasesPaused, PURCHASES_PAUSED);
});

test('serviceability.json carries the current plans', () => {
  assert.deepEqual(exported.plans, PLANS);
});

test('every booking-app service id maps to a data-layer service that exists', () => {
  for (const [spaId, slug] of Object.entries(exported.spaServiceMap as Record<string, string>)) {
    assert.ok(SERVICES.some((s) => s.slug === slug), `${spaId} maps to unknown service ${slug}`);
  }
});
