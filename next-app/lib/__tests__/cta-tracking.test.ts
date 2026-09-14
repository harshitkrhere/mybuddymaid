// Run: npx tsx --test lib/__tests__/cta-tracking.test.ts
//
// The funnel is measured through one delegated click listener that reads data-mbm-* from
// every WhatsApp, call and app link. The audit found the footer, the contact page and the
// header untracked, the chat widget silent, and no attribution captured anywhere — so a
// visitor from an ad or a referral looked like everyone else. Source-level, like
// third-party-scripts.test.ts: the presence of the attribute is the whole fix, and the two
// front-ends' bootstraps must agree on the storage keys or the lead form reads nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ATTRIBUTION_KEYS, ATTR_FIRST_KEY, ATTR_SESSION_KEY, GA_ID } from '../../components/shared/Analytics';
import { NO_CONTEXT, trackAttrs } from '../../components/seo/CtaButtons';

const REPO = resolve(fileURLToPath(import.meta.url), '../../../..');
const read = (p: string) => readFileSync(resolve(REPO, p), 'utf8');

test('trackAttrs emits the attributes the delegated listener reads', () => {
  const a = trackAttrs('call_click', NO_CONTEXT);
  assert.equal(a['data-mbm-track'], 'call_click');
  assert.equal(a['data-mbm-city'], '(none)');
  assert.equal(trackAttrs('whatsapp_click', { whatsappText: '', city: 'noida', locality: 'sector-50' })['data-mbm-locality'], 'sector-50');
});

test('the footer, the header and the contact page track their contact links (audit gap 5)', () => {
  const footer = read('next-app/components/shared/Footer.tsx');
  assert.match(footer, /href=\{TEL_URL\}[\s\S]{0,80}trackAttrs\('call_click'/);
  assert.match(footer, /whatsappUrl\([\s\S]{0,160}trackAttrs\('whatsapp_click'/);
  assert.match(read('next-app/components/shared/Header.tsx'), /href="\/app"[\s\S]{0,120}trackAttrs\('app_click'/);
  const contact = read('next-app/app/contact/page.tsx');
  assert.match(contact, /trackAttrs\('whatsapp_click'/);
  assert.match(contact, /trackAttrs\('call_click'/);
  assert.doesNotMatch(contact, /wa\.me\/|tel:\+91/, 'the contact page must take the number from the data layer, not a literal');
});

test('both front-ends capture attribution into the same storage keys and tag their source', () => {
  const site = read('next-app/components/shared/Analytics.tsx');
  const app = read('app/index.html');
  for (const key of [ATTR_SESSION_KEY, ATTR_FIRST_KEY, ...ATTRIBUTION_KEYS]) {
    assert.ok(site.includes(key), `site bootstrap lacks ${key}`);
    assert.ok(app.includes(`"${key}"`) || app.includes(`'${key}'`), `app bootstrap lacks ${key}`);
  }
  assert.match(site, /source:'site'/);
  assert.match(app, /source:'app'/);
  assert.ok(app.includes(`googletagmanager.com/gtag/js?id=${GA_ID}`), 'the app loads the same GA4 property as the site');
  assert.ok(app.includes(`window.gtag('config','${GA_ID}'`), 'the app configures the same GA4 property as the site');
  assert.match(read('next-app/components/seo/LeadForm.tsx'), /attribution: readAttribution\(\)/);
});

test('the chat widget reports its three moments as events, never the message or the number', () => {
  const widget = read('next-app/public/chat/widget.js');
  for (const ev of ['chat_open', 'chat_escalate', 'chat_contact_submitted']) assert.ok(widget.includes(`track('${ev}')`), `widget lacks ${ev}`);
  const start = widget.indexOf("window.gtag('event', event, {");
  assert.ok(start > 0, 'the widget fires through the gtag shim');
  const payload = widget.slice(start, widget.indexOf('});', start));
  assert.doesNotMatch(payload, /\b(phone|name|content|history)\b/, 'the event payload must carry context only');
});
