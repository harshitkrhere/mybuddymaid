// lib/growth/report.ts — the weekly growth report and the baseline, composed from the
// snapshots the fetchers wrote. Pure: every number comes from an input, a missing source
// renders as "n/a" with its reason, and nothing is ever estimated. The alert thresholds
// live here too, so a threshold change is a tested code change rather than a workflow edit.
import type { City } from '@/data/seo';
import { CITIES_BY_TIER, tierOf } from './classify';
import { renderExpansionTable } from './expansion';
import type { Alert, BingSnapshot, CityRow, Ga4Snapshot, GscSnapshot, InspectionSummary, SupabaseSnapshot, WeeklySummary, Window, WindowKey } from './types';

export interface ReportInputs {
  asOf: string; // window end (ISO date)
  generatedAt: string;
  windows: Record<WindowKey, Window>;
  cities: City[];
  estateByCity: Record<string, number>; // indexable pages per city slug, plus 'national'
  gsc: GscSnapshot | null;
  ga4: Ga4Snapshot | null;
  bing: BingSnapshot | null;
  supabase: SupabaseSnapshot | null;
  census: InspectionSummary | null;
  previous: WeeklySummary | null; // last week's summary, for census deltas
  baseline: WeeklySummary | null;
  notes: string[]; // data-availability caveats supplied by the script
}

export interface ComposedReport {
  markdown: string;
  alerts: Alert[];
  summary: WeeklySummary;
}

// ─── Formatting ─────────────────────────────────────────────────────────────────────────────

export function fmtDelta(cur: number | null | undefined, prev: number | null | undefined): string {
  if (cur == null || prev == null) return '';
  if (prev === 0) return cur > 0 ? ' (new)' : '';
  const pct = Math.round(((cur - prev) / prev) * 100);
  return ` (${pct > 0 ? '+' : ''}${pct}%)`;
}

const NA = 'n/a';
const n = (v: number | null | undefined, decimals = 0): string => (v == null ? NA : decimals ? v.toFixed(decimals) : String(Math.round(v)));
const cell = (cur: number | null | undefined, prev: number | null | undefined, decimals = 0) => (cur == null ? NA : `${n(cur, decimals)}${fmtDelta(cur, prev)}`);
const sum = (m: Record<string, number> | undefined) => (m ? Object.values(m).reduce((s, v) => s + v, 0) : 0);

// ─── Per-city rows ──────────────────────────────────────────────────────────────────────────

interface Pair {
  cur: number | null;
  prev: number | null;
}
const pair = (cur: number | null | undefined, prev: number | null | undefined): Pair => ({ cur: cur ?? null, prev: prev ?? null });
/** A count from a source that reported: a city absent from its map had zero, which is a measurement, not a gap. */
const counted = (present: unknown, cur: number | undefined, prev: number | undefined): Pair => (present ? { cur: cur ?? 0, prev: prev ?? 0 } : { cur: null, prev: null });

function cityMetrics(i: ReportInputs, city: string): Record<string, Pair> {
  const g = i.gsc;
  const gm = (k: WindowKey) => g?.byCity[k][city];
  const kws = g?.keywords.filter((k) => k.city === city) ?? [];
  const kwPos = (k: 'current' | 'previous') => {
    const seen = kws.map((x) => x[k]).filter((s): s is NonNullable<typeof s> => s != null);
    return seen.length ? seen.reduce((s, x) => s + x.position, 0) / seen.length : null;
  };
  const geo = (k: WindowKey) => i.ga4?.organicGeo[k]?.byCity[city]?.sessions;
  const cta = (k: WindowKey, ev: 'whatsapp_click' | 'call_click' | 'app_click') => i.ga4?.cta[k]?.byCity[city]?.[ev];
  const sb = i.supabase;
  return {
    indexable: pair(i.estateByCity[city] ?? 0, null),
    indexedPass: pair(i.census?.byCity[city]?.pass ?? null, i.previous?.cities[city]?.indexedPass ?? null),
    impressions: counted(g, gm('current')?.impressions, gm('previous')?.impressions),
    clicks: counted(g, gm('current')?.clicks, gm('previous')?.clicks),
    position: pair(gm('current')?.position, gm('previous')?.position),
    kwPosition: pair(kwPos('current'), kwPos('previous')),
    kwTracked: pair(kws.length || null, null),
    kwSeen: pair(kws.filter((k) => k.current).length, kws.filter((k) => k.previous).length),
    organicSessions: counted(i.ga4?.organicGeo.current, geo('current'), geo('previous')),
    whatsapp: counted(i.ga4?.cta.current, cta('current', 'whatsapp_click'), cta('previous', 'whatsapp_click')),
    call: counted(i.ga4?.cta.current, cta('current', 'call_click'), cta('previous', 'call_click')),
    app: counted(i.ga4?.cta.current, cta('current', 'app_click'), cta('previous', 'app_click')),
    chats: counted(sb, sb?.support.current.byCity[city], sb?.support.previous.byCity[city]),
    leads: counted(sb?.leads, sb?.leads?.current.byCity[city], sb?.leads?.previous.byCity[city]),
    bookings: counted(sb, sb?.bookings.current.byCity[city], sb?.bookings.previous.byCity[city]),
  };
}

