// Run: npx tsx --test lib/legal/markdown.test.ts
//
// The published legal documents, parsed exactly as the pages render them. Two kinds of
// check: the parser handles every construct the documents use (a construct it does not know
// is a mistake in the document, not something to render loosely), and the documents say what
// the data layer says — plan fees, profile counts, the refund window, the non-refundable
// component, the support hours, the widget's notice — so a number cannot drift between the
// pricing page, the assistant and the contract.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLegal, parseInline, plain, textOf } from './markdown';
import { legalDocument, legalSource } from './documents';
import { PLANS, REFUND_WINDOW_DAYS, REFUND_PROFILE_THRESHOLD, NON_REFUNDABLE_FEE } from '../../data/seo';
import { SUPPORT_HOURS, SUPPORT_PHONE_DISPLAY, SUPPORT_EMAIL } from '../../data/seo/contact';
import { COPY } from '../assistant/copy';

const inr = (n: number) => `₹${new Intl.NumberFormat('en-IN').format(n)}`;

// ─── The parser ─────────────────────────────────────────────────────────────────────────────

test('parseInline: bold and links, nothing else', () => {
  assert.deepEqual(parseInline('a **b** [c](/d) e'), [
    { kind: 'text', text: 'a ' },
    { kind: 'strong', text: 'b' },
    { kind: 'text', text: ' ' },
    { kind: 'link', text: 'c', href: '/d' },
    { kind: 'text', text: ' e' },
  ]);
  assert.equal(plain(parseInline('**x** and [y](https://z)')), 'x and y');
});

test('parseLegal: title, meta, numbered sections with fixed anchors, clauses, quotes, lists and tables', () => {
  const doc = parseLegal(
    [
      '# Test Document',
      '',
      'Effective date: 1 January 2027',
      'Version: 9.9',
      '',
      '## At a glance',
      '',
      '- one',
      '- two',
      '',
      '## 1. Scope {#scope}',
      '',
      '> **Summary:** short.',
      '',
      '1.1 **Who.** We are us.',
      'Continued on the next line.',
      '',
      '### Detail',
      '',
      '| A | B |',
      '|---|---|',
      '| 1 | **2** |',
      '',
      '## Annexure A: Fees {#annexure-a}',
      '',
      'A.1 **Fees.** Listed.',
    ].join('\n'),
  );
  assert.equal(doc.title, 'Test Document');
  assert.deepEqual(doc.meta, { 'Effective date': '1 January 2027', Version: '9.9' });
  assert.deepEqual(
    doc.sections.map((s) => [s.number, s.id, s.title]),
    [
      [null, 'at-a-glance', 'At a glance'],
      ['1', 'scope', 'Scope'],
      ['Annexure A', 'annexure-a', 'Fees'],
    ],
  );
  const scope = doc.sections[1].blocks;
  assert.equal(scope[0].type, 'quote');
  assert.deepEqual(scope[1], { type: 'p', clause: '1.1', inline: parseInline('**Who.** We are us. Continued on the next line.') });
  assert.deepEqual(scope[2], { type: 'h3', id: null, text: 'Detail' });
  assert.equal(scope[3].type, 'table');
  if (scope[3].type === 'table') assert.deepEqual(scope[3].rows[0][1], [{ kind: 'strong', text: '2' }]);
  assert.equal((doc.sections[2].blocks[0] as { clause: string }).clause, 'A.1');
});

test('parseLegal refuses what it does not understand rather than rendering it loosely', () => {
  assert.throws(() => parseLegal('Not a title'), /starts with/);
  assert.throws(() => parseLegal('# T\n\nloose text\n\n## 1. A'), /before the first section/);
  assert.throws(() => parseLegal('# T\n\n## 1. A\n\n#### deep'), /unsupported heading/);
  assert.throws(() => parseLegal('# T\n\n## 1. A\n\n| a |\n| 1 |'), /separator/);
});

// ─── The published documents ────────────────────────────────────────────────────────────────

