// lib/assistant/knowledge.ts — everything the support assistant is allowed to know.
//
// The assistant answers only from this corpus, and every entry names the page it came from.
// Nothing here is written for the bot: it is the same data that renders the 2,513 SEO pages,
// the pricing page and the trust pages, read through the same exports. A price the bot quotes
// is the price the pricing page shows, because they are the same constant (plans.ts).
//
// Two consequences follow, and both are deliberate:
//   - Fixing a wrong or missing answer means adding a FAQ to data/seo/faqs/ or the city, zone
//     and locality content, which improves the SEO pages at the same time.
//   - The number gate in answer.ts allows only numbers that occur in the entries used to
//     answer a question. A model that "remembers" an old price cannot get it past the gate,
//     because the old price occurs nowhere in this corpus.

import {
  CITIES,
  CITY_FAQ_POOLS,
  ZONE_FAQ_POOLS,
  ZONES,
  ALL_LOCALITIES,
  SERVICES,
  PLANS,
  GLOBAL_FAQS,
  HOUSING_FAQ_POOLS,
  REFUND_WINDOW_DAYS,
  REFUND_PROFILE_THRESHOLD,
  PURCHASES_PAUSED,
} from '@/data/seo';
import { SUPPORT_HOURS, SUPPORT_PHONE_DISPLAY, SUPPORT_EMAIL } from '@/data/seo/contact';
// SUPPORT_HOURS is used only inside the contact entry's text; see ALWAYS_ALLOWED_NUMBERS.
import { paths } from '@/lib/seo-engine/links';
import type { FAQ } from '@/data/seo/types';

export interface Source {
  title: string;
  url: string;
}

export type EntryKind = 'faq' | 'plan' | 'service' | 'policy' | 'verification' | 'contact';

export interface KnowledgeEntry {
  id: string;
  kind: EntryKind;
  /** The question or heading this entry answers. Used for retrieval. */
  q: string;
  /** The answer, verbatim from the data layer. This is what rung 3 shows. */
  a: string;
  source: Source;
  /** Slugs this entry is about, for boosting: city, service, plan, locality, zone. */
  about: { city?: string; service?: string; plan?: string; locality?: string; zone?: string };
  tags: string[];
}

const inr = (n: number) => `₹${new Intl.NumberFormat('en-IN').format(n)}`;

// ─── Plans ──────────────────────────────────────────────────────────────────────────────────

function planEntries(): KnowledgeEntry[] {
  const entries: KnowledgeEntry[] = PLANS.map((p) => ({
    id: `plan-${p.key}`,
    kind: 'plan',
    q: `${p.name} plan price and what it includes`,
    a:
      `${p.name}: ${inr(p.fee)} one-time platform fee. Plan term ${p.termMonths} months, ` +
      `${p.replacements} replacement${p.replacements === 1 ? '' : 's'} included, ` +
      `${p.verifiedProfiles} verified profile${p.verifiedProfiles === 1 ? '' : 's'} per matching round, ` +
      `${p.policeVerification ? 'police verification included' : 'police verification not included'}.` +
      (p.popular ? ' This is our most popular plan.' : ''),
    source: { title: 'Pricing and plans', url: '/pricing' },
    about: { plan: p.key },
    tags: ['plan', 'price', 'pricing', 'fee', 'cost', p.key, p.name.toLowerCase()],
  }));

  entries.push({
    id: 'plan-compare',
    kind: 'plan',
    q: 'Compare all plans: Silver, Gold and Diamond',
    a: PLANS.map(
      (p) =>
        `${p.name} ${inr(p.fee)} — ${p.termMonths} months, ${p.replacements} replacements, ` +
        `${p.verifiedProfiles} verified profiles${p.policeVerification ? ', police verification' : ''}`,
    ).join('. ') + '. The platform fee is one-time and is not the helper’s salary, which you agree and pay directly to the helper.',
    source: { title: 'Pricing and plans', url: '/pricing' },
    about: {},
    tags: ['plan', 'plans', 'compare', 'price', 'pricing', 'fee', 'cost', 'silver', 'gold', 'diamond', 'package'],
  });

  entries.push({
    id: 'plan-what-fee-buys',
    kind: 'plan',
    q: 'What does the platform fee pay for? Is it the maid’s salary?',
    a:
      'The platform fee is a one-time charge for verification, shortlisting, interview arrangement, the sharing of the helper’s verification dossier, and replacement cover during the plan term. ' +
      'It is not the helper’s salary: you agree wages directly with the helper and pay them yourself, and no part of the fee goes to the helper.',
    source: { title: 'Pricing and plans', url: '/pricing' },
    about: {},
    tags: ['fee', 'salary', 'wages', 'platform fee', 'what included', 'pay'],
  });

  if (PURCHASES_PAUSED) {
    entries.push({
      id: 'plan-how-to-buy',
      kind: 'plan',
      q: 'How do I buy a plan? Can I pay online?',
      a:
        'Online payment is temporarily unavailable. To book a plan, message us on WhatsApp or call us and our team will confirm your plan, share verified profiles for your area and complete the booking with you. ' +
        'Nothing is charged until you confirm.',
      source: { title: 'Pricing and plans', url: '/pricing' },
      about: {},
      tags: ['buy', 'purchase', 'pay', 'payment', 'online', 'checkout', 'book plan', 'razorpay', 'payu', 'upi', 'card'],
    });
  }

  return entries;
}