/** A search position is a rank: show the absolute move (lower is better), not a percentage. */
const cellPos = (cur: number | null | undefined, prev: number | null | undefined) => {
  if (cur == null) return NA;
  if (prev == null) return cur.toFixed(1);
  const d = cur - prev;
  return `${cur.toFixed(1)} (${d > 0 ? '+' : ''}${d.toFixed(1)})`;
};

// ─── Site-wide ──────────────────────────────────────────────────────────────────────────────

function siteMetrics(i: ReportInputs): Record<string, Pair> {
  const g = i.gsc;
  const tot = (k: WindowKey, f: 'impressions' | 'clicks') => (g ? sum(Object.fromEntries(Object.entries(g.byCity[k]).map(([c, m]) => [c, m[f]]))) : null);
  const cta = (k: WindowKey, ev: 'whatsapp_click' | 'call_click' | 'app_click') => i.ga4?.cta[k]?.total[ev];
  const sb = i.supabase;
  return {
    estate: pair(sum(i.estateByCity), null),
    indexedPass: pair(i.census?.byVerdict.PASS ?? null, i.previous?.site.indexedPass ?? null),
    censusFresh: pair(i.census ? Math.round((i.census.fresh / Math.max(1, i.census.estate)) * 100) : null, null),
    bingInIndex: pair(i.bing?.crawl.latest?.inIndex, i.bing?.crawl.series.length ? i.bing.crawl.series[Math.max(0, i.bing.crawl.series.length - 8)]?.inIndex : null),
    impressions: pair(tot('current', 'impressions'), tot('previous', 'impressions')),
    clicks: pair(tot('current', 'clicks'), tot('previous', 'clicks')),
    bingImpressions: pair(i.bing?.traffic.current?.impressions, i.bing?.traffic.previous?.impressions),
    bingClicks: pair(i.bing?.traffic.current?.clicks, i.bing?.traffic.previous?.clicks),
    organicSessions: pair(i.ga4?.organicGeo.current?.totalSessions, i.ga4?.organicGeo.previous?.totalSessions),
    whatsapp: pair(cta('current', 'whatsapp_click'), cta('previous', 'whatsapp_click')),
    call: pair(cta('current', 'call_click'), cta('previous', 'call_click')),
    app: pair(cta('current', 'app_click'), cta('previous', 'app_click')),
    chats: pair(sb?.support.current.conversations, sb?.support.previous.conversations),
    escalated: pair(sb?.support.current.escalated, sb?.support.previous.escalated),
    leads: pair(sb?.leads?.current.total, sb?.leads?.previous.total),
    staleLeads: pair(sb?.leads?.current.staleNew, null),
    signups: pair(sb?.signups.current, sb?.signups.previous),
    bookingRequests: pair(sb?.bookings.current.total, sb?.bookings.previous.total),
    bookingsConfirmed: pair(sb?.bookings.current.confirmed, sb?.bookings.previous.confirmed),
  };
}

// ─── Alerts ─────────────────────────────────────────────────────────────────────────────────

