// lib/assistant/answer.ts — the degradation ladder, and the gate that makes the model safe.
//
//   rung 1  a model phrased the retrieved answer, and every number in its wording occurs in
//           the facts it was given (or in the customer's own message);
//   rung 3  no model answered, or its wording failed the gate — the customer sees the
//           retrieved answer itself, unphrased, with its source.
//
// (Rung 2 in the survey — a paid model as the floor — is just the last entry in the chain,
// so it lives in provider.ts's loop rather than here.)
//
// Rung 3 is not the error path. It is the proof that retrieval is correct, and the reason the
// assistant cannot hallucinate a price: a wrong number never reaches the customer because the
// only way for wording to reach the customer is through the gate, and the gate only knows the
// numbers that came out of plans.ts and the FAQ corpus. Owner decision 16 makes rung 3 and
// its test mandatory. answer.test.ts is that test.

import { SUPPORT_HOURS, SUPPORT_PHONE_DISPLAY, isWithinSupportHours } from '@/data/seo/contact';
import { ALWAYS_ALLOWED_NUMBERS, numbersIn, type Source } from './knowledge';
import { retrieve, type Entities, type EscalationReason, type Intent, type Language, type Retrieval } from './retrieve';
import { redact } from './redact';
import { phrase, type ChatMessage, type FetchLike, type ProviderConfig } from './provider';
import { COPY } from './copy';

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnswerInput {
  message: string;
  /** Earlier turns, oldest first. Bounded by the caller; only the last few are used. */
  history?: Turn[];
  signedIn?: boolean;
  now?: Date;
}

export interface Handoff {
  inHours: boolean;
  text: string;
}

export interface Answer {
  text: string;
  sources: Source[];
  intent: Intent;
  entities: Entities;
  language: Language;
  confidence: number;
  escalate?: EscalationReason;
  handoff?: Handoff;
  /** Which model phrased the text, or null when rung 3 served it. Stored on the record. */
  modelId: string | null;
  rung: 1 | 3;
  /** Kinds of personal data stripped from the outbound message. Never the values. */
  redacted: string[];
  /** True when a model answered but its wording was rejected by the number gate. */
  gateRejected: boolean;
}

export interface AnswerOptions {
  provider?: ProviderConfig | null;
  fetchImpl?: FetchLike;
  /** Turns of history handed to the model. */
  historyTurns?: number;
}

const HISTORY_TURNS = 6;
const MAX_MODEL_CHARS = 1400;

// ─── The number gate ────────────────────────────────────────────────────────────────────────

const UNIT_WORDS = 'month|months|day|days|replacement|replacements|profile|profiles|hour|hours|hrs|year|years|week|weeks|km|minute|minutes|mins|lakh|lakhs|crore|k';

/**
 * Numbers in a piece of wording that must be accounted for: anything that reads as money, a
 * percentage, a quantity with a unit, or a number of 100 or more. Small bare integers are left
 * alone so "two things to note" does not fail a correct answer.
 */
export function gatedNumbers(text: string): Set<number> {
  const out = new Set<number>();
  const num = '(\\d{1,3}(?:,\\d{2,3})+|\\d+(?:\\.\\d+)?)';
  const patterns = [
    new RegExp(`(?:₹|rs\\.?|inr|rupees?)\\s*${num}`, 'gi'),
    new RegExp(`${num}\\s*(?:%|percent|per cent|₹|rs\\.?|rupees?|inr)`, 'gi'),
    new RegExp(`${num}[\\s-]*(?:${UNIT_WORDS})\\b`, 'gi'),
  ];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) out.add(Number(m[1].replace(/,/g, '')));
  }
  for (const n of numbersIn(text)) if (n >= 100) out.add(n);
  return out;
}

function allowedNumbers(r: Retrieval, message: string): Set<number> {
  const allowed = new Set<number>(ALWAYS_ALLOWED_NUMBERS);
  for (const e of r.entries) for (const n of numbersIn(`${e.q} ${e.a}`)) allowed.add(n);
  for (const n of numbersIn(r.answer)) allowed.add(n);
  if (r.preface) for (const n of numbersIn(r.preface)) allowed.add(n);
  for (const n of numbersIn(message)) allowed.add(n);
  return allowed;
}

/** True when every gated number in `wording` is accounted for. */
export function passesGate(wording: string, r: Retrieval, message: string): boolean {
  const allowed = allowedNumbers(r, message);
  for (const n of gatedNumbers(wording)) if (!allowed.has(n)) return false;
  return true;
}

// ─── Handoff ────────────────────────────────────────────────────────────────────────────────

export function handoffFor(now: Date = new Date()): Handoff {
  const inHours = isWithinSupportHours(now);
  return {
    inHours,
    text: inHours ? COPY.handoffInHours(SUPPORT_PHONE_DISPLAY) : COPY.handoffOutOfHours(SUPPORT_HOURS.label, SUPPORT_HOURS.replyWithinHours),
  };
}

// ─── Turn limit ─────────────────────────────────────────────────────────────────────────────

/**
 * Three consecutive refusals is the survey's "turn limit" trigger: the assistant is not helping
 * and should stop trying. Detected from history, which is the only state the route holds.
 */
function hitTurnLimit(r: Retrieval, history: Turn[]): boolean {
  if (r.intent !== 'unknown') return false;
  const assistantTurns = history.filter((t) => t.role === 'assistant').slice(-2);
  return assistantTurns.length === 2 && assistantTurns.every((t) => t.content.startsWith(COPY.refuse.slice(0, 40)));
}

// ─── Prompt ─────────────────────────────────────────────────────────────────────────────────

