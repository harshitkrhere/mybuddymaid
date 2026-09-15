// lib/seo-engine/entity-match.ts — how a society a customer typed becomes a signal on a Phase 5
// entity, and how the operator worksheet is ordered.
//
// Since 2026-09-15 every booking from the app and every call-back request carries a locality
// slug and, optionally, the society or building the customer typed. That text is the first
// real demand signal the entity list has ever had (the OSM import gives names and positions,
// nothing about who asks for help there). Matching is deliberately conservative: a society
// text matches an entity in the SAME locality only, on the whole normalised name (or alt name)
// or when one contains the other unambiguously. A wrong match would attribute demand — and a
// `serve? = y` prefill — to the wrong society, which is a fabricated fact.
//
// Pure functions, tested in entity-match.test.ts; scripts/seo/import-entities.ts does the I/O.
import type { Entity } from '@/data/seo/types';

/** Words that say "housing" rather than "which one": dropped before comparing names. */
const GENERIC_WORDS = new Set(['society', 'societies', 'apartment', 'apartments', 'apts', 'apt', 'chs', 'chsl', 'co', 'op', 'coop', 'cooperative', 'housing', 'ltd', 'limited', 'the', 'welfare', 'association', 'residents', 'resident', 'complex', 'and', 'of']);

/** A comparable key: lower-case, punctuation gone, generic housing words gone, single spaces. */
export function societyKey(text: string | null | undefined): string {
  return (text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !GENERIC_WORDS.has(w))
    .join(' ')
    .trim();
}

export interface Candidate {
  slug: string;
  name: string;
  altNames?: string[];
}

/**
 * The one candidate the text names, or null. Exact key match on the name or an alt name wins;
 * otherwise a containment match ("Mahagun Moderne" typed as "Mahagun Moderne Tower 4") when
 * exactly one candidate contains, or is contained in, the text and the shared key is at least
 * six characters. Two plausible candidates is no match: the operator decides, not a guess.
 */
export function matchEntity<T extends Candidate>(text: string | null | undefined, candidates: readonly T[]): T | null {
  const key = societyKey(text);
  if (!key) return null;
  const keysOf = (c: Candidate) => [c.name, ...(c.altNames ?? [])].map(societyKey).filter(Boolean);
  const exact = candidates.filter((c) => keysOf(c).includes(key));
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  const partial = candidates.filter((c) => keysOf(c).some((k) => k.length >= 6 && key.length >= 6 && (key.includes(k) || k.includes(key))));
  return partial.length === 1 ? partial[0] : null;
}

/** A booking or call-back row as the database returns it (counts only, never a person). */
export interface DemandRow {
  city_slug: string | null;
  locality_slug: string | null;
  society: string | null;
  entity_slug: string | null;
  created_at: string;
}

export interface PlacementRow {
  city: string;
  locality: string;
  /** The entity slug the app or the form attributed the row to, when it came from an entity page. */
  entity_slug: string | null;
  /** What customers typed, as typed the first time; the key groups spelling variants. */
  society: string | null;
  societyKey: string;
  bookings: number;
  leads: number;
  /** Last activity, YYYY-MM-DD. */
  last: string;
}

/** One row per (city, locality, society) across bookings and call-back requests, most active first. */
export function aggregatePlacements(bookings: readonly DemandRow[], leads: readonly DemandRow[]): PlacementRow[] {
  const out = new Map<string, PlacementRow>();
  const take = (r: DemandRow, kind: 'bookings' | 'leads') => {
    if (!r.city_slug || !r.locality_slug) return;
    const societyKeyOf = r.entity_slug ? `entity:${r.entity_slug}` : societyKey(r.society);
    if (!societyKeyOf) return;
    const id = `${r.city_slug}/${r.locality_slug}/${societyKeyOf}`;
    const day = r.created_at.slice(0, 10);
    const row = out.get(id) ?? { city: r.city_slug, locality: r.locality_slug, entity_slug: r.entity_slug, society: r.society?.trim() || null, societyKey: societyKeyOf, bookings: 0, leads: 0, last: day };
    row[kind]++;
    if (day > row.last) row.last = day;
    if (!row.society && r.society?.trim()) row.society = r.society.trim();
    out.set(id, row);
  };
  for (const b of bookings) take(b, 'bookings');
  for (const l of leads) take(l, 'leads');
  return [...out.values()].sort((a, b) => b.bookings - a.bookings || b.leads - a.leads || b.last.localeCompare(a.last));
}

export interface Signal {
  bookings: number;
  leads: number;
  last: string;
  /** The society text customers used, for the operator's eyes. */
  society: string | null;
}

/** Each placement row attached to the entity it names, or listed as unmatched for the worksheet. */
export function attachSignals(rows: readonly PlacementRow[], entities: readonly Entity[]): { matched: Map<string, Signal>; unmatched: PlacementRow[] } {
  const matched = new Map<string, Signal>();
  const unmatched: PlacementRow[] = [];
  const byLocality = new Map<string, Entity[]>();
  for (const e of entities) {
    const k = `${e.city}/${e.locality}`;
    byLocality.set(k, [...(byLocality.get(k) ?? []), e]);
  }
  const merge = (key: string, r: PlacementRow) => {
    const prev = matched.get(key) ?? { bookings: 0, leads: 0, last: r.last, society: r.society };
    matched.set(key, { bookings: prev.bookings + r.bookings, leads: prev.leads + r.leads, last: r.last > prev.last ? r.last : prev.last, society: prev.society ?? r.society });
  };
  for (const r of rows) {
    const local = byLocality.get(`${r.city}/${r.locality}`) ?? [];
    const hit = r.entity_slug ? (local.find((e) => e.slug === r.entity_slug) ?? null) : matchEntity(r.society, local);
    if (hit) merge(`${hit.city}/${hit.locality}/${hit.slug}`, r);
    else unmatched.push(r);
  }
  return { matched, unmatched };
}

/** "2 bookings · 1 request · last 2026-09-15", or '' when there is no signal. */
export function signalLabel(s: Signal | undefined): string {
  if (!s || (!s.bookings && !s.leads)) return '';
  const parts: string[] = [];
  if (s.bookings) parts.push(`${s.bookings} booking${s.bookings === 1 ? '' : 's'}`);
  if (s.leads) parts.push(`${s.leads} request${s.leads === 1 ? '' : 's'}`);
  parts.push(`last ${s.last}`);
  return parts.join(' · ');
}

export interface PriorityInput {
  signal?: Signal;
  tier: 1 | 2;
  heroLocality: boolean;
}

/**
 * Worksheet order: societies customers already named first (bookings before requests), then
 * Tier-1 cities before Tier-2, then the hero localities of each city before the rest. Lower
 * sorts first.
 */
export function worksheetRank(p: PriorityInput): number {
  const bookings = Math.min(p.signal?.bookings ?? 0, 999);
  const leads = Math.min(p.signal?.leads ?? 0, 999);
  let rank = 0;
  // any booking beats any number of requests; more of either sorts earlier
  if (bookings) rank -= 1_000_000_000 + bookings * 10_000_000;
  if (leads) rank -= 1_000 + leads * 1_000;
  rank += p.tier === 1 ? 0 : 10;
  rank += p.heroLocality ? 0 : 1;
  return rank;
}