export function evaluateAlerts(i: ReportInputs, site: Record<string, Pair>, tier1Clicks: Pair): Alert[] {
  const alerts: Alert[] = [];
  const drop = (id: string, metric: string, p: Pair, pct: number, severity: Alert['severity'], minPrev = 1) => {
    if (p.cur == null || p.prev == null || p.prev < minPrev) return;
    if ((p.prev - p.cur) / p.prev > pct) alerts.push({ id, severity, metric, message: `${metric} fell ${Math.round(((p.prev - p.cur) / p.prev) * 100)}% week over week`, current: p.cur, previous: p.prev });
  };
  drop('gsc-indexed-drop', 'Google indexed (PASS) census', site.indexedPass, 0.1, 'critical', 20);
  drop('bing-inindex-drop', 'Bing pages in index', site.bingInIndex, 0.1, 'warn', 20);
  drop('tier1-clicks-drop', 'Tier-1 organic clicks', tier1Clicks, 0.3, 'warn', 50);
  const b = i.bing?.crawl.latest;
  if (b && b.crawledPages > 0 && b.code5xx / b.crawledPages > 0.01) {
    alerts.push({ id: 'bing-5xx', severity: 'critical', metric: 'Bing crawl 5xx rate', message: `${b.code5xx} of ${b.crawledPages} crawled pages returned 5xx on ${b.date}`, current: b.code5xx, previous: null });
  }
  for (const s of i.gsc?.sitemaps ?? []) {
    if (s.errors > 0) alerts.push({ id: `sitemap-errors:${s.path}`, severity: 'warn', metric: 'Sitemap errors', message: `${s.path} reports ${s.errors} error(s)`, current: s.errors, previous: null });
    if (s.isPending && s.lastDownloaded && Date.parse(i.asOf) - Date.parse(s.lastDownloaded) > 7 * 86400000) {
      alerts.push({ id: `sitemap-pending:${s.path}`, severity: 'warn', metric: 'Sitemap pending', message: `${s.path} has been pending since ${s.lastDownloaded.slice(0, 10)}`, current: null, previous: null });
    }
  }
  if (site.censusFresh.cur != null && site.censusFresh.cur < 80 && (i.census?.inspected ?? 0) > 0) {
    alerts.push({ id: 'census-stale', severity: 'warn', metric: 'Census freshness', message: `only ${site.censusFresh.cur}% of the estate was inspected in the last 8 days — is the daily job running?`, current: site.censusFresh.cur, previous: null });
  }
  if ((site.staleLeads.cur ?? 0) > 10) {
    alerts.push({ id: 'stale-leads', severity: 'warn', metric: 'Leads waiting', message: `${site.staleLeads.cur} leads have sat in status 'new' for more than 24 hours`, current: site.staleLeads.cur, previous: null });
  }
  // a few stray www impressions linger for weeks after a 308 to the apex; alert only when
  // they are more than noise (over 20 and over 1 % of all impressions)
  const hosts = i.gsc?.hostsByImpressions ?? {};
  const totalImp = Object.values(hosts).reduce((s, v) => s + v, 0);
  for (const [host, imp] of Object.entries(hosts)) {
    if (/^www\./.test(host) && imp > 20 && imp > totalImp * 0.01) {
      alerts.push({ id: `canonical-host:${host}`, severity: 'warn', metric: 'Non-canonical host', message: `${host} is getting impressions (${imp}); the canonical host is the apex`, current: imp, previous: null });
    }
  }
  return alerts;
}

// ─── Composition ────────────────────────────────────────────────────────────────────────────

const flat = (m: Record<string, Pair>): CityRow => Object.fromEntries(Object.entries(m).map(([k, p]) => [k, p.cur]));

function cityTable(i: ReportInputs, rows: Record<string, Record<string, Pair>>): string {
  const lines = [
    '| City | Tier | Indexable | Indexed (PASS) | Impressions | Clicks | Avg pos | Top-20 kw pos (seen/tracked) | Organic sessions | WhatsApp | Call | App | Chats | Leads | Booking requests |',
    '|---|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|',
  ];
  for (const city of CITIES_BY_TIER) {
    const m = rows[city];
    const name = i.cities.find((c) => c.slug === city)?.name ?? city;
    const kw = m.kwTracked.cur ? `${cellPos(m.kwPosition.cur, m.kwPosition.prev)} (${m.kwSeen.cur}/${m.kwTracked.cur})` : NA;
    lines.push(
      `| ${name} | ${tierOf(city) ?? ''} | ${n(m.indexable.cur)} | ${cell(m.indexedPass.cur, m.indexedPass.prev)} | ${cell(m.impressions.cur, m.impressions.prev)} | ${cell(m.clicks.cur, m.clicks.prev)} | ${cellPos(m.position.cur, m.position.prev)} | ${kw} | ${cell(m.organicSessions.cur, m.organicSessions.prev)} | ${cell(m.whatsapp.cur, m.whatsapp.prev)} | ${cell(m.call.cur, m.call.prev)} | ${cell(m.app.cur, m.app.prev)} | ${cell(m.chats.cur, m.chats.prev)} | ${cell(m.leads.cur, m.leads.prev)} | ${cell(m.bookings.cur, m.bookings.prev)} |`,
    );
  }
  return lines.join('\n');
}

