// Run: npx tsx --test lib/seo-engine/internal-links.test.ts
//
// Three internal-linking gaps the growth work closed on 2026-09-14, pinned over the real
// estate: every location page links a guide that applies to it (and never one about a city
// we do not serve), nearby-link anchors rotate instead of repeating one phrase 2,500 times,
// and the home page no longer emits a one-item BreadcrumbList (FIN-SEO05). Plus the SERP
// description fix: neighbours are named as the data layer names them, not title-cased slugs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_LOCALITIES, CITIES, CITY_BY_SLUG, LOCALITY_BY_PATH, SERVICES } from '../../data/seo';
import { BLOG_BY_SLUG } from '../../data/blog/posts';
import { BLOG_TAGS, tagsOf } from '../../data/blog/tags';
import { areasForPost, guidesForPage } from '../blog/links';
import { composeHome, composeLocality, composeServiceLocality } from './compose';
import { localityMeta } from './meta';

const OUTSIDE = new Set(Object.entries(BLOG_TAGS).filter(([, t]) => t.outsideFootprint).map(([s]) => s));

test('every tagged guide exists, and every city guide names only cities in the footprint', () => {
  for (const [slug, t] of Object.entries(BLOG_TAGS)) {
    assert.ok(BLOG_BY_SLUG.has(slug), `${slug} is tagged but is not a post`);
    for (const c of t.cities ?? []) assert.ok(CITY_BY_SLUG.has(c), `${slug} names unknown city ${c}`);
  }
  assert.deepEqual([...OUTSIDE].sort(), ['domestic-help-guide-chennai-2026', 'domestic-help-guide-hyderabad-2026', 'domestic-help-guide-jaipur-2026', 'domestic-help-guide-kolkata-2026']);
});

test('every locality and service × locality page links a guide that applies to it, never one about a city we do not serve', () => {
  for (const loc of ALL_LOCALITIES) {
    const hub = composeLocality(loc);
    const guides = hub.related.filter((r) => r.path.startsWith('/blog/'));
    assert.ok(guides.length >= 1, `${hub.path} links no guide`);
    for (const g of guides) {
      const slug = g.path.slice('/blog/'.length);
      assert.ok(BLOG_BY_SLUG.has(slug), `${hub.path} links a missing guide ${slug}`);
      assert.ok(!OUTSIDE.has(slug), `${hub.path} links ${slug}, a guide for a city we do not serve`);
    }
    for (const svc of SERVICES) {
      const page = composeServiceLocality(svc, loc);
      const svcGuides = page.related.filter((r) => r.path.startsWith('/blog/'));
      assert.ok(svcGuides.length >= 1, `${page.path} links no guide`);
      const serviceGuide = svcGuides.find((g) => tagsOf(g.path.slice('/blog/'.length)).services?.includes(svc.slug));
      assert.ok(serviceGuide, `${page.path} links no guide about ${svc.slug}`);
    }
  }
});

test('guides are spread across pages rather than one guide collecting every link', () => {
  const picks = new Set(ALL_LOCALITIES.map((l) => guidesForPage(`/${l.city}/${l.slug}`, l.city).map((g) => g.path).join('|')));
  assert.ok(picks.size > 4, `only ${picks.size} distinct guide combinations across ${ALL_LOCALITIES.length} hubs`);
});

test('nearby-link anchors rotate on a hub page, and every variant is a sentence the gate counts', () => {
  const noida = ALL_LOCALITIES.find((l) => l.city === 'noida' && l.neighbours.length >= 6);
  assert.ok(noida);
  const hub = composeLocality(noida);
  const templates = new Set(hub.nearby.map((n) => n.anchor.replace(n.name, 'X')));
  assert.ok(templates.size > 1, `all hub anchors share one phrase: ${hub.nearby[0]?.anchor}`);
  // scripts/seo/uniqueness.ts ignores "sentences" under four words; a shorter anchor would
  // drop a local sentence and move marginal pages across the index line
  for (const n of hub.nearby) assert.ok(n.anchor.split(/\s+/).length >= 4, `anchor too short for the gate: "${n.anchor}"`);
});

test('the home page emits no one-item BreadcrumbList (FIN-SEO05)', () => {
  const types = composeHome().jsonld.map((j) => (j as { '@type': string })['@type']);
  assert.ok(!types.includes('BreadcrumbList'));
  assert.ok(types.includes('FAQPage'));
});

test('a description names neighbours as the data layer names them (no title-cased slugs)', () => {
  let checked = 0;
  for (const loc of ALL_LOCALITIES) {
    const city = CITY_BY_SLUG.get(loc.city)!;
    const d = localityMeta(loc, city).description;
    const m = d.match(/Also serving (.+?), (.+?) & nearby/);
    if (!m) continue;
    checked++;
    for (const shown of [m[1], m[2]]) {
      const real = loc.neighbours.some((s) => LOCALITY_BY_PATH.get(`${loc.city}/${s}`)?.name === shown);
      assert.ok(real, `${loc.city}/${loc.slug}: "${shown}" is not a locality name`);
    }
  }
  assert.ok(checked > 100, `only ${checked} descriptions carried neighbours`);
});

test('a guide lists the places it applies to, and a guide about a city we do not serve lists the cities we do', () => {
  const gurgaon = areasForPost('domestic-help-guide-gurugram-2026');
  assert.ok(gurgaon.some((a) => a.path === '/gurgaon'));
  assert.ok(gurgaon.some((a) => a.path === '/services/cook/gurgaon'));
  assert.ok(gurgaon.every((a) => a.path.startsWith('/gurgaon') || a.path.endsWith('/gurgaon')));
  const cook = areasForPost('hiring-cook-for-indian-home-guide');
  assert.ok(cook.some((a) => a.path === '/services/cook'));
  assert.equal(cook.filter((a) => a.path.startsWith('/services/cook/')).length, CITIES.filter((c) => c.tier === 1).length);
  const chennai = areasForPost('domestic-help-guide-chennai-2026');
  assert.deepEqual(
    chennai.map((a) => a.path).sort(),
    CITIES.map((c) => `/${c.slug}`).sort(),
  );
});
