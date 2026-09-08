// Run: npx tsx --test lib/seo-engine/links.test.ts
//
// FIN-U01: while online checkout is paused, the plan buttons on the home page sent people
// into sign-up, onboarding and a splash screen, to reach a modal that told them to use
// WhatsApp. The conversion happens on WhatsApp, so the button goes there directly, with the
// plan named. When checkout is live again the button opens the app with the plan carried as
// context (FIN-B02), and the switch between the two is a single flag.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planCtaHref, planWhatsappText } from './links';

const gold = { key: 'gold', name: 'Gold' };

test('while checkout is paused a plan CTA goes straight to WhatsApp with the plan named (FIN-U01)', () => {
  const href = planCtaHref(gold, true);
  assert.ok(href.startsWith('https://wa.me/919355114869?text='), href);
  assert.equal(decodeURIComponent(href.split('text=')[1]), planWhatsappText('Gold'));
  assert.match(planWhatsappText('Gold'), /Gold package/);
});

test('when checkout is live a plan CTA opens the app with the plan as context (FIN-B02)', () => {
  assert.equal(planCtaHref(gold, false), '/app/auth?plan=gold');
});

test('the WhatsApp message is the one the booking app composes in its paused-checkout modal', () => {
  const spa = readFileSync(resolve(fileURLToPath(import.meta.url), '../../../..', 'app/src/pages/PricingPage.jsx'), 'utf8');
  // The app interpolates the plan name into the same sentence; both halves must stay verbatim.
  assert.ok(spa.includes("Hi MyBuddyMaid, I would like to book the ${planName || 'Gold'} package. Please help me complete the booking."));
  assert.equal(planWhatsappText('Gold'), 'Hi MyBuddyMaid, I would like to book the Gold package. Please help me complete the booking.');
});
