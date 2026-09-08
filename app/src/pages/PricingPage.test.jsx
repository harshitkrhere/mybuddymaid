// Run: npm test (vitest) from app/
//
// FIN-B04: the Razorpay sheet, the last thing a customer reads before paying, described a
// 12-month plan as "12 days". create-razorpay-order returns plan_duration in months, so the
// unit has to match here. This is a source-level assertion rather than a render: with
// PURCHASES_PAUSED the checkout path cannot be reached from the UI, and the string is the
// whole defect.
import { expect, test } from 'vitest';
import source from './PricingPage.jsx?raw';

test('the Razorpay checkout description states the plan term in months (FIN-B04)', () => {
  const description = source.match(/description:\s*`([^`]*)`/);
  expect(description, 'the options.description template literal').not.toBeNull();
  expect(description[1]).toContain('${orderData.plan_duration} months');
  expect(description[1]).not.toMatch(/\bdays?\b/);
});