// ─── Services ───────────────────────────────────────────────────────────────────────────────

function serviceEntries(): KnowledgeEntry[] {
  const out: KnowledgeEntry[] = [];
  for (const s of SERVICES) {
    const band = s.pricing.metro;
    out.push({
      id: `service-${s.slug}`,
      kind: 'service',
      q: `What does a ${s.name} do, and what does it cost?`,
      a:
        `${s.name}: ${s.shortDescription} Typical hours: ${s.typicalHours}. ` +
        `Included: ${s.tasksIncluded.join('; ')}. Not included: ${s.tasksExcluded.join('; ')}. ` +
        `Indicative helper salary in metro cities: from ${inr(band.from)} to ${inr(band.to)} per ${band.unit}, agreed directly with the helper.`,
      source: { title: s.name, url: paths.serviceHub(s.slug) },
      about: { service: s.slug },
      tags: ['service', s.slug, s.name.toLowerCase(), ...s.altNames.map((n) => n.toLowerCase()), 'salary', 'cost', 'tasks', 'duties'],
    });
    for (const f of s.faqPool) {
      out.push(faqEntry(f, { title: s.name, url: paths.serviceHub(s.slug) }, { service: s.slug }));
    }
  }
  return out;
}

// ─── Policy, verification, contact ─────────────────────────────────────────────────────────
// These sentences are the bot's copy of what /replacement-policy and /how-we-verify say.
// knowledge.test.ts asserts each key phrase appears in the page source, so they cannot drift.

function policyEntries(): KnowledgeEntry[] {
  return [
    {
      id: 'policy-replacement',
      kind: 'policy',
      q: 'What is the replacement policy? What if the helper leaves or is not the right fit?',
      a:
        'If the helper you hire leaves or is not the right fit, you get a replacement within your plan term. ' +
        PLANS.map((p) => `${p.name}: ${p.replacements} replacements over ${p.termMonths} months`).join('; ') +
        '. A replacement applies when the helper leaves, stops coming or becomes unavailable, when their work does not match the duties agreed at the start, or when the arrangement is not working for your household within the plan term. ' +
        'To request one, message us on WhatsApp or call and tell us what went wrong; we re-match against your original stated requirements, aim to share the new profile within 48 hours, and you interview the new helper before confirming.',
      source: { title: 'Replacement policy', url: '/replacement-policy' },
      about: {},
      tags: ['replacement', 'replace', 'leaves', 'left', 'quit', 'not right', 'not working out', 'change helper', 'change maid'],
    },
    {
      id: 'policy-refund',
      kind: 'policy',
      q: 'What is the refund policy? Can I get my money back?',
      a:
        `The platform fee is refundable, minus a processing fee, only if we are unable to provide ${REFUND_PROFILE_THRESHOLD} suitable verified profiles ` +
        `matching your original stated requirements within ${REFUND_WINDOW_DAYS} days of payment. Refunds are not issued once a candidate has been successfully hired, or where the client becomes unresponsive; ` +
        'a placement that does not work out is covered by a replacement instead. A refund request is decided by our team, not by this assistant.',
      source: { title: 'Replacement policy', url: '/replacement-policy' },
      about: {},
      tags: ['refund', 'money back', 'cancel', 'cancellation', 'return', 'refundable'],
    },
    {
      id: 'verification-checks',
      kind: 'verification',
      q: 'How do you verify helpers? Are they background checked?',
      a:
        'Every helper is checked before you meet them: Aadhaar validation, previous-employer reference checks, and an in-person behavioural assessment. ' +
        'Police verification is conducted for helpers placed on the Gold and Diamond plans. Before placement we share the verification dossier for the helper you select, ' +
        'including identity proofs and police-verification status where it applies to your plan.',
      source: { title: 'How we verify helpers', url: '/how-we-verify' },
      about: {},
      tags: ['verify', 'verification', 'verified', 'background', 'check', 'police', 'aadhaar', 'kyc', 'safe', 'trust', 'reference'],
    },
    {
      id: 'verification-limits',
      kind: 'verification',
      q: 'Do you guarantee the helper’s behaviour?',
      a:
        'Verification reduces risk; it does not eliminate it. We do not claim to predict future behaviour, and we do not carry out medical or psychiatric evaluation. ' +
        'We recommend that you interview every shortlisted helper yourself, agree duties and timings clearly at the start, and keep a copy of the helper’s ID.',
      source: { title: 'How we verify helpers', url: '/how-we-verify' },
      about: {},
      tags: ['guarantee', 'behaviour', 'behavior', 'trust', 'safe', 'theft', 'risk'],
    },
    {
      id: 'contact-support',
      kind: 'contact',
      q: 'How do I contact support? What are your support hours?',
      a:
        `You can reach our team on WhatsApp or by calling ${SUPPORT_PHONE_DISPLAY}, ${SUPPORT_HOURS.label}, or by email at ${SUPPORT_EMAIL}. ` +
        `Outside those hours, leave a message here and we will reply within ${SUPPORT_HOURS.replyWithinHours} hours.`,
      source: { title: 'Contact', url: '/contact' },
      about: {},
      tags: ['contact', 'phone', 'call', 'whatsapp', 'email', 'hours', 'timing', 'support', 'reach', 'talk', 'number'],
    },
    {
      id: 'coverage-cities',
      kind: 'contact',
      q: 'Which cities do you serve?',
      a:
        `We serve ${CITIES.length} cities: ${CITIES.map((c) => c.name).join(', ')}. ` +
        `Within them we serve ${ALL_LOCALITIES.length} localities. Tell me your locality or pincode and I will check.`,
      source: { title: 'MyBuddyMaid', url: '/' },
      about: {},
      tags: ['cities', 'city', 'where', 'coverage', 'serve', 'available', 'areas', 'location'],
    },
  ];
}

