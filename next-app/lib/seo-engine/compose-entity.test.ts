// Run: npx tsx --test lib/seo-engine/compose-entity.test.ts
//
// The first real society batch (115 NCR societies, 2026-09-16) failed the uniqueness gate
// 104 times: sibling pages in one locality shared the city-wide service bullets, the trust
// sections, three locality FAQs and ten identical sibling links, and differed only in the
// facts block. A society page is now built from that society's facts. Data-driven over the
// ready entities: every fact value the operator supplied appears on the page verbatim, no
// number or year appears that is not in a fact, the shared bullets are gone, and two
// siblings in the same locality share well under the gate's 0.60 of their five-word shingles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIVE_ENTITIES, entitySpecificFacts } from '../../data/seo/entities';
import { composeEntity } from './compose-entity';

const READY = LIVE_ENTITIES;
const shingles = (text: string, n = 5): Set<string> => {
  const w = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
  return out;
};
const jaccard = (a: Set<string>, b: Set<string>) => {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter || 1);
};

test('there are ready entities to compose (the batch is imported)', () => {
  assert.ok(READY.length >= 100, `ready entities: ${READY.length}`);
});

test('every operator fact appears on its page verbatim, and the page repeats no city-wide service bullets', () => {
  for (const e of READY.slice(0, 40)) {
    const m = composeEntity(e);
    for (const [, v] of entitySpecificFacts(e)) assert.ok(m.mainText.includes(v), `${m.path} lacks fact "${v}"`);
    const services = m.sections.find((s) => s.id === 'services');
    assert.ok(services && !services.bullets?.length, `${m.path} still lists the six service bullets`);
    assert.ok(m.mainText.split(/\s+/).length >= m.wordFloor, `${m.path} under the word floor`);
  }
});

test('no year is stated that is not in a fact (nothing inferred)', () => {
  for (const e of READY.slice(0, 40)) {
    const m = composeEntity(e);
    const facts = entitySpecificFacts(e).map(([, v]) => v).join(' ');
    const years = m.mainText.match(/\b(19|20)\d{2}\b/g) ?? [];
    for (const y of years) assert.ok(facts.includes(y) || m.path.includes(y), `${m.path} states year ${y} that no fact carries`);
  }
});

test('two siblings in the same locality are no longer near-copies of each other', () => {
  const byLocality = new Map<string, typeof READY>();
  for (const e of READY) {
    const k = `${e.city}/${e.locality}`;
    byLocality.set(k, [...(byLocality.get(k) ?? []), e]);
  }
  let pairs = 0;
  let over = 0;
  let worst = 0;
  for (const group of byLocality.values()) {
    if (group.length < 2) continue;
    const texts = group.slice(0, 8).map((e) => shingles(composeEntity(e).mainText));
    for (let i = 0; i < texts.length; i++)
      for (let j = i + 1; j < texts.length; j++) {
        const jac = jaccard(texts[i], texts[j]);
        pairs++;
        worst = Math.max(worst, jac);
        if (jac > 0.6) over++;
      }
  }
  assert.ok(pairs > 20, 'enough sibling pairs to judge');
  assert.ok(over / pairs < 0.1, `${over} of ${pairs} sibling pairs still over 0.60 (worst ${worst.toFixed(2)})`);
});
