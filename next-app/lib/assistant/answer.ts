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
import { understand } from './understand';
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
  /** The record already holds a number for this customer, so a handoff need not ask for one. */
  contactKnown?: boolean;
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
  /**
   * The handoff waits for the customer's name and number; the widget shows the contact card.
   * Set alongside `handoff` for safety, where the team is alerted at once and the number is
   * asked for as well.
   */
  contactRequired?: boolean;
  /** Which model phrased the text, or null when rung 3 served it. Stored on the record. */
  modelId: string | null;
  rung: 1 | 3;
  /** Kinds of personal data stripped from the outbound message. Never the values. */
  redacted: string[];
  /** True when a model answered but its wording was rejected by the number gate. */
  gateRejected: boolean;
  /** The plain question the model read the message as, when the rules had drawn a blank. */
  understoodAs: string | null;
  /** Model calls made for this answer (0, 1 or 2), for the daily ceiling. */
  modelCalls: number;
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

// The widget's notice promises we will never ask for these. A model that turns "tell me your
// locality" into "tell me your exact address" breaks that promise, so the wording is refused
// unless the retrieved answer itself says it (it never does today).
const PERSONAL_ASKS =
  /\b(your (exact |full |home |complete |registered )?(address|phone( number)?|mobile( number)?|contact number|whatsapp number|email( address| id)?|card( number)?|aadhaar( number)?)|otp|one[- ]time password|upi pin|password)\b/i;

/** True when every gated number in `wording` is accounted for and it asks for nothing personal. */
export function passesGate(wording: string, r: Retrieval, message: string): boolean {
  const allowed = allowedNumbers(r, message);
  for (const n of gatedNumbers(wording)) if (!allowed.has(n)) return false;
  const ask = wording.match(PERSONAL_ASKS)?.[0];
  if (ask && !`${r.preface ?? ''} ${r.answer}`.toLowerCase().includes(ask.toLowerCase())) return false;
  return true;
}

// ─── Handoff ────────────────────────────────────────────────────────────────────────────────

// After a handoff every message goes to the person; the assistant answers alongside only when
// the published facts genuinely help — a price, an area, a policy. Contact details the customer
// was asked to leave, a greeting, a booking question only a person can look up: the
// acknowledgement alone. A customer already talking to us must never be handed a "how to reach
// us" card for typing their phone number (seen live, 2026-09-12).
const ANSWERS_AFTER_HANDOFF: ReadonlySet<Intent> = new Set<Intent>([
  'pricing', 'plan_detail', 'serviceability', 'service_info', 'replacement', 'refund_question', 'verification', 'booking_process', 'faq', 'not_offered',
]);

export function answersAfterHandoff(a: Pick<Answer, 'intent' | 'escalate'>): boolean {
  return !a.escalate && ANSWERS_AFTER_HANDOFF.has(a.intent);
}

export function handoffFor(now: Date = new Date()): Handoff {
  const inHours = isWithinSupportHours(now);
  return {
    inHours,
    text: inHours ? COPY.handoffInHours(SUPPORT_PHONE_DISPLAY) : COPY.handoffOutOfHours(SUPPORT_HOURS.label, SUPPORT_HOURS.replyWithinHours),
  };
}

// The team gets a conversation only with a way to reach the customer back (owner decision,
// 2026-09-12). Every escalation waits for a name and mobile number first — except safety,
// where the team is alerted at once and the number is asked for alongside.
export const GATED_ESCALATIONS: ReadonlySet<EscalationReason> = new Set<EscalationReason>(['asked_for_human', 'complaint', 'refund', 'payment', 'turn_limit']);

