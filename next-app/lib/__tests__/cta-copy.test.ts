// Run: npx tsx --test lib/__tests__/cta-copy.test.ts
//
// W2 Tranche A, the last four items (A3, A5, A6, A7), wording approved by the owner on
// 2026-09-15. Source-level where the presence of an element is the whole change, data-driven
// where a function decides per page: the reply-time line comes from the published hours and
// never from a literal; every proof line is a sentence that already stands on /how-we-verify;
// the hero demotes the app to a text link only while checkout is paused; every guide and the
// services index carry the buttons, and a guide about a city we do not serve never names it
// as an offer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUPPORT_HOURS } from '../../data/seo/contact';
import { CITY_BY_SLUG } from '../../data/seo';
import { BLOG_POSTS } from '../../data/blog/posts';
import { tagsOf } from '../../data/blog/tags';
import { ctaForPost, GENERIC_WHATSAPP_TEXT } from '../blog/links';
import { PROOF_LINES } from '../../components/seo/ProofStrip';
import { replyTimeLine } from '../../components/seo/CtaButtons';

const REPO = resolve(fileURLToPath(import.meta.url), '../../../..');
const read = (p: string) => readFileSync(resolve(REPO, p), 'utf8');

test('A3: the reply-time line is built from the published hours, never typed in', () => {
  const line = replyTimeLine();
  assert.ok(line.includes(SUPPORT_HOURS.label), line);
  assert.ok(line.includes(`within ${SUPPORT_HOURS.replyWithinHours} hours`), line);
  const src = read('next-app/components/seo/CtaButtons.tsx');
  assert.doesNotMatch(src, /10 AM|7 PM|24 hours/, 'no literal hours in the component');
  assert.match(src, /\{!compact && <p className="cta-note">\{replyTimeLine\(\)\}<\/p>\}/, 'every non-compact button row carries the line');
});

test('A5: every proof line is a sentence that already stands on /how-we-verify, and the strip sits in the hero', () => {
  const verify = read('next-app/app/how-we-verify/page.tsx');
  assert.equal(PROOF_LINES.length, 3);
  for (const l of PROOF_LINES) assert.match(verify, l.source, `"${l.text}" is not backed by the verification page`);
  const page = read('next-app/components/seo/SeoPage.tsx');
  const hero = page.slice(page.indexOf('<header className="hero">'), page.indexOf('</header>'));
  assert.match(hero, /<CtaButtons ctx=\{m\.cta\} hero \/>\s*<ProofStrip \/>/);
});

test('A6: while checkout is paused the hero shows WhatsApp and call as buttons and the app as a tracked text link; the closing CTA is unchanged', () => {
  const src = read('next-app/components/seo/CtaButtons.tsx');
  assert.match(src, /const appAsLink = hero && PURCHASES_PAUSED;/);
  assert.match(src, /\{!compact && !appAsLink && \(\s*<a className="btn btn-app"/);
  assert.match(src, /<a className="cta-link" href=\{appHref\} \{\.\.\.trackAttrs\('app_click', ctx\)\}>\s*book in the app/);
  const page = read('next-app/components/seo/SeoPage.tsx');
  const closing = page.slice(page.indexOf('<section className="final-cta">'), page.indexOf('</section>', page.indexOf('<section className="final-cta">')));
  assert.match(closing, /<CtaButtons ctx=\{m\.cta\} \/>/, 'no hero flag on the closing CTA');
});

test('A7: the guides and the services index carry the buttons and the sticky bar', () => {
  const post = read('next-app/app/blog/[slug]/page.tsx');
  assert.match(post, /const cta = ctaForPost\(slug\);/);
  assert.match(post, /<CtaButtons ctx=\{cta\} \/>/);
  assert.match(post, /<StickyCta ctx=\{cta\} \/>/);
  const services = read('next-app/app/services/page.tsx');
  assert.match(services, /<CtaButtons ctx=\{cta\} \/>/);
  assert.match(services, /<StickyCta ctx=\{cta\} \/>/);
  assert.match(read('next-app/app/blog/page.tsx'), /<CtaButtons ctx=\{siteContext\(GENERIC_WHATSAPP_TEXT\)\} compact \/>/);
});

test('A7: the WhatsApp message names what each guide is about, and never a city we do not serve', () => {
  assert.ok(BLOG_POSTS.length >= 30);
  for (const p of BLOG_POSTS) {
    const t = tagsOf(p.slug);
    const c = ctaForPost(p.slug);
    assert.match(c.whatsappText, /^Hi MyBuddyMaid, /, p.slug);
    if (t.outsideFootprint) {
      assert.equal(c.whatsappText, GENERIC_WHATSAPP_TEXT, p.slug);
      assert.equal(c.city, '', p.slug);
    } else if (t.kind === 'city-guide' && t.cities?.length) {
      const city = CITY_BY_SLUG.get(t.cities[0])!;
      assert.equal(c.city, city.slug, p.slug);
      assert.ok(c.whatsappText.includes(city.name), `${p.slug}: ${c.whatsappText}`);
    } else if (t.kind === 'service-guide' && t.services?.length) {
      assert.equal(c.service, t.services[0], p.slug);
      assert.equal(c.city, '', p.slug);
    } else {
      assert.ok(c.whatsappText.includes(p.title), p.slug);
    }
  }
  assert.equal(ctaForPost('no-such-guide').whatsappText, GENERIC_WHATSAPP_TEXT);
});
