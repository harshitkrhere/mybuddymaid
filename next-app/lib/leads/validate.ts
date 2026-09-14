// lib/leads/validate.ts — what /api/lead accepts, as pure functions with no I/O, so the rules
// are tested here and the route stays a thin shell (FIN-B03, FIN-S06, FIN-API01, FIN-API02).
//
// Everything a browser sends is untrusted twice over: the form is public and unauthenticated,
// and the row goes in with the service-role key, which bypasses RLS. So every location value is
// checked against the data layer (nothing outside the footprint is ever written), the phone is
// normalised to the ten digits the DB CHECK expects, free text is trimmed and capped to the
// column limits, the source page is the path alone, attribution is reduced to a whitelist of
// keys, and a filled honeypot field is accepted and thrown away.

export const NAME_MAX = 80;
export const SOCIETY_MAX = 120;
export const PAGE_MAX = 300;
export const ATTRIBUTION_VALUE_MAX = 200;
/** What components/shared/Analytics.tsx stores under mbm_attr / mbm_first_attr, and nothing else. */
export const ATTRIBUTION_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'msclkid', 'referrer', 'landing', 'at'] as const;
/** The form field a person never sees; a value here means a script filled every field it found. */
export const HONEYPOT_FIELD = 'website';

export interface LeadInput {
  name?: unknown;
  phone?: unknown;
  city?: unknown;
  locality?: unknown;
  service?: unknown;
  pincode?: unknown;
  entity?: unknown;
  society?: unknown;
  page?: unknown;
  attribution?: unknown;
  website?: unknown;
}

export interface Attribution {
  last: Record<string, string> | null;
  first: Record<string, string> | null;
}

/** Exactly the columns the route inserts; lib/leads/schema.test.ts pins them to the migration. */
export interface LeadRow {
  name: string;
  phone: string;
  city_slug: string;
  locality_slug: string;
  pincode: string | null;
  entity_slug: string | null;
  society: string | null;
  service_slug: string | null;
  source_page: string | null;
  status: 'new';
  attribution: Attribution | null;
}

/** The data-layer lookups the rules need; the route binds them to data/seo, tests to fixtures. */
export interface LeadRules {
  cityExists(city: string): boolean;
  localityExists(city: string, locality: string): boolean;
  serviceExists(service: string): boolean;
  pincodeServiceable(pincode: string): boolean;
  entityExists(city: string, locality: string, entity: string): boolean;
}

export type LeadField = 'name' | 'phone' | 'city' | 'locality' | 'service' | 'pincode' | 'entity';

export type LeadValidation = { ok: true; honeypot: false; row: LeadRow } | { ok: true; honeypot: true } | { ok: false; field: LeadField; error: string };

/** The messages the form shows for a rejected field; the form's own pre-checks use the same words. */
export const MESSAGES: Record<LeadField, string> = {
  name: 'Please enter your name.',
  phone: 'Enter a valid 10-digit Indian mobile number.',
  city: 'Please choose a city we serve.',
  locality: 'Please select your area.',
  service: 'Please choose a service.',
  pincode: 'That pincode is outside the areas we serve.',
  entity: 'Unknown society page.',
};

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const SLUG = /^[a-z0-9-]+$/;
const PINCODE = /^[1-9][0-9]{5}$/;

/** Ten digits of an Indian mobile: spaces and punctuation dropped, a leading +91 / 91 / 0 removed. */
export function normalisePhone(raw: unknown): string | null {
  let d = str(raw).replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9][0-9]{9}$/.test(d) ? d : null;
}

export function normaliseName(raw: unknown): string {
  return str(raw).replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
}

/** The path only — never a query string, which could carry someone else's utm values or worse. */
export function sourcePage(raw: unknown): string | null {
  const p = str(raw).split(/[?#]/)[0].trim();
  return p.startsWith('/') ? p.slice(0, PAGE_MAX) : null;
}

function pickAttribution(v: unknown): Record<string, string> | null {
  if (!v || typeof v !== 'object') return null;
  const out: Record<string, string> = {};
  for (const k of ATTRIBUTION_KEYS) {
    const x = (v as Record<string, unknown>)[k];
    if (typeof x === 'string' && x) out[k] = x.slice(0, ATTRIBUTION_VALUE_MAX);
  }
  return Object.keys(out).length ? out : null;
}

/** {last, first} with whitelisted string values only; null when nothing usable was sent. */
export function sanitiseAttribution(raw: unknown): Attribution | null {
  if (!raw || typeof raw !== 'object') return null;
  const last = pickAttribution((raw as { last?: unknown }).last);
  const first = pickAttribution((raw as { first?: unknown }).first);
  return last || first ? { last, first } : null;
}

export function validateLead(input: LeadInput, rules: LeadRules): LeadValidation {
  if (str(input[HONEYPOT_FIELD]).trim()) return { ok: true, honeypot: true };

  const name = normaliseName(input.name);
  if (name.length < 2) return { ok: false, field: 'name', error: MESSAGES.name };
  const phone = normalisePhone(input.phone);
  if (!phone) return { ok: false, field: 'phone', error: MESSAGES.phone };

  const city = str(input.city).trim();
  if (!SLUG.test(city) || !rules.cityExists(city)) return { ok: false, field: 'city', error: MESSAGES.city };
  const locality = str(input.locality).trim();
  if (!SLUG.test(locality) || !rules.localityExists(city, locality)) return { ok: false, field: 'locality', error: MESSAGES.locality };
  const service = str(input.service).trim();
  if (service && (!SLUG.test(service) || !rules.serviceExists(service))) return { ok: false, field: 'service', error: MESSAGES.service };
  const pincode = str(input.pincode).trim();
  if (pincode && (!PINCODE.test(pincode) || !rules.pincodeServiceable(pincode))) return { ok: false, field: 'pincode', error: MESSAGES.pincode };
  const entity = str(input.entity).trim();
  if (entity && (!SLUG.test(entity) || !rules.entityExists(city, locality, entity))) return { ok: false, field: 'entity', error: MESSAGES.entity };

  const society = str(input.society).replace(/\s+/g, ' ').trim().slice(0, SOCIETY_MAX);
  return {
    ok: true,
    honeypot: false,
    row: {
      name,
      phone,
      city_slug: city,
      locality_slug: locality,
      pincode: pincode || null,
      entity_slug: entity || null,
      society: society || null,
      service_slug: service || null,
      source_page: sourcePage(input.page),
      status: 'new',
      attribution: sanitiseAttribution(input.attribution),
    },
  };
}

/**
 * Same-origin only: the form is ours, so the Origin header must name a host that served it.
 * On Vercel the served host arrives as x-forwarded-host and as host; either matching will do.
 * No Origin at all (curl, a server-side script) is refused too — browsers always send it on a
 * cross-document POST, and there is no legitimate caller that is not a browser.
 */
export function originAllowed(origin: string | null, hosts: Array<string | null | undefined>): boolean {
  if (!origin) return false;
  let host: string;
  try {
    host = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  return hosts.some((h) => typeof h === 'string' && h.trim().toLowerCase() === host);
}

/** The caller's address as the platform reports it; 'unknown' groups requests with no header. */
export function clientIp(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  return headers.get('x-real-ip')?.trim() || 'unknown';
}
