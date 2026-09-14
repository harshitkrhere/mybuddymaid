// lib/growth/inspection.ts — the URL Inspection census, the only honest "indexed" count.
//
// The Sitemaps API's `indexed` field is deprecated and the Coverage report has no API, so
// each day a slice of the indexable estate is inspected (quota: 2,000 a day, 600 a minute
// per property) and its verdict recorded in a ledger. Oldest-first ordering makes a missed
// day self-healing and the minimum age makes a manual re-run harmless. Only PASS counts as
// indexed; coverageState is tabulated verbatim rather than interpreted.
import { classify } from './classify';
import type { FetchLike } from './google-auth';
import { bearer } from './google-auth';
import type { CensusCounts, InspectionLedger, InspectionSummary, LedgerEntry, Verdict } from './types';

export const INSPECT_ENDPOINT = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';
export const FRESH_DAYS = 8;
export const DEFAULT_DAILY_CAP = 400;
export const DEFAULT_MIN_AGE_DAYS = 5;

const VERDICTS: readonly Verdict[] = ['PASS', 'PARTIAL', 'FAIL', 'NEUTRAL', 'VERDICT_UNSPECIFIED'];

export function emptyLedger(site: string): InspectionLedger {
  return { kind: 'inspection-ledger', version: 1, site, updatedAt: '', entries: {} };
}

/** The paths to inspect today: never-inspected first, then the oldest, at most `cap`. */
export function planSlice(estate: string[], ledger: InspectionLedger, opts: { cap: number; minAgeDays: number; now: Date }): string[] {
  const cutoff = opts.now.getTime() - opts.minAgeDays * 86400000;
  const at = (p: string) => {
    const e = ledger.entries[p];
    return e ? Date.parse(e.inspectedAt) : 0;
  };
  return estate
    .filter((p) => at(p) <= cutoff)
    .sort((a, b) => at(a) - at(b) || a.localeCompare(b))
    .slice(0, Math.max(0, opts.cap));
}

export interface InspectionResult {
  verdict: Verdict;
  coverageState: string;
  indexingState: string;
  robotsTxtState: string;
  pageFetchState: string;
  lastCrawlTime: string | null;
  googleCanonical: string | null;
  userCanonical: string | null;
  inSitemap: boolean;
}

export function parseInspection(json: unknown): InspectionResult {
  const r = ((json as { inspectionResult?: { indexStatusResult?: Record<string, unknown> } } | null)?.inspectionResult?.indexStatusResult ?? {}) as Record<
    string,
    unknown
  >;
  const s = (k: string) => (typeof r[k] === 'string' ? (r[k] as string) : '');
  const verdict = (VERDICTS.includes(s('verdict') as Verdict) ? s('verdict') : 'VERDICT_UNSPECIFIED') as Verdict;
  return {
    verdict,
    coverageState: s('coverageState'),
    indexingState: s('indexingState'),
    robotsTxtState: s('robotsTxtState'),
    pageFetchState: s('pageFetchState'),
    lastCrawlTime: s('lastCrawlTime') || null,
    googleCanonical: s('googleCanonical') || null,
    userCanonical: s('userCanonical') || null,
    inSitemap: Array.isArray(r.sitemap) && r.sitemap.length > 0,
  };
}

/** Writes today's results over the ledger and marks entries that left the estate as retired. */
export function mergeLedger(ledger: InspectionLedger, results: Array<{ path: string; result: InspectionResult }>, estate: string[], now: Date): InspectionLedger {
  const at = now.toISOString();
  const entries: Record<string, LedgerEntry> = { ...ledger.entries };
  for (const { path, result } of results) {
    const prev = entries[path];
    const c = classify(path);
    const entry: LedgerEntry = { path, pageType: c.type, city: c.city, inspectedAt: at, ...result };
    if (prev && prev.verdict !== result.verdict) {
      entry.previousVerdict = prev.verdict;
      entry.previousVerdictAt = prev.inspectedAt;
    } else if (prev?.previousVerdict) {
      entry.previousVerdict = prev.previousVerdict;
      entry.previousVerdictAt = prev.previousVerdictAt;
    }
    entries[path] = entry;
  }
  const inEstate = new Set(estate);
  for (const [p, e] of Object.entries(entries)) {
    const retired = !inEstate.has(p);
    if (retired && !e.retired) entries[p] = { ...e, retired: true };
    else if (!retired && e.retired) {
      const back: LedgerEntry = { ...e };
      delete back.retired;
      entries[p] = back;
    }
  }
  return { ...ledger, updatedAt: at, entries };
}

