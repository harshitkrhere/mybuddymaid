// lib/assistant/retrieve.ts — the deterministic half of the assistant, and the half that
// actually answers.
//
// Given a message, this module decides what is being asked (intent), what it is about
// (entities: pincode, locality, city, service, plan), looks the answer up in the corpus, and
// composes a complete, correct, sourced answer WITHOUT any model. That answer is "rung 3" of
// the degradation ladder in answer.ts: it is what the customer sees when every model is down,
// and it is what the model is handed to phrase when one is up.
//
// Nothing here calls the network, reads the clock, or depends on the model's tool-calling —
// the owner's decision 5. Every branch is exercised by retrieve.test.ts against the real data.

import {
  ALL_LOCALITIES,
  CITIES,
  CITY_BY_SLUG,
  PINCODE_BY_PIN,
  SERVICES,
  PLANS,
  getLocalitiesByPincode,
} from '@/data/seo';
import type { CitySlug, Locality, ServiceSlug } from '@/data/seo/types';
import { paths } from '@/lib/seo-engine/links';
import { KNOWLEDGE, KNOWLEDGE_BY_ID, type KnowledgeEntry, type Source } from './knowledge';
import { COPY } from './copy';

export type Intent =
  | 'greeting'
  | 'serviceability'
  | 'pricing'
  | 'plan_detail'
  | 'service_info'
  | 'refund_question'
  | 'refund_request'
  | 'replacement'
  | 'verification'
  | 'booking_process'
  | 'booking_status'
  | 'contact'
  | 'human'
  | 'complaint'
  | 'safety'
  | 'payment_issue'
  | 'not_offered'
  | 'faq'
  | 'unknown';

export type EscalationReason =
  | 'asked_for_human'
  | 'low_confidence'
  | 'complaint'
  | 'refund'
  | 'safety'
  | 'payment'
  | 'turn_limit';

export interface Entities {
  pincode?: string;
  city?: CitySlug;
  locality?: { city: CitySlug; slug: string; name: string };
  /** Set when a locality name exists in more than one served city and no city was given. */
  ambiguousLocality?: { name: string; cities: CitySlug[] };
  service?: ServiceSlug;
  plan?: 'silver' | 'gold' | 'diamond';
}

export type Language = 'en' | 'hi';

export interface Retrieval {
  intent: Intent;
  entities: Entities;
  language: Language;
  /** The entries the answer was built from, best first. What the model is allowed to see. */
  entries: KnowledgeEntry[];
  /** Complete, deterministic answer text. Shown as-is when no model is available. */
  answer: string;
  /** A serviceability sentence that precedes the answer when a price question names a place. */
  preface?: string;
  sources: Source[];
  /** 0–1. Below LOW_CONFIDENCE the assistant refuses and offers a person. */
  confidence: number;
  escalate?: EscalationReason;
}

export const LOW_CONFIDENCE = 0.45;

// ─── Text normalisation ─────────────────────────────────────────────────────────────────────

