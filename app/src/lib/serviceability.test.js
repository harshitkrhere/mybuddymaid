// Run: npm test (vitest) from app/
//
// FIN-U01: the paused-checkout switch used to be a constant inside PricingPage.jsx that the
// website could not see. It now lives in next-app/data/seo/plans.ts and reaches the app
// through the generated serviceability.json, so one change flips both front-ends.
import { expect, test } from 'vitest';
import data from './serviceability.json';
import { PURCHASES_PAUSED } from './serviceability';
import pricingSource from '../pages/PricingPage.jsx?raw';

test('the paused-checkout flag comes from the data layer export', () => {
  expect(typeof data.purchasesPaused).toBe('boolean');
  expect(PURCHASES_PAUSED).toBe(data.purchasesPaused);
});

test('PricingPage reads the flag from the export, not a local constant', () => {
  expect(pricingSource).not.toMatch(/const PURCHASES_PAUSED\s*=/);
  expect(pricingSource).toMatch(/import \{[^}]*PURCHASES_PAUSED[^}]*\} from '\.\.\/lib\/serviceability'/);
});
