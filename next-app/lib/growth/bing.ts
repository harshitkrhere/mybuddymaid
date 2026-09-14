// lib/growth/bing.ts — Bing Webmaster Tools through its API-key JSON endpoints.
//
// Bing is the one engine with a first-party "pages in index" number (GetCrawlStats.InIndex),
// so it is the cross-check for the Google census. Responses wrap in {"d": …} and dates arrive
// as "/Date(1316156400000-0700)/". IndexNow already reaches Bing; SubmitFeed is the
// belt-and-braces for the sitemap index itself after a batch release.
import type { FetchLike } from './google-auth';
import type { Window, WindowKey } from './windows';
import { inWindow } from './windows';
import type { BingCrawlLatest, BingSnapshot } from './types';

export const BING_API = 'https://ssl.bing.com/webmaster/api.svc/json';

export function bingUrl(method: string, apiKey: string, params: Record<string, string> = {}): string {
  const u = new URL(`${BING_API}/${method}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set('apikey', apiKey);
  return u.toString();
}

export function parseBingDate(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const m = s.match(/\/Date\((-?\d+)/);
  if (m) return new Date(Number(m[1])).toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

export function unwrap(json: unknown): Array<Record<string, unknown>> {
  const d = (json as { d?: unknown } | null)?.d;
  return Array.isArray(d) ? (d as Array<Record<string, unknown>>) : [];
}

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0) || 0);

export type CrawlStatRow = BingCrawlLatest;

export function parseCrawlStats(json: unknown): CrawlStatRow[] {
  return unwrap(json)
    .map((r) => ({
      date: parseBingDate(r.Date) ?? '',
      inIndex: num(r.InIndex),
      crawledPages: num(r.CrawledPages),
      code4xx: num(r.Code4xx),
      code5xx: num(r.Code5xx),
      crawlErrors: num(r.CrawlErrors),
      blockedByRobots: num(r.BlockedByRobotsTxt),
    }))
    .filter((r) => r.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function latestCrawl(rows: CrawlStatRow[]): BingCrawlLatest | null {
  return rows.length ? rows[rows.length - 1] : null;
}

export function parseTraffic(json: unknown): Array<{ date: string; clicks: number; impressions: number }> {
  return unwrap(json)
    .map((r) => ({ date: parseBingDate(r.Date) ?? '', clicks: num(r.Clicks), impressions: num(r.Impressions) }))
    .filter((r) => r.date);
}

export function sumTraffic(rows: Array<{ date: string; clicks: number; impressions: number }>, w: Window): { clicks: number; impressions: number } | null {
  const inside = rows.filter((r) => inWindow(r.date, w));
  if (!inside.length) return null;
  return { clicks: inside.reduce((s, r) => s + r.clicks, 0), impressions: inside.reduce((s, r) => s + r.impressions, 0) };
}

export function parseQueryStats(json: unknown): BingSnapshot['queries'] {
  return unwrap(json)
    .map((r) => ({
      query: String(r.Query ?? ''),
      clicks: num(r.Clicks),
      impressions: num(r.Impressions),
      avgImpressionPosition: num(r.AvgImpressionPosition),
      avgClickPosition: num(r.AvgClickPosition),
    }))
    .filter((r) => r.query)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 200);
}

export function parseFeeds(json: unknown): BingSnapshot['feeds'] {
  return unwrap(json).map((r) => ({
    url: String(r.Url ?? ''),
    status: String(r.Status ?? ''),
    urlCount: num(r.UrlCount),
    lastCrawled: parseBingDate(r.LastCrawled),
    submitted: parseBingDate(r.Submitted),
  }));
}

/** The site URL Bing knows the property by, from GetUserSites, matched on host. */
export function pickSite(json: unknown, host: string): string | null {
  for (const s of unwrap(json)) {
    const url = String(s.Url ?? '');
    try {
      if (new URL(url).host.replace(/^www\./, '') === host.replace(/^www\./, '')) return url;
    } catch {
      // not a URL
    }
  }
  return null;
}

export async function bingGet(fetchImpl: FetchLike, method: string, apiKey: string, params: Record<string, string> = {}): Promise<unknown> {
  const res = await fetchImpl(bingUrl(method, apiKey, params));
  if (!res.ok) throw new Error(`Bing ${method} failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

export async function submitFeed(fetchImpl: FetchLike, apiKey: string, siteUrl: string, feedUrl: string): Promise<void> {
  const res = await fetchImpl(bingUrl('SubmitFeed', apiKey), {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ siteUrl, feedUrl }),
  });
  if (!res.ok) throw new Error(`Bing SubmitFeed failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
}

export interface BingSnapshotInput {
  siteUrl: string;
  generatedAt: string;
  windows: Record<WindowKey, Window>;
  crawl: CrawlStatRow[];
  traffic: Array<{ date: string; clicks: number; impressions: number }>;
  queries: BingSnapshot['queries'];
  feeds: BingSnapshot['feeds'];
  errors: string[];
}

export function buildBingSnapshot(i: BingSnapshotInput): BingSnapshot {
  return {
    kind: 'bing',
    version: 1,
    generatedAt: i.generatedAt,
    siteUrl: i.siteUrl,
    windows: i.windows,
    crawl: {
      latest: latestCrawl(i.crawl),
      series: i.crawl.slice(-14).map((r) => ({ date: r.date, inIndex: r.inIndex, crawledPages: r.crawledPages, code5xx: r.code5xx })),
    },
    traffic: { current: sumTraffic(i.traffic, i.windows.current), previous: sumTraffic(i.traffic, i.windows.previous) },
    queries: i.queries,
    feeds: i.feeds,
    errors: i.errors,
  };
}