function sinceBaseline(site: Record<string, Pair>, b: WeeklySummary): string {
  const vs = (label: string, key: string) => `${label} ${n(b.site[key])} → ${n(site[key]?.cur)}${fmtDelta(site[key]?.cur, b.site[key])}`;
  return `Since the baseline (week ending ${b.asOf}): ${[vs('impressions', 'impressions'), vs('clicks', 'clicks'), vs('WhatsApp clicks', 'whatsapp'), vs('leads', 'leads'), vs('booking requests', 'bookingRequests')].join(' · ')}.`;
}

function funnelTable(site: Record<string, Pair>): string {
  const step = (label: string, p: Pair) => `| ${label} | ${n(p.cur)} | ${n(p.prev)} | ${fmtDelta(p.cur, p.prev).trim() || '—'} |`;
  return [
    '| Step | This week | Last week | Change |',
    '|---|---:|---:|---|',
    step('Organic sessions (GA4)', site.organicSessions),
    step('WhatsApp clicks', site.whatsapp),
    step('Call clicks', site.call),
    step('App clicks', site.app),
    step('Chat conversations', site.chats),
    step('Chats escalated to the team', site.escalated),
    step('Leads (call-back form)', site.leads),
    step('Signups (profiles created)', site.signups),
    step('Booking requests', site.bookingRequests),
    step('Bookings active or completed', site.bookingsConfirmed),
  ].join('\n');
}

function keywordSection(i: ReportInputs): string {
  if (!i.gsc) return '_Search Console not connected._';
  const out: string[] = [];
  for (const city of CITIES_BY_TIER.filter((c) => tierOf(c) === 1)) {
    const kws = i.gsc.keywords.filter((k) => k.city === city);
    if (!kws.length) continue;
    const name = i.cities.find((c) => c.slug === city)?.name ?? city;
    out.push(`### ${name}`, '', '| Keyword | Position | Last week | Impressions | Clicks | Ranking page | On target |', '|---|---:|---:|---:|---:|---|---|');
    for (const k of kws) {
      const c = k.current;
      out.push(
        `| ${k.keyword} | ${c ? c.position.toFixed(1) : '—'} | ${k.previous ? k.previous.position.toFixed(1) : '—'} | ${c ? c.impressions : '—'} | ${c ? c.clicks : '—'} | ${c ? c.topPage.replace(/^https?:\/\/[^/]+/, '') : k.targetUrl} | ${c ? (c.onTarget ? 'yes' : '**no**') : ''} |`,
      );
    }
    out.push('');
  }
  out.push('_"—" means no impressions were recorded (or the query was anonymised); it is not zero._');
  return out.join('\n');
}

function censusSection(i: ReportInputs): string {
  const c = i.census;
  if (!c || !c.inspected) return '_No URL inspections yet — the daily census has not run._';
  const lines = [
    `Estate ${c.estate} indexable URLs · inspected ${c.inspected} · fresh (≤ 8 days) ${c.fresh} · stale ${c.stale} · retired ${c.retired}.`,
    '',
    '| Verdict | URLs |',
    '|---|---:|',
    ...Object.entries(c.byVerdict).sort((a, b) => b[1] - a[1]).map(([v, k]) => `| ${v} | ${k} |`),
    '',
    '| Coverage state | URLs |',
    '|---|---:|',
    ...Object.entries(c.byCoverageState).sort((a, b) => b[1] - a[1]).map(([v, k]) => `| ${v} | ${k} |`),
    '',
    '| Page type | Estate | PASS | Other |',
    '|---|---:|---:|---:|',
    ...Object.entries(c.byPageType).sort((a, b) => b[1].estate - a[1].estate).map(([t, k]) => `| ${t} | ${k.estate} | ${k.pass} | ${k.other} |`),
  ];
  if (c.transitions.length) {
    lines.push('', `**${c.transitions.length} URL(s) left PASS in the last 7 days:**`, ...c.transitions.slice(0, 25).map((t) => `- ${t.path} → ${t.to}`));
    if (c.transitions.length > 25) lines.push(`- … and ${c.transitions.length - 25} more`);
  }
  return lines.join('\n');
}

