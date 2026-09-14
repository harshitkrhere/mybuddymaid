// lib/growth/windows.ts — the two weekly windows every growth snapshot carries.
//
// Search Console data is final about three days after the fact, so the default window ends
// three days before the run and the previous window is the seven days before that. GA4,
// Bing and the Supabase counts use the same end date so the columns of one report line up.
export interface Window {
  start: string; // ISO date, inclusive
  end: string; // ISO date, inclusive
}
export type WindowKey = 'current' | 'previous';
export const WINDOW_KEYS: WindowKey[] = ['current', 'previous'];

export const DEFAULT_LAG_DAYS = 3;

export function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

export function defaultEnd(now: Date = new Date(), lagDays = DEFAULT_LAG_DAYS): string {
  return addDays(iso(now), -lagDays);
}

export function weeklyWindows(end: string): Record<WindowKey, Window> {
  if (!isIsoDate(end)) throw new Error(`not an ISO date: ${end}`);
  return {
    current: { start: addDays(end, -6), end },
    previous: { start: addDays(end, -13), end: addDays(end, -7) },
  };
}

/** True when an ISO timestamp or date falls inside the window (inclusive, by UTC day). */
export function inWindow(ts: string, w: Window): boolean {
  const day = ts.slice(0, 10);
  return day >= w.start && day <= w.end;
}