const STOPWORDS = new Set(
  (
    'a an the is are am was were be been do does did i me my we our you your it its this that these those ' +
    'to of in on at for with from by and or but if so as than then there here what which who whom how why when where ' +
    'can could would should will shall may might have has had not no yes please pls kindly hi hello hey about ' +
    'ka ki ke ko se me mein hai hain ho hun kya kaise kahan kab kyun aur ya bhi toh ye yeh wo woh hum aap tum ' +
    // Domain near-stopwords: so common in questions that matching on them alone means nothing.
    'provide provides offer offers available need needs want wants looking get give know tell also any some one like would much many'
  ).split(/\s+/),
);

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/[-–—_/]/g, ' ')
    .replace(/[^\p{L}\p{N}\s₹]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stem(t: string): string {
  if (t.length <= 3) return t;
  return t.replace(/(ies)$/, 'y').replace(/(ing|ed|es|s)$/, '');
}

export function tokens(text: string): string[] {
  return normalise(text)
    .split(' ')
    .filter((t) => t && !STOPWORDS.has(t))
    .map(stem);
}

// ─── Language ───────────────────────────────────────────────────────────────────────────────

// Words that only occur in Hindi/Hinglish. "Strong" ones are unambiguous on their own; "weak"
// ones are common but could be typos or names in English. Two points make a message Hinglish.
const HINGLISH_STRONG =
  /\b(kya|kaise|kahan|kaha|kitna|kitne|kitni|chahiye|mujhe|humein|hamein|batao|bataiye|nahi|nahin|wapas|paisa|paise|kyun|kyu|kaun|konsa|kaunsa|milega|milegi|karna|karni|karo|kare|karein|karu|karenge|hoga|hogi|honge|dete|deta|deti|dena|sakte|sakta|sakti|aayi|aaya|aaye|gaya|gayi|gaye|insaan|aadmi|tankhwah|kharcha|madad|jaldi|abhi|bhaiya|didi|buzurg|chhod|chhodi|bhaag)\b/gi;
const HINGLISH_WEAK = /\b(hai|hain|ho|hun|ji|haan|aap|aapka|aapke|aapki|mera|meri|mere|hamara|hamari|tumhara|kaam|ghar|aaj|kal|accha|acha|theek|thik|bhi|toh|se|ka|ki|ke|ko|me|mein|wala|wali|wale)\b/gi;

export function detectLanguage(text: string): Language {
  if (/[ऀ-ॿ]/.test(text)) return 'hi';
  const norm = normalise(text);
  const strong = norm.match(HINGLISH_STRONG)?.length ?? 0;
  const weak = norm.match(HINGLISH_WEAK)?.length ?? 0;
  return strong * 2 + weak >= 2 && strong >= 1 ? 'hi' : 'en';
}

// ─── Entities ───────────────────────────────────────────────────────────────────────────────

const CITY_ALIASES: Record<string, CitySlug> = {
  gurugram: 'gurgaon',
  bengaluru: 'bangalore',
  bombay: 'mumbai',
  'new delhi': 'delhi',
  'noida extension': 'greater-noida',
  'greater noida west': 'greater-noida',
  mangaluru: 'mangalore',
};

interface Needle {
  needle: string;
  city?: CitySlug;
  locality?: Locality;
  service?: ServiceSlug;
}

function needlesFor(names: string[], extra: Omit<Needle, 'needle'>): Needle[] {
  return names.map((n) => ({ needle: normalise(n), ...extra })).filter((n) => n.needle.length >= 3);
}

// Longest needle first, so "greater noida" wins over "noida" and "sector 50" over "sector 5".
const CITY_NEEDLES: Needle[] = [
  ...CITIES.flatMap((c) => needlesFor([c.name, ...c.altNames], { city: c.slug })),
  ...Object.entries(CITY_ALIASES).map(([k, v]) => ({ needle: k, city: v })),
].sort((a, b) => b.needle.length - a.needle.length);

const LOCALITY_NEEDLES: Needle[] = ALL_LOCALITIES.flatMap((l) =>
  needlesFor([l.name, ...l.altNames], { locality: l, city: l.city }),
).sort((a, b) => b.needle.length - a.needle.length);

const SERVICE_WORDS: Record<ServiceSlug, string[]> = {
  'full-time-maid': ['full time', 'fulltime', 'live in', 'livein', '24 hour', '24 hours', '12 hour', '8 hour', 'permanent maid', 'full day'],
  'part-time-maid': ['part time', 'parttime', 'hourly', 'morning maid', 'evening maid', 'cleaning', 'jhadu', 'pocha', 'bartan', 'sweeping', 'mopping'],
  cook: ['cook', 'cooking', 'chef', 'khana', 'rasoi', 'meal'],
  'babysitter-nanny': ['nanny', 'babysitter', 'baby sitter', 'baby', 'child', 'kids', 'toddler', 'newborn', 'postnatal', 'japa', 'aaya', 'ayah'],
  'elder-care': ['elder', 'elderly', 'old age', 'senior', 'parents', 'patient', 'attendant', 'caretaker', 'care taker', 'buzurg'],
  'domestic-help': ['domestic help', 'all rounder', 'allrounder', 'house help', 'household help', 'general help', 'helper'],
};

const SERVICE_NEEDLES: Needle[] = SERVICES.flatMap((s) =>
  needlesFor([s.name, ...s.altNames, ...(SERVICE_WORDS[s.slug] ?? [])], { service: s.slug }),
).sort((a, b) => b.needle.length - a.needle.length);

function findNeedle(padded: string, needles: Needle[]): Needle | undefined {
  return needles.find((n) => padded.includes(` ${n.needle} `));
}

export function extractEntities(text: string): Entities {
  const norm = normalise(text);
  const padded = ` ${norm} `;
  const e: Entities = {};

  const pin = text.match(/(?<!\d)(\d{6})(?!\d)/);
  if (pin) e.pincode = pin[1];

  const cityHit = findNeedle(padded, CITY_NEEDLES);
  if (cityHit?.city) e.city = cityHit.city;

  // Localities: collect every match, then resolve by city.
  const locHits = LOCALITY_NEEDLES.filter((n) => padded.includes(` ${n.needle} `));
  if (locHits.length) {
    const longest = locHits[0].needle;
    const sameName = locHits.filter((n) => n.needle === longest);
    const inCity = e.city ? sameName.find((n) => n.city === e.city) : undefined;
    const pick = inCity ?? (sameName.length === 1 ? sameName[0] : undefined);
    if (pick?.locality) {
      e.locality = { city: pick.locality.city, slug: pick.locality.slug, name: pick.locality.name };
      e.city = e.city ?? pick.locality.city;
    } else if (sameName.length > 1) {
      e.ambiguousLocality = {
        name: sameName[0].locality!.name,
        cities: [...new Set(sameName.map((n) => n.city!))],
      };
    }
  }

  // A pincode we serve also fixes the city.
  if (e.pincode && !e.city) {
    const rec = PINCODE_BY_PIN.get(e.pincode);
    if (rec) e.city = rec.city;
  }

  const svc = findNeedle(padded, SERVICE_NEEDLES);
  if (svc?.service) e.service = svc.service;
  // "maid" alone is ambiguous between full-time and part-time; leave service unset so the
  // answer lists both rather than guessing.

  const plan = norm.match(/\b(silver|gold|diamond)\b/);
  if (plan) e.plan = plan[1] as Entities['plan'];
  else if (/\b(cheapest|basic|lowest|sasta|sabse sasta)\b/.test(norm)) e.plan = 'silver';
  else if (/\b(premium|best|top|highest|sabse accha|sabse acha)\b/.test(norm)) e.plan = 'diamond';

  return e;
}

// ─── Intent ─────────────────────────────────────────────────────────────────────────────────

const RULES: Array<[Intent, RegExp]> = [
  ['safety', /\b(theft|stole|stolen|chori|harass|abuse|abusive|assault|molest|hit me|hurt|injur|danger|unsafe|threat|missing|police complaint|fir\b)/i],
  // Order-independent: "kisi insaan se baat karni hai" puts the person before the verb.
  // "staff" and "support" were the first words a real visitor used that this missed (2026-09-11).
  ['human', /^(?=.*\b(talk|speak|chat|connect|baat)\b)(?=.*\b(person|human|agent|someone|team|staff|support|operator|executive|representative|manager|real|insaan|aadmi|koi)\b)|\b(customer (care|service|support)|support team|call me|callback|call back|real person|live agent|transfer me|escalate)\b/i],
  ['payment_issue', /\b(payment|amount|money|paisa|paise)\b.*\b(failed|fail|deducted|debited|stuck|pending|twice|double|cut gaya|kat gaya)\b|\b(charged twice|transaction failed|double charged)\b/i],
  ['refund_request', /\b(want|need|give|get|process|initiate|start|please|chahiye|karo|kar do|wapas)\b.*\brefund\b|\brefund\b.*\b(my money|mera|mere|karo|kar do|chahiye|please|now|immediately|asap)\b|\b(money back|return my money|paise wapas|paisa wapas)\b/i],
  ['refund_question', /\brefund|refundable|money back policy|cancellation policy\b/i],
  ['complaint', /\b(complaint|complain|not (coming|showing|turning)|didn.?t (come|show|turn)|did not (come|show|turn)|absent|no show|rude|misbehav|bad experience|unhappy|disappointed|cheat|fraud|scam|worst|pathetic|useless|nahi aayi|nahi aaya|nahi aa rahi|nahi aa raha)\b/i],
  ['booking_status', /\b(my booking|booking status|status of my|where is my|track my|my request|when will .* (come|arrive|start)|kab aayegi|kab aayega|mera booking|meri booking)\b/i],
  ['replacement', /\b(replac|change (the |my )?(maid|helper|cook|nanny|didi|bai)|badal|left the job|has left|quit|ran away|bhaag)/i],
  ['verification', /\b(verif|background|police|aadhaar|aadhar|kyc|genuine|reliable|trustworthy|trusted|trust you|criminal|check(ed)? (the|their|her|his)|document|is it safe|safe to|safe hai)\b/i],
  ['booking_process', /\b(how (do|to|can|should) (i|we) (book|hire|get|start|find|apply)|how does (it|this|booking) work|process|steps|register|sign ?up|apply|kaise (book|hire|kare|karu|karein|milegi|milega))\b/i],
  // Not bare "number": a card number or a booking number is not a request for ours.
  ['contact', /\b(contact|phone|call you|call us|whatsapp|email|mail|timings?|hours|opening|office|address|reach you|your number|phone number|contact number|mobile number|helpline|number do|number bhejo)\b/i],
];

function looksLikeGreeting(text: string): boolean {
  const norm = normalise(text);
  return /^(hi+|hello+|hey+|namaste|namaskar|good (morning|evening|afternoon|night)|hii+|helo)\b/.test(norm) && norm.split(' ').length <= 4;
}

function looksLikePricing(norm: string): boolean {
  return /\b(price|pricing|cost|charge|charges|fee|fees|how much|rate|rates|₹|rupee|rupees|rs|plan|plans|package|packages|subscription|salary|salaries|wage|wages|pay|paid|kitna|kitne|paisa|paise|kharcha|tankhwah|silver|gold|diamond|cheap|expensive|budget)\b/.test(norm);
}

function looksLikeServiceability(norm: string, e: Entities): boolean {
  if (e.pincode || e.locality || e.ambiguousLocality) return true;
  return /\b(do you (serve|cover|work|operate)|available in|service in|services in|serve in|cover|area|areas|location|locality|pincode|pin code|near me|my city|which cit|coverage|deliver|kahan|kaha|available hai|milegi .* (mein|me))\b/.test(norm) || (!!e.city && !looksLikePricing(norm));
}

function looksLikeServiceInfo(norm: string, e: Entities): boolean {
  return !!e.service || /\b(what services|which services|services do you|types of|kind of|what do you (do|offer|provide)|what is a|what does a|duties|tasks|responsibilit|maid|cook|nanny|elder|helper|kaam)\b/.test(norm);
}

// Work we do not place. Named so the answer is "we don't offer that, here is what we do"
// rather than a loose FAQ match on a shared word like "provide".
const NOT_OFFERED = /\b(driver|chauffeur|security guard|watchman|guard|plumber|electrician|carpenter|painter|gardener|mali|pest control|deep clean|sofa clean|car wash|office (?:boy|staff)|peon|nurse|nursing|physiotherap\w*|tutor|teacher|laundry service|dhobi)s?\b/i;

export function classifyIntent(text: string, e: Entities): Intent {
  const norm = normalise(text);
  if (looksLikeGreeting(text)) return 'greeting';
  for (const [intent, re] of RULES) if (re.test(text)) return intent;
  if (NOT_OFFERED.test(text) && !e.service) return 'not_offered';
  // A price question about a named service is a pricing question, even if a city is named too.
  if (looksLikePricing(norm) && (e.service || e.plan || !looksLikeServiceability(norm, e))) return e.plan ? 'plan_detail' : 'pricing';
  if (looksLikeServiceability(norm, e)) return 'serviceability';
  if (looksLikePricing(norm)) return 'pricing';
  if (looksLikeServiceInfo(norm, e)) return 'service_info';
  return 'unknown';
}

// ─── FAQ search ─────────────────────────────────────────────────────────────────────────────

interface Indexed {
  entry: KnowledgeEntry;
  q: Set<string>;
  a: Set<string>;
  tags: Set<string>;
}

const INDEX: Indexed[] = KNOWLEDGE.map((entry) => ({
  entry,
  q: new Set(tokens(entry.q)),
  a: new Set(tokens(entry.a)),
  tags: new Set(entry.tags.flatMap((t) => tokens(t))),
}));

const DF = new Map<string, number>();
for (const ix of INDEX) {
  for (const t of new Set([...ix.q, ...ix.a, ...ix.tags])) DF.set(t, (DF.get(t) ?? 0) + 1);
}
const N = INDEX.length;
const idf = (t: string) => Math.log(1 + N / (1 + (DF.get(t) ?? 0)));

export interface Scored {
  entry: KnowledgeEntry;
  score: number;
}

/**
 * Keyword search over the corpus. Query tokens are weighted by rarity (idf) and by where
 * they hit (question > tags > answer); entries about the same city, service, plan or
 * locality as the message get a boost. No embeddings, no network, no model.
 */
export function searchKnowledge(text: string, e: Entities, limit = 5): Scored[] {
  const qs = tokens(text);
  if (!qs.length) return [];
  const results: Scored[] = [];
  for (const ix of INDEX) {
    let score = 0;
    for (const t of qs) {
      const w = idf(t);
      if (ix.q.has(t)) score += 3 * w;
      else if (ix.tags.has(t)) score += 2 * w;
      else if (ix.a.has(t)) score += 1 * w;
    }
    if (score === 0) continue;
    const about = ix.entry.about;
    if (e.service && about.service === e.service) score *= 1.5;
    if (e.plan && about.plan === e.plan) score *= 1.5;
    if (e.locality && about.locality === e.locality.slug) score *= 2;
    else if (e.city && about.city === e.city && !about.locality) score *= 1.3;
    // Prefer general answers over locality-specific ones unless the locality was named.
    if (about.locality && !e.locality) score *= 0.6;
    results.push({ entry: ix.entry, score });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/** Normalise a raw score into 0–1 confidence relative to how much of the query matched. */
function confidenceFrom(score: number, text: string): number {
  const qs = tokens(text);
  if (!qs.length) return 0;
  const max = qs.reduce((s, t) => s + 3 * idf(t), 0);
  return Math.max(0, Math.min(1, score / max));
}

// ─── Answer composition (rung 3) ────────────────────────────────────────────────────────────

const PLAN_LIST = PLANS.map((p) => `${p.name} ₹${new Intl.NumberFormat('en-IN').format(p.fee)}`).join(', ');

function entry(id: string): KnowledgeEntry {
  const e = KNOWLEDGE_BY_ID.get(id);
  if (!e) throw new Error(`knowledge entry missing: ${id}`);
  return e;
}

function serviceabilityAnswer(e: Entities): { answer: string; sources: Source[]; entries: KnowledgeEntry[]; confidence: number } {
  const coverage = entry('coverage-cities');

  if (e.pincode) {
    const rec = PINCODE_BY_PIN.get(e.pincode);
    if (!rec) {
      return {
        answer: COPY.notServedPincode(e.pincode, CITIES.map((c) => c.name)),
        sources: [coverage.source],
        entries: [coverage],
        confidence: 0.95,
      };
    }
    const city = CITY_BY_SLUG.get(rec.city)!;
    const locs = getLocalitiesByPincode(e.pincode);
    const url = locs.length === 1 ? paths.locality(city.slug, locs[0].slug) : locs.length > 1 ? paths.pincode(e.pincode) : paths.city(city.slug);
    return {
      answer: COPY.servedPincode(e.pincode, city.name, locs.map((l) => l.name)),
      sources: [{ title: `Pincode ${e.pincode}`, url }],
      entries: [coverage],
      confidence: 0.95,
    };
  }

  const svcName = e.service ? SERVICES.find((s) => s.slug === e.service)?.name : undefined;

  if (e.locality) {
    const city = CITY_BY_SLUG.get(e.locality.city)!;
    return {
      answer: COPY.servedLocality(e.locality.name, city.name, svcName),
      sources: [{ title: `Maid service in ${e.locality.name}`, url: paths.locality(city.slug, e.locality.slug) }],
      entries: [coverage],
      confidence: 0.95,
    };
  }

  if (e.ambiguousLocality) {
    const names = e.ambiguousLocality.cities.map((c) => CITY_BY_SLUG.get(c)!.name);
    return { answer: COPY.whichCity(e.ambiguousLocality.name, names), sources: [coverage.source], entries: [coverage], confidence: 0.8 };
  }

  if (e.city) {
    const city = CITY_BY_SLUG.get(e.city)!;
    return {
      answer: COPY.servedCity(city.name, svcName),
      sources: [{ title: `Maid service in ${city.name}`, url: paths.city(city.slug) }],
      entries: [coverage],
      confidence: 0.9,
    };
  }

  return { answer: COPY.askLocality(CITIES.map((c) => c.name)), sources: [coverage.source], entries: [coverage], confidence: 0.7 };
}

export function retrieve(text: string): Retrieval {
  const r = retrieveOne(text);
  // "I'm in DLF Phase 3 — how much is Gold?" asks two things. The intent picks the price half;
  // if a place was named as well, the serviceability answer becomes a preface so both halves
  // are answered from the data, and the place's page joins the sources.
  const placeNamed = r.entities.locality || r.entities.pincode || r.entities.ambiguousLocality;
  if (placeNamed && (r.intent === 'pricing' || r.intent === 'plan_detail' || r.intent === 'service_info')) {
    const s = serviceabilityAnswer(r.entities);
    return { ...r, preface: s.answer, sources: dedupe([...s.sources, ...r.sources]) };
  }
  return r;
}

function retrieveOne(text: string): Retrieval {
  const language = detectLanguage(text);
  const entities = extractEntities(text);
  const intent = classifyIntent(text, entities);
  const base = { intent, entities, language };

  const withEntries = (ids: string[], answer: string, confidence: number, extra: Partial<Retrieval> = {}): Retrieval => {
    const entries = ids.map(entry);
    return { ...base, entries, answer, sources: dedupe(entries.map((x) => x.source)), confidence, ...extra };
  };

  switch (intent) {
    case 'greeting':
      return { ...base, entries: [], answer: COPY.greeting, sources: [], confidence: 1 };

    case 'serviceability': {
      const r = serviceabilityAnswer(entities);
      return { ...base, ...r, sources: dedupe(r.sources) };
    }

    case 'pricing': {
      const buy = KNOWLEDGE_BY_ID.has('plan-how-to-buy') ? ['plan-how-to-buy'] : [];
      if (entities.service) {
        // "How much does a cook cost?" has two honest halves: the helper's salary, which the
        // household agrees directly, and our one-time fee. Both come from the data layer.
        const svc = SERVICES.find((s) => s.slug === entities.service)!;
        const band = svc.pricing.metro;
        const cityNote = entities.city ? ` We serve ${CITY_BY_SLUG.get(entities.city)!.name}.` : '';
        const answer = COPY.servicePricing(svc.name, band.from, band.to, band.unit, PLAN_LIST) + cityNote;
        return withEntries([`service-${entities.service}`, 'plan-compare', 'plan-what-fee-buys', ...buy], answer, 0.95);
      }
      return withEntries(['plan-compare', 'plan-what-fee-buys', ...buy], entry('plan-compare').a, 0.95);
    }

    case 'not_offered':
      return withEntries(SERVICES.map((s) => `service-${s.slug}`), COPY.notOffered(SERVICES.map((s) => s.name)), 0.95);

    case 'plan_detail':
      return withEntries([`plan-${entities.plan}`, 'plan-compare'], entry(`plan-${entities.plan}`).a, 0.95);

    case 'service_info': {
      if (entities.service) {
        const id = `service-${entities.service}`;
        return withEntries([id], entry(id).a, 0.9);
      }
      const ids = SERVICES.map((s) => `service-${s.slug}`);
      return withEntries(ids, COPY.serviceList(SERVICES.map((s) => `${s.name} — ${s.shortDescription}`)), 0.85);
    }

    case 'refund_question':
      return withEntries(['policy-refund', 'policy-replacement'], entry('policy-refund').a, 0.95);

    case 'refund_request':
      return withEntries(['policy-refund'], COPY.escalateRefund, 0.9, { escalate: 'refund' });

    case 'replacement':
      return withEntries(['policy-replacement'], entry('policy-replacement').a, 0.95);

    case 'verification':
      return withEntries(['verification-checks', 'verification-limits'], entry('verification-checks').a, 0.95);

    case 'booking_process': {
      const hit = KNOWLEDGE.find((k) => k.id === 'faq-faq-global-2') ?? searchKnowledge('how do I book a helper', entities, 1)[0]?.entry;
      const ids = [hit?.id, ...(KNOWLEDGE_BY_ID.has('plan-how-to-buy') ? ['plan-how-to-buy'] : [])].filter((x): x is string => !!x);
      return withEntries(ids, hit ? hit.a : COPY.bookingProcessFallback, hit ? 0.9 : 0.6);
    }

    case 'contact':
      return withEntries(['contact-support'], entry('contact-support').a, 0.95);

    case 'booking_status':
      return { ...base, entries: [], answer: COPY.bookingStatusNeedsSignIn, sources: [], confidence: 0.9 };

    case 'human':
      return { ...base, entries: [], answer: COPY.escalateHuman, sources: [], confidence: 1, escalate: 'asked_for_human' };

    case 'complaint':
      return withEntries(['policy-replacement'], COPY.escalateComplaint, 0.9, { escalate: 'complaint' });

    case 'safety':
      return { ...base, entries: [], answer: COPY.escalateSafety, sources: [], confidence: 1, escalate: 'safety' };

    case 'payment_issue':
      return { ...base, entries: [], answer: COPY.escalatePayment, sources: [], confidence: 1, escalate: 'payment' };

    case 'faq':
    case 'unknown':
    default: {
      const hits = searchKnowledge(text, entities, 3);
      const top = hits[0];
      const confidence = top ? confidenceFrom(top.score, text) : 0;
      if (top && confidence >= LOW_CONFIDENCE) {
        return {
          ...base,
          intent: 'faq',
          entries: hits.map((h) => h.entry),
          answer: top.entry.a,
          sources: dedupe([top.entry.source]),
          confidence,
        };
      }
      return {
        ...base,
        intent: 'unknown',
        entries: hits.map((h) => h.entry),
        answer: COPY.refuse,
        sources: [],
        confidence,
        escalate: 'low_confidence',
      };
    }
  }
}

function dedupe(sources: Source[]): Source[] {
  const seen = new Set<string>();
  return sources.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)));
}

export { PLAN_LIST };