function sitemapSection(i: ReportInputs): string {
  const rows: string[] = [];
  if (i.gsc?.sitemaps?.length) {
    rows.push('| Google shard | Submitted | Last downloaded | Pending | Errors | Warnings |', '|---|---:|---|---|---:|---:|');
    for (const s of i.gsc.sitemaps) rows.push(`| ${s.path} | ${s.submitted ?? NA} | ${s.lastDownloaded?.slice(0, 10) ?? NA} | ${s.isPending ? 'yes' : 'no'} | ${s.errors} | ${s.warnings} |`);
  } else rows.push('_Google sitemap list not available._');
  rows.push('');
  if (i.bing?.feeds.length) {
    rows.push('| Bing feed | Status | URLs | Last crawled |', '|---|---|---:|---|');
    for (const f of i.bing.feeds) rows.push(`| ${f.url} | ${f.status} | ${f.urlCount} | ${f.lastCrawled ?? NA} |`);
  } else rows.push('_Bing feed list not available._');
  return rows.join('\n');
}

export function composeWeeklyReport(i: ReportInputs): ComposedReport {
  const rows: Record<string, Record<string, Pair>> = Object.fromEntries(CITIES_BY_TIER.map((c) => [c, cityMetrics(i, c)]));
  const site = siteMetrics(i);
  const tier1 = CITIES_BY_TIER.filter((c) => tierOf(c) === 1);
  const tier1Clicks = pair(
    i.gsc ? tier1.reduce((s, c) => s + (i.gsc?.byCity.current[c]?.clicks ?? 0), 0) : null,
    i.gsc ? tier1.reduce((s, c) => s + (i.gsc?.byCity.previous[c]?.clicks ?? 0), 0) : null,
  );
  const alerts = evaluateAlerts(i, site, tier1Clicks);
  const summary: WeeklySummary = {
    asOf: i.asOf,
    windows: i.windows,
    cities: Object.fromEntries(Object.entries(rows).map(([c, m]) => [c, flat(m)])),
    site: flat(site),
    alerts,
  };
  const w = i.windows;
  const md = [
    `# Growth report — week ending ${i.asOf}`,
    '',
    `Generated ${i.generatedAt}. This week ${w.current.start} to ${w.current.end}; last week ${w.previous.start} to ${w.previous.end}. Deltas in brackets are week over week.`,
    '',
    '## Data availability',
    '',
    ...(i.notes.length ? i.notes.map((x) => `- ${x}`) : ['- All sources reported.']),
    '',
    '## Cities (Tier 1 first)',
    '',
    cityTable(i, rows),
    '',
    `Site-wide: Google indexed (PASS) ${cell(site.indexedPass.cur, site.indexedPass.prev)} of ${n(site.estate.cur)} indexable · Bing in index ${cell(site.bingInIndex.cur, site.bingInIndex.prev)} · Google impressions ${cell(site.impressions.cur, site.impressions.prev)} / clicks ${cell(site.clicks.cur, site.clicks.prev)} · Bing impressions ${cell(site.bingImpressions.cur, site.bingImpressions.prev)} / clicks ${cell(site.bingClicks.cur, site.bingClicks.prev)}.`,
    '',
    ...(i.baseline ? [sinceBaseline(site, i.baseline), ''] : []),
    '## Funnel (site-wide)',
    '',
    funnelTable(site),
    '',
    '## Keywords — top 20 per Tier-1 city',
    '',
    keywordSection(i),
    '',
    '## Index census (URL Inspection)',
    '',
    censusSection(i),
    '',
    '## Sitemap health',
    '',
    sitemapSection(i),
    '',
    '## Demand outside the footprint (logged, not actioned)',
    '',
    i.gsc ? renderExpansionTable(i.gsc.expansion) : '_Search Console not connected._',
    '',
    '## Alerts',
    '',
    ...(alerts.length ? alerts.map((a) => `- **${a.severity}** ${a.message}`) : ['- None.']),
    '',
    '## What shipped this week / the single biggest lever next week',
    '',
    '_Filled in by hand at the Monday review (see docs/growth/changelog.md)._',
    '',
  ];
  return { markdown: md.join('\n'), alerts, summary };
}