/** What an escalation adds to the retrieval: the handoff with the hours text, or the ask for details first. */
export function escalationFor(leadIn: string, reason: EscalationReason, contactKnown: boolean, now: Date, policy = ''): Pick<Answer, 'text' | 'escalate' | 'handoff' | 'contactRequired' | 'modelId' | 'rung'> {
  if (GATED_ESCALATIONS.has(reason) && !contactKnown) {
    return { text: `${leadIn} ${COPY.askContact}${policy}`, escalate: reason, contactRequired: true, modelId: null, rung: 3 };
  }
  const h = handoffFor(now);
  return { text: `${leadIn} ${h.text}${policy}`, escalate: reason, handoff: h, contactRequired: !contactKnown, modelId: null, rung: 3 };
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
  const outbound = redact(input.message);
  let r = retrieve(input.message);
  let understoodAs: string | null = null;
  let modelCalls = 0;

  // Rung 0: the rules drew a blank. Ask the model what is being asked — as a plain question the
  // rules DO understand — and retrieve that instead. The answer still comes from the data.
  if (r.escalate === 'low_confidence' && opts.provider) {
    modelCalls += 1;
    const u = await understand(outbound.text.slice(0, MAX_MODEL_CHARS), redactedHistory(history), opts.provider, { fetchImpl: opts.fetchImpl });
    if (u) {
      const again = retrieve(u.question);
      if (again.intent !== 'unknown') {
        console.log(`[assistant] understood as "${u.question}" (${again.intent}) via ${u.modelId}`);
        r = { ...again, language: r.language };
        understoodAs = u.question;
      }
    }
  }

  const base = {
    sources: r.sources,
    intent: r.intent,
    entities: r.entities,
    language: r.language,
    confidence: r.confidence,
    redacted: outbound.removed,
    gateRejected: false,
    understoodAs,
    modelCalls,
  };

  // Escalations and greetings are fixed copy: no model, no gate, no network.
  if (hitTurnLimit(r, history)) {
    return { ...base, ...escalationFor(COPY.escalateTurnLimit, 'turn_limit', !!input.contactKnown, now) };
  }
  if (r.escalate === 'low_confidence') {
    // Not in the knowledge: refuse and OFFER a person. The escalate flag is kept for the record
    // and so the widget shows the "Talk to our team" button, but an off-topic question does not
    // by itself put a conversation in the one support person's queue — the customer chooses.
    return { ...base, text: COPY.refuse, escalate: r.escalate, modelId: null, rung: 3 };
  }
  if (r.escalate) {
    const policy = r.escalate === 'refund' && r.entries[0] ? `\n\n${r.entries[0].a}` : '';
    return { ...base, ...escalationFor(r.answer, r.escalate, !!input.contactKnown, now, policy) };
  }
  if (r.intent === 'greeting' || r.intent === 'booking_status') {
    return { ...base, text: r.answer, modelId: null, rung: 3 };
  }

  // Rung 1: a model phrases the retrieved answer, if one is configured and answers.
  if (opts.provider) {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt(r, !!input.signedIn) },
      // Both roles are redacted: an assistant turn could have echoed something the customer typed.
      ...redactedHistory(history),
      { role: 'user', content: outbound.text.slice(0, MAX_MODEL_CHARS) },
    ];
    base.modelCalls += 1;
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

function redactedHistory(history: Turn[]): ChatMessage[] {
  return history.map<ChatMessage>((t) => ({ role: t.role, content: redact(t.content).text.slice(0, MAX_MODEL_CHARS) }));
}

const QUOTED_INTENTS = new Set<Intent>(['faq', 'pricing', 'plan_detail', 'refund_question', 'replacement', 'verification', 'booking_process', 'contact']);

/** Rung 3 text. Verbatim quotes get the "our help pages say" prefix; composed sentences do not. */
export function unphrased(r: Retrieval): string {
  const quoted = QUOTED_INTENTS.has(r.intent) || (r.intent === 'service_info' && !!r.entities.service);
  const body = quoted ? `${COPY.unphrasedPrefix}\n\n${r.answer}` : r.answer;
  return r.preface ? `${r.preface}\n\n${body}` : body;
}
