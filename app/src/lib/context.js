// app/src/lib/context.js — what the site tells the app about the visitor, and where the app
// sends them for it.
//
// A location page's "Book in the app" link is /app/auth?city=…&locality=…&service=…; a plan
// card's is /app/auth?plan=… once checkout is live. Before this module nothing read those
// parameters: the visitor signed up, sat through onboarding and landed on the home page with
// the service and area they had chosen gone (audit FIN-B02 / FIN-B09). Now main.jsx captures
// them on the first load, validates every value against serviceability.json (the same data
// layer as the site, so nothing we do not serve gets through) and keeps them in
// sessionStorage — the one store that survives the Google sign-in round trip in the same tab.
// The splash uses the context once to route (/services/:id, /services, /pricing); the booking
// sheet and the pricing page read it to pre-fill their selects for the rest of the session.
//
// The key predates this module: older code stored a bare string ('book', a service id, a plan
// key) and the splash read it. Those still work — readContext() upgrades them to the object.
import { CITIES, LOCALITIES, PLANS, SERVICES_LIST, SPA_SERVICE_MAP } from './serviceability';

export const CONTEXT_KEY = 'mbm_redirect_context';

/** data-layer service slug → the app's own service id (postnatal has no data-layer twin). */
const SPA_ID_BY_SLUG = Object.fromEntries(Object.entries(SPA_SERVICE_MAP).map(([id, slug]) => [slug, id]));
const LEGACY_SERVICE_IDS = ['part-time', 'full-time', 'elderly-care', 'cook', 'nanny', 'postnatal'];

function store(explicit) {
  try {
    return explicit || window.sessionStorage;
  } catch {
    return null;
  }
}

/** The valid parts of a query string, or null when it carries nothing we recognise. */
export function parseContext(search) {
  const q = new URLSearchParams(search || '');
  const out = {};
  const city = q.get('city');
  if (city && CITIES.some((c) => c.slug === city)) out.city = city;
  const locality = q.get('locality');
  if (out.city && locality && LOCALITIES.some((l) => l.city === out.city && l.slug === locality)) out.locality = locality;
  const service = q.get('service');
  if (service && SERVICES_LIST.some((s) => s.slug === service)) {
    out.serviceSlug = service;
    out.service = SPA_ID_BY_SLUG[service] || null;
  }
  const plan = q.get('plan');
  if (plan && PLANS.some((p) => p.key === plan)) out.plan = plan;
  return Object.keys(out).length ? { ...out, at: new Date().toISOString() } : null;
}

/** Remembers the query string's context for the session; a URL without one keeps what is stored. */
export function captureContext(search, storage) {
  const s = store(storage);
  if (!s) return null;
  const ctx = parseContext(search);
  if (!ctx) return readContext(s);
  try {
    s.setItem(CONTEXT_KEY, JSON.stringify(ctx));
  } catch {
    // storage full or blocked: the visit still works, unprefilled
  }
  return ctx;
}

/** A pre-2026-09 bare-string value in the same shape as today's object. */
export function fromLegacy(value) {
  if (value === 'book') return { intent: 'book' };
  if (LEGACY_SERVICE_IDS.includes(value)) return { service: value, serviceSlug: SPA_SERVICE_MAP[value] || null };
  if (PLANS.some((p) => p.key === value)) return { plan: value };
  return null;
}

export function readContext(storage) {
  const s = store(storage);
  if (!s) return null;
  let raw;
  try {
    raw = s.getItem(CONTEXT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  if (raw[0] === '{') {
    try {
      const o = JSON.parse(raw);
      return o && typeof o === 'object' ? o : null;
    } catch {
      return null;
    }
  }
  return fromLegacy(raw);
}

/**
 * Where the splash sends a signed-in visitor for this context, or null for the home page:
 * the service's own page when the app has it, the services list when only an area (or a
 * service the app does not list) is known, the pricing page for a plan. Used once — a
 * context already routed does not route again.
 */
export function destinationFor(ctx) {
  if (!ctx || ctx.routed) return null;
  if (ctx.service) return `/services/${ctx.service}`;
  if (ctx.serviceSlug || ctx.intent === 'book' || ctx.city) return '/services';
  if (ctx.plan) return '/pricing';
  return null;
}

/** Keeps the context for pre-filling but stops it from routing a second time. */
export function markRouted(storage) {
  const s = store(storage);
  const ctx = readContext(s);
  if (!s || !ctx) return;
  try {
    s.setItem(CONTEXT_KEY, JSON.stringify({ ...ctx, routed: true }));
  } catch {
    // nothing to do: at worst the next splash routes the same way once more
  }
}

export function clearContext(storage) {
  try {
    store(storage)?.removeItem(CONTEXT_KEY);
  } catch {
    // nothing to clear
  }
}
