// lib/growth/supabase.ts — weekly counts from the live database, read through PostgREST with
// the service-role key, the same posture as lib/support/record.ts: server-side only, no
// client SDK, RLS never involved. Only counts leave this module; a booking's phone number or
// a lead's name is never read into a snapshot.
import type { City, Zone } from '@/data/seo';
import type { FetchLike } from './google-auth';
import type { Window, WindowKey } from './windows';
import { inWindow } from './windows';
import type { BookingCounts, LeadCounts, SupabaseSnapshot, SupportCounts } from './types';

export interface PgClient {
  url: string; // https://<ref>.supabase.co
  key: string;
  fetchImpl: FetchLike;
}

export class TableMissingError extends Error {
  constructor(table: string) {
    super(`table ${table} does not exist`);
    this.name = 'TableMissingError';
  }
}

/** Every row of `table?query`, in pages of `pageSize`, using the Range header PostgREST honours. */
export async function fetchAll<T>(client: PgClient, table: string, query: string, pageSize = 1000): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  for (;;) {
    const res = await client.fetchImpl(`${client.url}/rest/v1/${table}?${query}`, {
      headers: { apikey: client.key, authorization: `Bearer ${client.key}`, 'range-unit': 'items', range: `${from}-${from + pageSize - 1}` },
    });
    if (res.status === 416) return out;
    if (res.status === 404) throw new TableMissingError(table);
    if (!res.ok) {
      const text = await res.text();
      if (/42P01|PGRST205|does not exist|Could not find the table/i.test(text)) throw new TableMissingError(table);
      throw new Error(`${table}: ${res.status} ${text.slice(0, 200)}`);
    }
    const rows = (await res.json()) as T[];
    out.push(...rows);
    if (rows.length < pageSize) return out;
    from += pageSize;
  }
}

/** Free-text city ("Sector 50, Noida", "Bengaluru") → city slug, longest name first so "greater noida" beats "noida". */
export function normaliseCityText(text: string | null | undefined, cities: City[], zones: Zone[]): string | null {
  const t = (text ?? '').toLowerCase();
  if (!t.trim()) return null;
  const names: Array<{ name: string; slug: string }> = [];
  for (const c of cities) {
    names.push({ name: c.name.toLowerCase(), slug: c.slug }, { name: c.slug.replace(/-/g, ' '), slug: c.slug });
    for (const a of c.altNames) names.push({ name: a.toLowerCase(), slug: c.slug });
  }
  for (const z of zones) {
    names.push({ name: z.name.toLowerCase(), slug: z.city });
    for (const a of z.altNames) names.push({ name: a.toLowerCase(), slug: z.city });
  }
  names.sort((a, b) => b.name.length - a.name.length);
  for (const n of names) if (t.includes(n.name)) return n.slug;
  return null;
}

export interface BookingRow {
  created_at: string;
  status: string | null;
  service: string | null;
  city: string | null;
  city_slug?: string | null;
}
export interface SupportRow {
  started_at: string;
  city_slug: string | null;
  escalated: boolean | null;
  outcome: string | null;
}
export interface LeadRow {
  created_at: string;
  status: string | null;
  city_slug: string | null;
  service_slug: string | null;
}

const count = (m: Record<string, number>, key: string) => {
  m[key] = (m[key] ?? 0) + 1;
};

export function bookingCounts(rows: BookingRow[], w: Window, cities: City[], zones: Zone[]): BookingCounts {
  const out: BookingCounts = { total: 0, confirmed: 0, byStatus: {}, byCity: {}, byService: {}, unmappedCity: 0 };
  for (const r of rows) {
    if (!inWindow(r.created_at, w)) continue;
    out.total++;
    const status = r.status ?? 'unknown';
    count(out.byStatus, status);
    if (status === 'active' || status === 'completed' || status === 'confirmed') out.confirmed++;
    count(out.byService, r.service ?? '(none)');
    const city = r.city_slug ?? normaliseCityText(r.city, cities, zones);
    if (city) count(out.byCity, city);
    else out.unmappedCity++;
  }
  return out;
}

export function supportCounts(rows: SupportRow[], w: Window): SupportCounts {
  const out: SupportCounts = { conversations: 0, escalated: 0, leadCaptured: 0, byCity: {} };
  for (const r of rows) {
    if (!inWindow(r.started_at, w)) continue;
    out.conversations++;
    if (r.escalated) out.escalated++;
    if (r.outcome === 'lead_captured') out.leadCaptured++;
    if (r.city_slug) count(out.byCity, r.city_slug);
  }
  return out;
}

export function leadCounts(rows: LeadRow[], w: Window, now: Date): LeadCounts {
  const out: LeadCounts = { total: 0, byCity: {}, byService: {}, byStatus: {}, staleNew: 0 };
  const staleBefore = now.getTime() - 24 * 3600000;
  for (const r of rows) {
    if (r.status === 'new' && Date.parse(r.created_at) < staleBefore) out.staleNew++;
    if (!inWindow(r.created_at, w)) continue;
    out.total++;
    count(out.byStatus, r.status ?? 'unknown');
    if (r.city_slug) count(out.byCity, r.city_slug);
    if (r.service_slug) count(out.byService, r.service_slug);
  }
  return out;
}

export interface SupabaseSnapshotInput {
  generatedAt: string;
  now: Date;
  windows: Record<WindowKey, Window>;
  signups: Array<{ created_at: string }>;
  bookings: BookingRow[];
  support: SupportRow[];
  leads: LeadRow[] | null;
  cities: City[];
  zones: Zone[];
  errors: string[];
}

export function buildSupabaseSnapshot(i: SupabaseSnapshotInput): SupabaseSnapshot {
  const per = <T>(f: (w: Window) => T): Record<WindowKey, T> => ({ current: f(i.windows.current), previous: f(i.windows.previous) });
  const leads = i.leads;
  return {
    kind: 'supabase',
    version: 1,
    generatedAt: i.generatedAt,
    windows: i.windows,
    signups: per((w) => i.signups.filter((s) => inWindow(s.created_at, w)).length),
    bookings: per((w) => bookingCounts(i.bookings, w, i.cities, i.zones)),
    support: per((w) => supportCounts(i.support, w)),
    leads: leads ? per((w) => leadCounts(leads, w, i.now)) : null,
    errors: i.errors,
  };
}
