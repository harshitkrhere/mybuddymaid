// lib/growth/ga4.ts — GA4 through the Data API (reports) and the Admin API (custom dimensions).
//
// The site fires whatsapp_click / call_click / app_click with city, zone, locality, service
// and pincode parameters. GA4 only lets a report break an event down by a parameter once that
// parameter is registered as an event-scoped custom dimension, and registration is not
// retroactive — so `growth:ga4:register` runs once, and the report notes the date.
import type { City, Zone } from '@/data/seo';
import type { FetchLike } from './google-auth';
import { bearer } from './google-auth';
import type { Window, WindowKey } from './windows';
import type { CtaBreakdown, CtaCounts, CtaEvent, Ga4Snapshot, OrganicGeo } from './types';

export const GA4_DATA_API = 'https://analyticsdata.googleapis.com/v1beta';
export const GA4_ADMIN_API = 'https://analyticsadmin.googleapis.com/v1beta';
export const CTA_EVENTS: readonly CtaEvent[] = ['whatsapp_click', 'call_click', 'app_click'];

export interface CustomDimensionSpec {
  parameterName: string;
  displayName: string;
  scope: 'EVENT';
  description: string;
}

/** The event parameters the site already sends (components/shared/Analytics.tsx), plus `source` for the booking app. */
export const CUSTOM_DIMENSIONS: CustomDimensionSpec[] = [
  { parameterName: 'city', displayName: 'MBM city', scope: 'EVENT', description: 'City slug of the page or CTA (next-app/data/seo)' },
  { parameterName: 'zone', displayName: 'MBM zone', scope: 'EVENT', description: 'Zone slug of the page or CTA' },
  { parameterName: 'locality', displayName: 'MBM locality', scope: 'EVENT', description: 'Locality slug of the page or CTA' },
  { parameterName: 'service', displayName: 'MBM service', scope: 'EVENT', description: 'Service slug of the page or CTA' },
  { parameterName: 'pincode', displayName: 'MBM pincode', scope: 'EVENT', description: 'Pincode of the page or CTA' },
  { parameterName: 'source', displayName: 'MBM source', scope: 'EVENT', description: 'site or app: which front-end fired the event' },
];

export interface RunReportRequest {
  dateRanges: Array<{ startDate: string; endDate: string }>;
  dimensions: Array<{ name: string }>;
  metrics: Array<{ name: string }>;
  dimensionFilter?: unknown;
  orderBys?: unknown[];
  limit: number;
}

export function ctaReportBody(w: Window): RunReportRequest {
  return {
    dateRanges: [{ startDate: w.start, endDate: w.end }],
    dimensions: ['eventName', 'customEvent:city', 'customEvent:locality', 'customEvent:service'].map((name) => ({ name })),
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: [...CTA_EVENTS] } } },
    limit: 100000,
  };
}

export function organicGeoBody(w: Window): RunReportRequest {
  return {
    dateRanges: [{ startDate: w.start, endDate: w.end }],
    dimensions: [{ name: 'city' }, { name: 'region' }],
    metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
    dimensionFilter: { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { matchType: 'EXACT', value: 'Organic Search' } } },
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 500,
  };
}

export interface ReportRow {
  dims: Record<string, string>;
  metrics: Record<string, number>;
}

export function parseRunReport(json: unknown): ReportRow[] {
  const j = (json ?? {}) as {
    dimensionHeaders?: Array<{ name: string }>;
    metricHeaders?: Array<{ name: string }>;
    rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }>;
  };
  const dh = (j.dimensionHeaders ?? []).map((h) => h.name);
  const mh = (j.metricHeaders ?? []).map((h) => h.name);
  return (j.rows ?? []).map((r) => ({
    dims: Object.fromEntries(dh.map((n, i) => [n, r.dimensionValues?.[i]?.value ?? ''])),
    metrics: Object.fromEntries(mh.map((n, i) => [n, Number(r.metricValues?.[i]?.value ?? 0)])),
  }));
}

