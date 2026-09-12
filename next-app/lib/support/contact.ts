// lib/support/contact.ts — the name and mobile number a handoff needs before a person gets the
// conversation.
//
// Owner decision (2026-09-12): the team gets a conversation only with a way to reach the customer
// back, signed in or not. Anonymous chats had been arriving in Chatwoot with no name and no
// number, and once the visitor closed the tab there was no way to follow up.
//
// Indian mobiles only: ten digits starting 6–9, with or without +91 / 91 / 0 in front and spaces,
// dashes or dots between groups. Stored as E.164 (+91XXXXXXXXXX), shown as +91 XXXXX XXXXX. It is
// the same shape redact.ts strips before a message reaches a model; the number given here is for
// the team, and goes to Chatwoot on purpose — on the conversation, never on the Chatwoot contact,
// which would let Chatwoot merge contacts by it.

export interface ContactDetails {
  name: string | null;
  /** E.164: +91 and ten digits. */
  phone: string;
}

const MOBILE = /^[6-9]\d{9}$/;

/** A number typed into a field, as E.164, or null when it is not an Indian mobile. */
export function normalisePhone(raw: string | null | undefined): string | null {
  let digits = String(raw ?? '').replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('0091')) digits = digits.slice(4);
  else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return MOBILE.test(digits) ? `+91${digits}` : null;
}

// The shape redact.ts strips, capturing the ten digits.
const IN_TEXT = /(?<!\d)(?:\+?91[\s.-]?|0)?([6-9](?:[\s.-]?\d){9})(?!\d)/;

/** The first Indian mobile in free text, as E.164, or null. */
export function findPhone(text: string): string | null {
  const m = IN_TEXT.exec(text);
  return m ? normalisePhone(m[1]) : null;
}

/** +91XXXXXXXXXX → "+91 XXXXX XXXXX". Anything else comes back as it is. */
export function formatPhone(e164: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}

// Words people put around a name and a number that are not the name.
const NAME_NOISE = /\b(my|name|naam|mera|meri|is|hai|phone|mobile|mob|number|num|no|contact|call|me|on|at|and|the|this|it|its|it's|hi|hello|please|pls)\b/gi;

/**
 * A name as a person would want to see it: letters, marks and the odd apostrophe or hyphen,
 * each word capitalised, 2–60 characters. Null when nothing name-like is left.
 */
export function cleanName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/[^\p{L}\p{M}\s.'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.replace(/[^\p{L}]/gu, '').length < 2 || cleaned.length > 60) return null;
  return cleaned.replace(/\p{L}+/gu, (w) => w.charAt(0).toUpperCase() + w.slice(1));
}

export interface ParsedContact {
  phone: string | null;
  name: string | null;
  /** The message reads as an attempt at a number — a run of seven or more digits — even if it is not a valid one. */
  attempted: boolean;
}

/**
 * Details typed as a message instead of into the card: "harshit 9691982400", "name - Harshit,
 * phone - +91 96919 82400", or just the number. The name is read only when a number was found;
 * without one the message is whatever else the customer meant to say.
 */
export function parseContactMessage(text: string): ParsedContact {
  const m = IN_TEXT.exec(text);
  const phone = m ? normalisePhone(m[1]) : null;
  const attempted = /\d{7,}/.test(text.replace(/[\s.()-]/g, ''));
  if (!phone || !m) return { phone: null, name: null, attempted };
  const rest = (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)).replace(NAME_NOISE, ' ').replace(/[\d:;,|/\\_-]+/g, ' ');
  return { phone, name: cleanName(rest), attempted };
}

/** The details as a line of the transcript — the same words the widget shows in the customer's bubble. */
export function contactLine(labels: { name: string; phone: string }, name: string | null, phone: string): string {
  return `${name ? `${labels.name}: ${name}\n` : ''}${labels.phone}: ${phone}`;
}