/** The brief's §5 table, filled with the first real numbers. Targets are set at the first weekly review, not guessed here. */
export function composeBaseline(i: ReportInputs, r: ComposedReport): string {
  const s = r.summary.site;
  const v = (k: string) => (s[k] == null ? 'n/a — source not connected' : String(s[k]));
  /** Several numbers from one source share a cell; when none reported, say so once. */
  const combo = (keys: string[], render: (vals: string[]) => string) => (keys.every((k) => s[k] == null) ? 'n/a — source not connected' : render(keys.map((k) => (s[k] == null ? 'n/a' : String(s[k])))));
  const pct = (num: number | null, den: number | null) => (num == null || den == null || den === 0 ? 'n/a' : `${((num / den) * 100).toFixed(1)}%`);
  return [
    `# Baseline — week ending ${i.asOf}`,
    '',
    `Recorded ${i.generatedAt} from the first weekly growth run. This file is not regenerated; later reports show deltas against it. Every value is a measurement; where a source was not connected the cell says so rather than carrying an estimate.`,
    '',
    '| Metric | Baseline | 90-day target | 180-day target | Source |',
    '|---|---|---|---|---|',
    `| Indexable pages (data layer) | ${v('estate')} | | | \`allIndexableUrls()\` |`,
    `| Indexed pages, Google (PASS census) | ${v('indexedPass')} | | | URL Inspection API |`,
    `| Indexed pages, Bing (InIndex) | ${v('bingInIndex')} | | | Bing Webmaster API |`,
    `| Impressions, all cities | ${v('impressions')} | | | Search Console |`,
    `| Clicks, all cities | ${v('clicks')} | | | Search Console |`,
    `| Organic sessions | ${v('organicSessions')} | | | GA4 (Organic Search channel) |`,
    `| WhatsApp / call / app clicks | ${combo(['whatsapp', 'call', 'app'], (x) => x.join(' / '))} | | | GA4 events |`,
    `| Chat conversations (escalated) | ${combo(['chats', 'escalated'], ([a, b]) => `${a} (${b})`)} | | | support_conversations |`,
    `| Leads | ${v('leads')} | | | leads table |`,
    `| Signups | ${v('signups')} | | | profiles |`,
    `| Booking requests (active or completed) | ${combo(['bookingRequests', 'bookingsConfirmed'], ([a, b]) => `${a} (${b})`)} | | | bookings |`,
    `| Session → WhatsApp/call click rate | ${pct(((s.whatsapp ?? 0) + (s.call ?? 0)) || null, s.organicSessions ?? null)} | | | derived |`,
    `| Click → signup rate | ${pct(s.signups ?? null, ((s.whatsapp ?? 0) + (s.call ?? 0) + (s.app ?? 0)) || null)} | | | derived (all clicks, not only organic) |`,
    `| Signup → booking request rate | ${pct(s.bookingRequests ?? null, s.signups ?? null)} | | | derived |`,
    `| Cost per WhatsApp conversation (ads) | n/a — no paid campaign | | | Meta / Google Ads |`,
    `| Cost per confirmed booking | n/a — no paid campaign | | | derived |`,
    '',
    '## Per-city baseline',
    '',
    cityTable(i, Object.fromEntries(CITIES_BY_TIER.map((c) => [c, cityMetrics(i, c)]))),
    '',
    '## Caveats',
    '',
    ...(i.notes.length ? i.notes.map((x) => `- ${x}`) : ['- None recorded.']),
    '',
    '## Setting targets',
    '',
    'Targets are city-specific and tier-weighted (Tier-1 cities carry the tighter ones) and are agreed at the first Monday review after this baseline, once the census has covered the whole estate at least once. A blank target cell means "not yet set", never "zero".',
    '',
  ].join('\n');
}
