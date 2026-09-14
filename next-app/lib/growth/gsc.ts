// lib/growth/gsc.ts — Search Console through the Search Analytics and Sitemaps APIs.
//
// Builders and aggregators are pure and the network is injected, so the tests run on
// fixtures. Two things the reader should know: data is final about three days after the
// fact (lib/growth/windows.ts), and a query with no row is reported as null — "no impressions
// recorded or anonymised" — never as 0, because a zero would be a fabricated measurement.
import type { FetchLike } from './google-auth';
import { bearer } from './google-auth';
import { cityBucket, classify } from './classify';
import type { KeywordRow } from './keywords';
import type { Window, WindowKey } from './windows';
import type { ExpansionRow, GscSnapshot, KeywordStat, Metrics, SitemapHealth, TrackedKeyword } from './types';

export const SA_ROW_LIMIT = 25000;
export const GSC_API = 'https://searchconsole.googleapis.com/webmasters/v3';

export interface GscClient {
  site: string; // e.g. sc-domain:mybuddymaid.in
  token: string;
  fetchImpl: FetchLike;
}

export interface SaRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SaFilter {
  dimension: 'page' | 'query' | 'country' | 'device';
  operator: 'equals' | 'contains' | 'notContains' | 'notEquals' | 'includingRegex' | 'excludingRegex';
  expression: string;
}

export interface SaRequest {
  startDate: string;
  endDate: string;
  dimensions: string[];
  dimensionFilterGroups?: Array<{ filters: SaFilter[] }>;
  aggregationType?: 'auto' | 'byPage' | 'byProperty';
  rowLimit: number;
  startRow: number;
  type: 'web';
  dataState: 'final';
}

export function saBody(w: Window, dimensions: string[], opts: { filters?: SaFilter[]; aggregationType?: SaRequest['aggregationType'] } = {}): SaRequest {
  return {
    startDate: w.start,
    endDate: w.end,
    dimensions,
    ...(opts.filters?.length ? { dimensionFilterGroups: [{ filters: opts.filters }] } : {}),
    ...(opts.aggregationType ? { aggregationType: opts.aggregationType } : {}),
    rowLimit: SA_ROW_LIMIT,
    startRow: 0,
    type: 'web',
    dataState: 'final',
  };
}

