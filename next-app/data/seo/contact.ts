// data/seo/contact.ts — the support contact details and hours, in one place.
//
// These used to live in three places: lib/seo-engine/links.ts (site), the booking app's
// PricingPage.jsx (hard-coded), and the terms of service (prose). The hours are now a
// published, contractual commitment (Terms 2.0 §14.4 and Annexure B), so they are data here
// and every consumer reads them: the site's CTAs, the booking app via serviceability.json,
// and the support assistant's out-of-hours branch.
//
// Support hours were set by the owner on 2026-09-10 to what one person can genuinely cover.
// Outside them the assistant takes a message and the team replies within 24 hours.

export const SUPPORT_PHONE_E164 = '+919355114869';
export const SUPPORT_PHONE_DISPLAY = '+91 93551 14869';
/** wa.me needs the number with no plus sign. */
export const SUPPORT_WHATSAPP_NUMBER = '919355114869';
export const SUPPORT_EMAIL = 'info@mybuddymaid.in';

export interface SupportHours {
  /** IANA zone the hours are expressed in. */
  timezone: 'Asia/Kolkata';
  /** 0 = Sunday … 6 = Saturday, as Date#getDay() returns. */
  days: number[];
  /** Opening hour, 24-hour clock, inclusive. */
  openHour: number;
  /** Closing hour, 24-hour clock, exclusive. */
  closeHour: number;
  /** The wording used on every surface, so it cannot drift. */
  label: string;
  /** What we promise when a message arrives outside these hours. */
  replyWithinHours: number;
}

export const SUPPORT_HOURS: SupportHours = {
  timezone: 'Asia/Kolkata',
  days: [1, 2, 3, 4, 5, 6],
  openHour: 10,
  closeHour: 19,
  label: 'Mon–Sat, 10 AM–7 PM IST',
  replyWithinHours: 24,
};

/**
 * True when `at` falls inside published support hours, evaluated in IST regardless of the
 * server's own timezone. Vercel functions run in UTC; a naive Date#getHours() would be wrong
 * by five and a half hours.
 */
export function isWithinSupportHours(at: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SUPPORT_HOURS.timezone,
    hour: 'numeric',
    hour12: false,
    weekday: 'short',
  }).formatToParts(at);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? -1);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  if (day < 0 || Number.isNaN(hour)) return false;
  return SUPPORT_HOURS.days.includes(day) && hour >= SUPPORT_HOURS.openHour && hour < SUPPORT_HOURS.closeHour;
}
