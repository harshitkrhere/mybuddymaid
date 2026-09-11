// lib/assistant/redact.ts — strip what a person typed that a language-model provider must not
// receive (owner decision 17; Privacy Policy 2.0 §3.6).
//
// The account never sends name, phone, address, bookings or payment data to a model. But the
// customer's own message goes to the model, and people type their phone number into a chat box
// without being asked. So the message is redacted here, on our server, before it leaves — and
// ONLY for the outbound provider call. The stored transcript and the agent's view keep the
// original: a customer who typed their number so the team could call back must not have it
// silently discarded.
//
// Order matters against entity extraction. A pincode is six digits and a phone number is ten;
// retrieve.ts has already read the pincode by the time this runs, and six-digit runs are left
// alone here so a pincode typed with a phone number is still a pincode.
//
// This cannot be perfect, and the privacy policy says so ("the removal is automatic and we
// cannot promise it catches every possible form, which is why we ask as well"). Do not let that
// sentence be tightened into a stronger claim than this file can keep.

export const REDACTED = {
  phone: '[phone number removed]',
  email: '[email removed]',
  card: '[card number removed]',
} as const;

// Indian mobiles: optional +91 / 91 / 0, then ten digits starting 6–9, allowing spaces, dashes
// or dots between groups. Also catches a bare ten-digit run.
const PHONE = /(?<![\d])(?:\+?91[\s.-]?|0)?(?:[6-9]\d{9}|[6-9](?:[\s.-]?\d){9})(?![\d])/g;

// 13–19 digits with optional spaces or dashes: card numbers, and long account-like numbers.
const CARD = /(?<![\d])(?:\d[\s-]?){13,19}(?![\d])/g;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export interface Redaction {
  text: string;
  /** Which kinds were removed, for the record. Never the values. */
  removed: Array<keyof typeof REDACTED>;
}

export function redact(input: string): Redaction {
  const removed = new Set<keyof typeof REDACTED>();
  let text = input;

  text = text.replace(EMAIL, () => (removed.add('email'), REDACTED.email));
  // Cards before phones: a 16-digit run contains a 10-digit run.
  text = text.replace(CARD, (m) => (digits(m) >= 13 ? (removed.add('card'), REDACTED.card) : m));
  text = text.replace(PHONE, () => (removed.add('phone'), REDACTED.phone));

  return { text, removed: [...removed] };
}

function digits(s: string): number {
  return s.replace(/\D/g, '').length;
}
