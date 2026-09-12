// lib/assistant/suggestions.ts — what the widget offers to ask next, chosen from what was just
// answered.
//
// Three at most, never the thing just asked, and none once a person has the conversation — the
// escalation card offers WhatsApp and a call then, and a chip would compete with it. The wording
// is copy.ts's: every prompt is a question retrieve.ts answers with the intent it names
// (suggestions.test.ts checks each one), so a tap never lands in the refusal it was meant to
// save the customer from.

import { COPY } from './copy';
import type { Intent } from './retrieve';

const P = COPY.prompts;

const BY_INTENT: Partial<Record<Intent, readonly string[]>> = {
  greeting: [P.services, P.pricing, P.areas],
  serviceability: [P.pricing, P.services, P.booking],
  pricing: [P.gold, P.replacements, P.booking],
  plan_detail: [P.replacements, P.booking, P.areas],
  service_info: [P.pricing, P.areas, P.verification],
  verification: [P.pricing, P.replacements, P.booking],
  faq: [P.pricing, P.replacements, P.booking],
  replacement: [P.pricing, P.booking, P.team],
  refund_question: [P.replacements, P.team],
  booking_process: [P.pricing, P.areas, P.team],
  booking_status: [P.team],
  contact: [P.team],
  not_offered: [P.services, P.areas],
  // A refusal already comes with the WhatsApp-or-call card, so no team chip beside it.
  unknown: [P.services, P.pricing, P.areas],
};

export const MAX_SUGGESTIONS = 3;

/** Up to three prompts to offer under this answer; none when the conversation is with a person, or while the contact card is up. */
export function suggestionsFor(a: { intent: Intent; handoff?: unknown; contactRequired?: boolean }): string[] {
  if (a.handoff || a.contactRequired) return [];
  return (BY_INTENT[a.intent] ?? []).slice(0, MAX_SUGGESTIONS);
}