// ─── FAQ pools ──────────────────────────────────────────────────────────────────────────────

function faqEntry(f: FAQ, source: Source, about: KnowledgeEntry['about']): KnowledgeEntry {
  return { id: `faq-${f.id}`, kind: 'faq', q: f.q, a: f.a, source, about, tags: f.tags };
}

function faqEntries(): KnowledgeEntry[] {
  const out: KnowledgeEntry[] = [];
  for (const f of GLOBAL_FAQS) out.push(faqEntry(f, { title: 'MyBuddyMaid', url: '/' }, {}));
  for (const pool of Object.values(HOUSING_FAQ_POOLS)) {
    for (const f of pool) out.push(faqEntry(f, { title: 'MyBuddyMaid', url: '/' }, {}));
  }
  for (const c of CITIES) {
    for (const f of CITY_FAQ_POOLS[c.slug] ?? []) {
      out.push(faqEntry(f, { title: `Maid service in ${c.name}`, url: paths.city(c.slug) }, { city: c.slug }));
    }
  }
  for (const z of ZONES) {
    for (const f of ZONE_FAQ_POOLS[z.slug] ?? []) {
      out.push(faqEntry(f, { title: z.name, url: paths.zone(z.city, z.slug) }, { city: z.city, zone: z.slug }));
    }
  }
  for (const l of ALL_LOCALITIES) {
    for (const f of l.localFaqs) {
      out.push(faqEntry(f, { title: `${l.name}`, url: paths.locality(l.city, l.slug) }, { city: l.city, locality: l.slug, zone: l.zone }));
    }
  }
  return out;
}

// ─── The corpus ─────────────────────────────────────────────────────────────────────────────

export const KNOWLEDGE: KnowledgeEntry[] = [...planEntries(), ...policyEntries(), ...serviceEntries(), ...faqEntries()];

export const KNOWLEDGE_BY_ID = new Map(KNOWLEDGE.map((e) => [e.id, e]));

/** Counts, for the eval and for saying honestly what the bot knows. */
export const KNOWLEDGE_STATS = {
  entries: KNOWLEDGE.length,
  faqs: KNOWLEDGE.filter((e) => e.kind === 'faq').length,
  cities: CITIES.length,
  localities: ALL_LOCALITIES.length,
  services: SERVICES.length,
  plans: PLANS.length,
};

// ─── Numbers ────────────────────────────────────────────────────────────────────────────────

/**
 * Every number that occurs in a piece of text, normalised. "₹4,999" and "4999" both become
 * 4999; "10-month" yields 10. Used by the gate in answer.ts, which compares the numbers in a
 * model's wording against the numbers in the entries it was given.
 */
export function numbersIn(text: string): Set<number> {
  const out = new Set<number>();
  const re = /(?<![\w.])(\d{1,3}(?:,\d{2,3})+|\d+(?:\.\d+)?)(?![\w.])/g;
  for (const m of text.matchAll(re)) {
    const n = Number(m[1].replace(/,/g, ''));
    if (Number.isFinite(n)) out.add(n);
  }
  return out;
}

/**
 * Numbers that may appear in any answer regardless of retrieval: the phone number and the
 * coverage counts, and nothing else. The support hours and the 24-hour promise are NOT here,
 * deliberately: "24" allowed for "24 hours" would also let "24 months" through, and "10" for
 * "10 AM" would let "Gold for 10 months" through. Those numbers reach the gate only when the
 * contact entry is retrieved, i.e. when the question was actually about contacting us.
 */
export const ALWAYS_ALLOWED_NUMBERS: ReadonlySet<number> = new Set([...numbersIn(SUPPORT_PHONE_DISPLAY), CITIES.length, ALL_LOCALITIES.length]);