const privacy = legalDocument('privacy-policy');
const terms = legalDocument('terms-of-service');
const privacyText = textOf(privacy);
const termsText = textOf(terms);

test('both documents parse, are version 2.0, and carry no leftover placeholder or draft marker', () => {
  for (const [doc, source] of [
    [privacy, legalSource('privacy-policy')],
    [terms, legalSource('terms-of-service')],
  ] as const) {
    assert.equal(doc.meta.Version, '2.0');
    assert.match(doc.meta['Effective date'], /^\d{1,2} [A-Z][a-z]+ 20\d\d$/);
    assert.doesNotMatch(source, /\[[A-Z][A-Z /-]{2,}[^\]]*\]/, 'a [PLACEHOLDER] survived');
    assert.doesNotMatch(source, /draft for legal review|not yet in force|TBD|TODO/i);
    assert.doesNotMatch(source, /Pvt Limited|Bengaluru|Karnataka|Kannada/, 'the pre-incorporation entity or city survived');
  }
});

test('every numbered section has a fixed anchor and anchors are unique within a document', () => {
  for (const doc of [privacy, terms]) {
    const ids = doc.sections.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const s of doc.sections) if (s.number) assert.match(s.id, /^[a-z][a-z0-9-]+$/);
  }
  assert.ok(privacy.sections.some((s) => s.id === 'your-rights'));
  assert.ok(terms.sections.some((s) => s.id === 'refunds'));
});

test('the company, its CIN, the Delhi registered office and the Grievance Officer appear in both', () => {
  for (const t of [privacyText, termsText]) {
    assert.ok(t.includes('MyBuddyMaid Private Limited'));
    assert.ok(t.includes('U96908DC2026PTC474931'));
    assert.ok(t.includes('Darya Ganj, New Delhi, Central Delhi 110002'));
    assert.ok(t.includes('Shivraj Singh'));
    assert.ok(t.includes('governance@mybuddymaid.in'));
  }
});

test('the terms quote every plan exactly as plans.ts has it', () => {
  for (const p of PLANS) {
    assert.ok(termsText.includes(p.name), `plan ${p.name}`);
    assert.ok(termsText.includes(inr(p.fee)), `fee ${inr(p.fee)} for ${p.name}`);
  }
  assert.ok(termsText.includes(`${REFUND_WINDOW_DAYS} days`), 'refund window');
  assert.ok(termsText.includes(inr(NON_REFUNDABLE_FEE)), 'the non-refundable component');
  assert.ok(new RegExp(`${['zero', 'one', 'two', 'three', 'four', 'five'][REFUND_PROFILE_THRESHOLD]} \\(${REFUND_PROFILE_THRESHOLD}\\) suitable`).test(termsText), 'profile threshold');
  assert.ok(termsText.includes(SUPPORT_PHONE_DISPLAY));
  assert.ok(termsText.includes('Monday to Saturday, 10:00 AM to 7:00 PM IST'), 'support hours in Annexure B');
  assert.equal(SUPPORT_HOURS.label, 'Mon–Sat, 10 AM–7 PM IST');
  assert.ok(termsText.includes('no GST is charged'), 'GST position');
  assert.ok(termsText.includes('Delhi International Arbitration Centre'));
});

test('the privacy policy carries the assistant notice verbatim, the support email, and the providers the code uses', () => {
  const quote = privacy.sections.flatMap((s) => s.blocks).find((b) => b.type === 'quote' && plain(b.inline).includes('You are chatting with'));
  assert.ok(quote && quote.type === 'quote');
  const noticeInPolicy = plain(quote.inline).replace(/^Before you start\.\s*/, '');
  assert.equal(noticeInPolicy, COPY.notice, 'Privacy Policy §2.2 must equal the widget notice, word for word');
  assert.ok(privacyText.includes(SUPPORT_EMAIL));
  for (const provider of ['PayU', 'Supabase', 'Chatwoot', 'OpenRouter', 'Umami']) assert.ok(privacyText.includes(provider), provider);
});