export function summarizeLedger(ledger: InspectionLedger, estate: string[], now: Date): InspectionSummary {
  const freshCutoff = now.getTime() - FRESH_DAYS * 86400000;
  const transitionCutoff = now.getTime() - 7 * 86400000;
  const byVerdict: Record<string, number> = {};
  const byCoverageState: Record<string, number> = {};
  const byCity: Record<string, CensusCounts> = {};
  const byPageType: Record<string, CensusCounts> = {};
  const bucket = (m: Record<string, CensusCounts>, key: string) => (m[key] ??= { estate: 0, pass: 0, other: 0, fresh: 0 });
  const inEstate = new Set(estate);
  for (const path of estate) {
    const c = classify(path);
    bucket(byCity, c.city || 'national').estate++;
    bucket(byPageType, c.type).estate++;
  }
  let inspected = 0;
  let fresh = 0;
  let retired = 0;
  const transitions: InspectionSummary['transitions'] = [];
  for (const e of Object.values(ledger.entries)) {
    if (e.retired || !inEstate.has(e.path)) {
      retired++;
      continue;
    }
    inspected++;
    const t = Date.parse(e.inspectedAt);
    const isFresh = t >= freshCutoff;
    if (isFresh) fresh++;
    byVerdict[e.verdict] = (byVerdict[e.verdict] ?? 0) + 1;
    if (e.coverageState) byCoverageState[e.coverageState] = (byCoverageState[e.coverageState] ?? 0) + 1;
    const cc = bucket(byCity, e.city || 'national');
    const tc = bucket(byPageType, e.pageType);
    if (e.verdict === 'PASS') {
      cc.pass++;
      tc.pass++;
    } else {
      cc.other++;
      tc.other++;
    }
    if (isFresh) cc.fresh++;
    if (e.previousVerdict === 'PASS' && e.verdict !== 'PASS' && t >= transitionCutoff) {
      transitions.push({ path: e.path, from: 'PASS', to: e.verdict, at: e.inspectedAt });
    }
  }
  return {
    asOf: now.toISOString(),
    estate: estate.length,
    inspected,
    fresh,
    stale: inspected - fresh,
    retired,
    byVerdict,
    byCoverageState,
    byCity,
    byPageType,
    transitions: transitions.sort((a, b) => a.path.localeCompare(b.path)),
  };
}

export interface InspectClient {
  site: string; // sc-domain:mybuddymaid.in
  siteUrl: string; // https://mybuddymaid.in
  token: string;
  fetchImpl: FetchLike;
}

export interface InspectOptions {
  concurrency?: number;
  gapMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onProgress?: (done: number, total: number) => void;
}

export interface InspectOutcome {
  results: Array<{ path: string; result: InspectionResult }>;
  failures: Array<{ path: string; status: number }>;
  stoppedEarly: string | null; // set when the quota or the permission refused us; partial results are kept
}

/** Inspects `paths` with a small worker pool. 429/403/5xx back off and retry; other errors are recorded per path. */
export async function inspectPaths(client: InspectClient, paths: string[], opts: InspectOptions = {}): Promise<InspectOutcome> {
  const concurrency = opts.concurrency ?? 3;
  const gap = opts.gapMs ?? 150;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const results: InspectOutcome['results'] = [];
  const failures: InspectOutcome['failures'] = [];
  let next = 0;
  let stopped: string | null = null;

  async function worker() {
    while (next < paths.length && !stopped) {
      const path = paths[next++];
      for (let attempt = 0; ; attempt++) {
        const res = await client.fetchImpl(INSPECT_ENDPOINT, {
          method: 'POST',
          headers: bearer(client.token),
          body: JSON.stringify({ inspectionUrl: `${client.siteUrl}${path}`, siteUrl: client.site }),
        });
        if (res.ok) {
          results.push({ path, result: parseInspection(await res.json()) });
          break;
        }
        const text = (await res.text()).slice(0, 200);
        const retryable = res.status === 429 || res.status === 403 || res.status >= 500;
        if (retryable && attempt < 3) {
          await sleep(2000 * 2 ** attempt);
          continue;
        }
        if (retryable) {
          stopped = `HTTP ${res.status} on ${path}: ${text}`;
        } else {
          failures.push({ path, status: res.status });
        }
        break;
      }
      opts.onProgress?.(results.length + failures.length, paths.length);
      await sleep(gap);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, paths.length)) }, worker));
  return { results, failures, stoppedEarly: stopped };
}