export async function runReport(fetchImpl: FetchLike, token: string, propertyId: string, body: RunReportRequest): Promise<ReportRow[]> {
  const res = await fetchImpl(`${GA4_DATA_API}/properties/${propertyId}:runReport`, { method: 'POST', headers: bearer(token), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`GA4 runReport failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return parseRunReport(await res.json());
}

/** Spellings GA4's geo dimension uses that the data layer's alt names do not carry. */
const GEO_SYNONYMS: Record<string, string> = {
  gurugram: 'gurgaon',
  bengaluru: 'bangalore',
  mangaluru: 'mangalore',
  'new delhi': 'delhi',
  bombay: 'mumbai',
  'navi mumbai': 'mumbai',
  'greater noida': 'greater-noida',
  'noida extension': 'greater-noida',
};

export function mapGeoCity(name: string, cities: City[], zones: Zone[] = []): string | null {
  const n = name.trim().toLowerCase();
  if (!n || n === '(not set)') return null;
  for (const c of cities) {
    if (n === c.slug || n === c.name.toLowerCase() || c.altNames.some((a) => a.toLowerCase() === n)) return c.slug;
  }
  for (const z of zones) {
    if (n === z.name.toLowerCase() || z.altNames.some((a) => a.toLowerCase() === n)) return z.city;
  }
  return GEO_SYNONYMS[n] ?? null;
}

export const zeroCta = (): CtaCounts => ({ whatsapp_click: 0, call_click: 0, app_click: 0 });
const sumCta = (c: CtaCounts) => c.whatsapp_click + c.call_click + c.app_click;
const norm = (v: string | undefined) => (!v || v === '(not set)' ? '(none)' : v);

/** rows from ctaReportBody. */
export function ctaBreakdown(rows: ReportRow[]): CtaBreakdown {
  const total = zeroCta();
  const byCity: Record<string, CtaCounts> = {};
  const byService: Record<string, CtaCounts> = {};
  const localities = new Map<string, { city: string; locality: string; events: CtaCounts }>();
  for (const r of rows) {
    const ev = r.dims.eventName as CtaEvent;
    if (!CTA_EVENTS.includes(ev)) continue;
    const n = r.metrics.eventCount ?? 0;
    const city = norm(r.dims['customEvent:city']);
    const service = norm(r.dims['customEvent:service']);
    const locality = norm(r.dims['customEvent:locality']);
    total[ev] += n;
    (byCity[city] ??= zeroCta())[ev] += n;
    (byService[service] ??= zeroCta())[ev] += n;
    if (locality !== '(none)') {
      const key = `${city}/${locality}`;
      const e = localities.get(key) ?? { city, locality, events: zeroCta() };
      e.events[ev] += n;
      localities.set(key, e);
    }
  }
  const topLocalities = [...localities.values()].sort((a, b) => sumCta(b.events) - sumCta(a.events) || a.locality.localeCompare(b.locality)).slice(0, 20);
  return { total, byCity, byService, topLocalities };
}

/** rows from organicGeoBody. Unmapped cities are listed, never guessed into a bucket. */
export function organicGeo(rows: ReportRow[], cities: City[], zones: Zone[]): OrganicGeo {
  const byCity: Record<string, { sessions: number; users: number }> = {};
  const unmapped: OrganicGeo['unmapped'] = [];
  let totalSessions = 0;
  for (const r of rows) {
    const sessions = r.metrics.sessions ?? 0;
    const users = r.metrics.activeUsers ?? 0;
    totalSessions += sessions;
    const slug = mapGeoCity(r.dims.city ?? '', cities, zones);
    if (slug) {
      const b = (byCity[slug] ??= { sessions: 0, users: 0 });
      b.sessions += sessions;
      b.users += users;
    } else unmapped.push({ city: r.dims.city ?? '', region: r.dims.region ?? '', sessions });
  }
  return { totalSessions, byCity, unmapped: unmapped.sort((a, b) => b.sessions - a.sessions).slice(0, 20) };
}

/** Event-scoped parameter names already registered on the property (Admin API list response). */
export function registeredDimensionNames(json: unknown): string[] {
  const list = ((json ?? {}) as { customDimensions?: Array<{ parameterName?: string; scope?: string }> }).customDimensions ?? [];
  return list.filter((d) => d.scope === 'EVENT' && d.parameterName).map((d) => d.parameterName as string);
}

export function missingDimensions(registered: string[]): CustomDimensionSpec[] {
  const have = new Set(registered);
  return CUSTOM_DIMENSIONS.filter((d) => !have.has(d.parameterName));
}

export interface Ga4SnapshotInput {
  propertyId: string;
  generatedAt: string;
  windows: Record<WindowKey, Window>;
  registered: string[];
  cta: Record<WindowKey, ReportRow[] | null>;
  geo: Record<WindowKey, ReportRow[] | null>;
  cities: City[];
  zones: Zone[];
  errors: string[];
}

export function buildGa4Snapshot(i: Ga4SnapshotInput): Ga4Snapshot {
  const missing = missingDimensions(i.registered).map((d) => d.parameterName);
  return {
    kind: 'ga4',
    version: 1,
    generatedAt: i.generatedAt,
    propertyId: i.propertyId,
    windows: i.windows,
    customDimensions: { registered: i.registered, missing },
    cta: { current: i.cta.current ? ctaBreakdown(i.cta.current) : null, previous: i.cta.previous ? ctaBreakdown(i.cta.previous) : null },
    organicGeo: {
      current: i.geo.current ? organicGeo(i.geo.current, i.cities, i.zones) : null,
      previous: i.geo.previous ? organicGeo(i.geo.previous, i.cities, i.zones) : null,
    },
    errors: i.errors,
  };
}