function systemPrompt(r: Retrieval, signedIn: boolean): string {
  const facts = r.entries
    .map((e, i) => `FACT ${i + 1} (source: ${e.source.title}, ${e.source.url})\nQ: ${e.q}\nA: ${e.a}`)
    .join('\n\n');
  const lang =
    r.language === 'hi'
      ? 'The customer wrote in Hindi or Hinglish. Reply in the same style, in Roman script, but keep plan names, prices, place names and policy terms exactly as they appear in the facts.'
      : 'Reply in plain English.';
  return [
    'You are the support assistant for MyBuddyMaid, a service in India that introduces households to verified domestic helpers (maids, cooks, nannies, elder-care attendants). Customers pay a one-time platform fee for a plan; the helper’s salary is agreed and paid separately by the household.',
    'Your only job is to put the answer below into a friendly, short reply. The answer has already been looked up; you must not change it, add to it, or answer from memory.',
    'Rules:',
    '- Use ONLY the facts below. If they do not answer the question, say you will connect the customer to a member of the team. Never guess.',
    '- Every number you write (prices, months, counts, days, hours) must appear in the facts word for word. Do not round, convert, or invent numbers.',
    '- Do not invent place names, service names or plan names. Do not mention competitors.',
    '- Never ask for a phone number, email, address, card, UPI PIN, password or OTP.',
    '- Two to four short sentences. No headings, no bold. A short list is fine only when listing services.',
    '- Do not say you are an AI unless asked, and do not mention "facts" or "sources"; you may say "our help pages".',
    `- ${lang}`,
    signedIn ? '- The customer is signed in to the app.' : '- The customer is browsing the website and is not signed in.',
    '',
    'THE ANSWER TO GIVE, IN YOUR OWN WORDS:',
    r.preface ? `${r.preface}
${r.answer}` : r.answer,
    '',
    facts ? `SUPPORTING FACTS:\n${facts}` : '',
  ]
    .filter((l) => l !== '')
    .join('\n');
}

// ─── The ladder ─────────────────────────────────────────────────────────────────────────────

export async function answer(input: AnswerInput, opts: AnswerOptions = {}): Promise<Answer> {
  const history = (input.history ?? []).slice(-(opts.historyTurns ?? HISTORY_TURNS));
  const now = input.now ?? new Date();
  const r = retrieve(input.message);
  const outbound = redact(input.message);

  const base = {
    sources: r.sources,
    intent: r.intent,
    entities: r.entities,
    language: r.language,
    confidence: r.confidence,
    redacted: outbound.removed,
    gateRejected: false,
  };

  // Escalations and greetings are fixed copy: no model, no gate, no network.
  if (hitTurnLimit(r, history)) {
    const h = handoffFor(now);
    return { ...base, text: `${COPY.escalateTurnLimit} ${h.text}`, escalate: 'turn_limit', handoff: h, modelId: null, rung: 3 };
  }
  if (r.escalate === 'low_confidence') {
    // Not in the knowledge: refuse and OFFER a person. The escalate flag is kept for the record
    // and so the widget shows the "Talk to our team" button, but an off-topic question does not
    // by itself put a conversation in the one support person's queue — the customer chooses.
    return { ...base, text: COPY.refuse, escalate: r.escalate, modelId: null, rung: 3 };
  }
  if (r.escalate) {
    const h = handoffFor(now);
    const policy = r.escalate === 'refund' && r.entries[0] ? `\n\n${r.entries[0].a}` : '';
    return { ...base, text: `${r.answer} ${h.text}${policy}`, escalate: r.escalate, handoff: h, modelId: null, rung: 3 };
  }
  if (r.intent === 'greeting' || r.intent === 'booking_status') {
    return { ...base, text: r.answer, modelId: null, rung: 3 };
  }

  // Rung 1: a model phrases the retrieved answer, if one is configured and answers.
  if (opts.provider) {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt(r, !!input.signedIn) },
      // Both roles are redacted: an assistant turn could have echoed something the customer typed.
      ...history.map<ChatMessage>((t) => ({ role: t.role, content: redact(t.content).text.slice(0, MAX_MODEL_CHARS) })),
      { role: 'user', content: outbound.text.slice(0, MAX_MODEL_CHARS) },
    ];
    const result = await phrase({ messages }, opts.provider, { fetchImpl: opts.fetchImpl });
    if (result) {
      const wording = result.text.replace(/\s+\n/g, '\n').trim();
      if (wording.length > 0 && wording.length <= 1200 && passesGate(wording, r, input.message)) {
        return { ...base, text: wording, modelId: result.modelId, rung: 1 };
      }
      console.warn(`[assistant] gate rejected wording from ${result.modelId} for intent ${r.intent}`);
      return { ...base, text: unphrased(r), modelId: null, rung: 3, gateRejected: true };
    }
  }

  // Rung 3: the answer itself, with its source.
  return { ...base, text: unphrased(r), modelId: null, rung: 3 };
}

const QUOTED_INTENTS = new Set<Intent>(['faq', 'pricing', 'plan_detail', 'refund_question', 'replacement', 'verification', 'booking_process', 'contact']);

/** Rung 3 text. Verbatim quotes get the "our help pages say" prefix; composed sentences do not. */
export function unphrased(r: Retrieval): string {
  const quoted = QUOTED_INTENTS.has(r.intent) || (r.intent === 'service_info' && !!r.entities.service);
  const body = quoted ? `${COPY.unphrasedPrefix}\n\n${r.answer}` : r.answer;
  return r.preface ? `${r.preface}\n\n${body}` : body;
}
