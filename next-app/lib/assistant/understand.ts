// lib/assistant/understand.ts — the model as a reader, never as an answerer.
//
// The rules in retrieve.ts understand the questions we anticipated. When they draw a blank —
// a typo-ridden message, Hinglish they do not know, a roundabout way of asking a plain thing
// ("my mother is 80 and alone during the day") — the assistant used to refuse. Now it asks a
// model to do one narrow job first: say what the customer is asking, as a short plain-English
// question using the words the rules know, plus an intent label. That rewrite is then put
// through the SAME retrieval as everything else, so the answer still comes from the data
// layer and still goes through the number gate. The model reads; it does not write facts.
//
// Guard rails, because a rewrite is model output:
//   - it is only consulted when the rules found nothing (low confidence);
//   - the rewrite may not contain a number the customer did not type (a pincode or price it
//     invented would otherwise pick the wrong data);
//   - the intent it names must be one the rules know, and the retrieval of the rewrite must
//     itself be confident — a rewrite the rules cannot answer changes nothing;
//   - the customer's message goes out redacted, like every other model call.
//
// One extra model call, only on the messages that would otherwise have been refused.

import { CITIES, SERVICES, PLANS } from '@/data/seo';
import { phrase, type ChatMessage, type FetchLike, type ProviderConfig } from './provider';
import type { Intent } from './retrieve';

export interface Understanding {
  intent: Intent;
  question: string;
  modelId: string;
}

const INTENTS: Array<[Intent, string]> = [
  ['serviceability', 'whether we serve a city, locality or pincode'],
  ['pricing', 'what plans, fees, prices, salaries or packages cost'],
  ['plan_detail', 'what a named plan (Silver, Gold, Diamond) includes'],
  ['service_info', 'what a kind of helper does, or which kinds we place'],
  ['not_offered', 'work we do not do (drivers, guards, nurses, plumbers, tutors…)'],
  ['refund_question', 'how refunds or cancellations work'],
  ['refund_request', 'the customer wants their money back'],
  ['replacement', 'changing or replacing a helper, or a helper who left'],
  ['verification', 'background checks, police verification, safety, trust'],
  ['booking_process', 'how to book, hire, register, get started'],
  ['booking_status', 'the status of the customer’s own booking'],
  ['contact', 'phone, WhatsApp, email, hours, address'],
  ['human', 'wants to talk to a person'],
  ['complaint', 'unhappy with a helper or the service'],
  ['safety', 'theft, harassment, abuse, danger'],
  ['payment_issue', 'a payment that failed, was deducted twice, or is stuck'],
  ['faq', 'some other question about domestic help that our help pages might answer'],
  ['unknown', 'not about domestic help at all, or impossible to tell'],
];

const KNOWN_INTENTS = new Set<Intent>(INTENTS.map(([i]) => i));
const MAX_QUESTION_CHARS = 200;

function systemPrompt(): string {
  const cities = CITIES.map((c) => c.name).join(', ');
  const services = SERVICES.map((s) => s.name).join(', ');
  const plans = PLANS.map((p) => p.name).join(', ');
  return [
    'You read messages sent to the support assistant of MyBuddyMaid, a service in India that introduces households to verified domestic helpers. You do NOT answer them.',
    `Kinds of helper: ${services}. Plans (one-time platform fee): ${plans}. Cities served: ${cities}.`,
    'The message may be in English, Hindi, Hinglish, or badly typed, and may rely on the earlier turns for context.',
    'Your job: say what the customer is asking, as ONE short plain-English question (under 20 words) that means the same thing. Use these words where they apply: the kind of helper, the plan name, the city, and the locality or pincode exactly as the customer typed it; and the phrases "how much does … cost", "do you serve …", "what does … include", "how do I book", "replacement", "refund", "verification", "contact number", "talk to a person", "complaint", "payment failed".',
    'Never add a number, place, plan or service the customer did not mention. Never answer the question.',
    'Intent must be one of: ' + INTENTS.map(([i, d]) => `${i} (${d})`).join('; ') + '.',
    'Reply with JSON only, on one line: {"intent":"…","question":"…"}. If the message is not about domestic help, use {"intent":"unknown","question":""}.',
  ].join('\n');
}

function parse(text: string): { intent: string; question: string } | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]) as { intent?: unknown; question?: unknown };
    if (typeof j.intent !== 'string' || typeof j.question !== 'string') return null;
    return { intent: j.intent.trim().toLowerCase(), question: j.question.trim() };
  } catch {
    return null;
  }
}

const numbers = (s: string) => new Set((s.match(/\d+/g) ?? []).map((n) => n.replace(/^0+(?=\d)/, '')));

/** Logged so the weekly review can see what the reader is getting wrong; the raw text is model output, not the customer's. */
function reject(modelId: string, why: string, raw: string): null {
  console.warn(`[assistant] reading rejected (${why}) from ${modelId}: ${raw.replace(/\s+/g, ' ').slice(0, 160)}`);
  return null;
}

/**
 * Ask the model what is being asked. `message` and `history` must already be redacted.
 * Returns null whenever the answer is unusable, and the caller then behaves as before.
 */
export async function understand(
  message: string,
  history: ChatMessage[],
  provider: ProviderConfig,
  opts: { fetchImpl?: FetchLike } = {},
): Promise<Understanding | null> {
  const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt() }, ...history.slice(-4), { role: 'user', content: message }];
  const result = await phrase({ messages, maxTokens: 120, temperature: 0 }, provider, { fetchImpl: opts.fetchImpl });
  if (!result) return null;

  const parsed = parse(result.text);
  if (!parsed) return reject(result.modelId, 'unparseable', result.text);
  if (!KNOWN_INTENTS.has(parsed.intent as Intent) || parsed.intent === 'unknown') return reject(result.modelId, `intent ${parsed.intent}`, result.text);
  const question = parsed.question.slice(0, MAX_QUESTION_CHARS);
  if (!question) return reject(result.modelId, 'empty question', result.text);

  // A number the customer did not type is an invention, whatever else the rewrite got right.
  const typed = numbers(message);
  for (const n of numbers(question)) if (!typed.has(n)) return reject(result.modelId, `invented number ${n}`, result.text);

  return { intent: parsed.intent as Intent, question, modelId: result.modelId };
}