/** Every row for a request, following the 25,000-row pages until a short page arrives. */
export async function queryAll(client: GscClient, body: SaRequest): Promise<SaRow[]> {
  const out: SaRow[] = [];
  let startRow = body.startRow;
  for (;;) {
    const res = await client.fetchImpl(`${GSC_API}/sites/${encodeURIComponent(client.site)}/searchAnalytics/query`, {
      method: 'POST',
      headers: bearer(client.token),
      body: JSON.stringify({ ...body, startRow }),
    });
    if (!res.ok) throw new Error(`GSC query failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
    const batch = ((await res.json()) as { rows?: SaRow[] }).rows ?? [];
    out.push(...batch);
    if (batch.length < body.rowLimit) return out;
    startRow += batch.length;
  }
}

export async function listSitemaps(client: GscClient, sitemapIndex: string): Promise<unknown> {
  const res = await client.fetchImpl(`${GSC_API}/sites/${encodeURIComponent(client.site)}/sitemaps?sitemapIndex=${encodeURIComponent(sitemapIndex)}`, {
    headers: bearer(client.token),
  });
  if (!res.ok) throw new Error(`GSC sitemaps list failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/** RE2 pattern matching every URL that belongs to one city: its hubs and its service × city page. */
export function cityPagePattern(city: string, siteUrl: string): string {
  const host = siteUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `^${host}/(${city}(/|$)|services/[a-z-]+/${city}(/|$))`;
}

export function weightedPosition(items: Array<{ position: number; impressions: number }>): number | null {
  let imp = 0;
  let sum = 0;
  for (const i of items) {
    imp += i.impressions;
    sum += i.position * i.impressions;
  }
  return imp > 0 ? Math.round((sum / imp) * 10) / 10 : null;
}

interface Acc {
  clicks: number;
  impressions: number;
  posImp: number;
  pages: Set<string>;
}
const acc = (): Acc => ({ clicks: 0, impressions: 0, posImp: 0, pages: new Set() });
const finish = (m: Record<string, Acc>): Record<string, Metrics> =>
  Object.fromEntries(
    Object.entries(m).map(([k, a]) => [
      k,
      { clicks: a.clicks, impressions: a.impressions, position: a.impressions ? Math.round((a.posImp / a.impressions) * 10) / 10 : null, pages: a.pages.size },
    ]),
  );

/** rows carry dimensions [page]. */
export function aggregateByPage(rows: SaRow[]): { byCity: Record<string, Metrics>; byPageType: Record<string, Metrics>; hosts: Record<string, number> } {
  const byCity: Record<string, Acc> = {};
  const byType: Record<string, Acc> = {};
  const hosts: Record<string, number> = {};
  const add = (m: Record<string, Acc>, key: string, r: SaRow) => {
    const a = (m[key] ??= acc());
    a.clicks += r.clicks;
    a.impressions += r.impressions;
    a.posImp += r.position * r.impressions;
    a.pages.add(r.keys[0]);
  };
  for (const r of rows) {
    const c = classify(r.keys[0]);
    add(byCity, cityBucket(c), r);
    add(byType, c.type, r);
    try {
      const h = new URL(r.keys[0]).host;
      hosts[h] = (hosts[h] ?? 0) + r.impressions;
    } catch {
      // a bare path: no host to record
    }
  }
  return { byCity: finish(byCity), byPageType: finish(byType), hosts };
}

/** rows carry dimensions [query, page]; the join is on the lowercased query text. */
export function joinKeywords(tracked: KeywordRow[], rows: SaRow[]): Map<string, KeywordStat> {
  const byQuery = new Map<string, SaRow[]>();
  for (const r of rows) {
    const q = r.keys[0].toLowerCase();
    const arr = byQuery.get(q) ?? [];
    arr.push(r);
    byQuery.set(q, arr);
  }
  const out = new Map<string, KeywordStat>();
  for (const k of tracked) {
    const rs = byQuery.get(k.keyword);
    if (!rs?.length) continue;
    const top = rs.reduce((a, b) => (b.impressions > a.impressions ? b : a));
    out.set(k.keyword, {
      impressions: rs.reduce((s, r) => s + r.impressions, 0),
      clicks: rs.reduce((s, r) => s + r.clicks, 0),
      position: weightedPosition(rs) ?? top.position,
      topPage: top.keys[1],
      onTarget: classify(top.keys[1]).path === k.targetUrl,
    });
  }
  return out;
}

export function trackedKeywords(tracked: KeywordRow[], cur: Map<string, KeywordStat>, prev: Map<string, KeywordStat>): TrackedKeyword[] {
  return tracked.map((k) => ({
    city: k.city,
    keyword: k.keyword,
    targetUrl: k.targetUrl,
    priority: k.priority,
    current: cur.get(k.keyword) ?? null,
    previous: prev.get(k.keyword) ?? null,
  }));
}

/** The Sitemaps API list response for one sitemap index. `indexed` is deprecated upstream and ignored. */
export function parseSitemapsList(json: unknown, siteUrl: string): SitemapHealth[] {
  const list = ((json as { sitemap?: unknown[] } | null)?.sitemap ?? []) as Array<Record<string, unknown>>;
  return list.map((s) => {
    const contents = (s.contents as Array<{ submitted?: string | number }> | undefined) ?? [];
    const submitted = contents.reduce<number | null>((sum, c) => (c.submitted == null ? sum : (sum ?? 0) + Number(c.submitted)), null);
    const p = String(s.path ?? '');
    return {
      path: p.startsWith(siteUrl) ? p.slice(siteUrl.length) : p,
      submitted,
      lastDownloaded: typeof s.lastDownloaded === 'string' ? s.lastDownloaded : null,
      isPending: Boolean(s.isPending),
      errors: Number(s.errors ?? 0),
      warnings: Number(s.warnings ?? 0),
    };
  });
}

export interface GscSnapshotInput {
  site: string;
  generatedAt: string;
  windows: Record<WindowKey, Window>;
  pageRows: Record<WindowKey, SaRow[]>;
  keywordRows: Record<WindowKey, SaRow[]>;
  tracked: KeywordRow[];
  sitemaps: SitemapHealth[] | null;
  expansion: ExpansionRow[];
  errors: string[];
}

export function buildGscSnapshot(i: GscSnapshotInput): GscSnapshot {
  const cur = aggregateByPage(i.pageRows.current);
  const prev = aggregateByPage(i.pageRows.previous);
  return {
    kind: 'gsc',
    version: 1,
    generatedAt: i.generatedAt,
    site: i.site,
    windows: i.windows,
    byCity: { current: cur.byCity, previous: prev.byCity },
    byPageType: { current: cur.byPageType, previous: prev.byPageType },
    hostsByImpressions: cur.hosts,
    topPages: [...i.pageRows.current]
      .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
      .slice(0, 50)
      .map((r) => ({ path: classify(r.keys[0]).path, clicks: r.clicks, impressions: r.impressions })),
    keywords: trackedKeywords(i.tracked, joinKeywords(i.tracked, i.keywordRows.current), joinKeywords(i.tracked, i.keywordRows.previous)),
    sitemaps: i.sitemaps,
    expansion: i.expansion,
    errors: i.errors,
  };
}
