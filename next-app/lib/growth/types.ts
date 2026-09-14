// lib/growth/types.ts — the snapshot shapes every growth fetcher writes and the weekly report
// reads. Each snapshot carries both weekly windows, so the composer computes week-over-week
// from one file and the tests run on fixtures without a network. Nothing here ever holds a
// name, a phone number or a message: counts and URLs only.
import type { Window, WindowKey } from './windows';

export type { Window, WindowKey };

export interface Metrics {
  clicks: number;
  impressions: number;
  position: number | null; // impression-weighted average
  pages: number;
}

export interface KeywordStat {
  impressions: number;
  clicks: number;
  position: number;
  topPage: string; // the URL Google showed most for this query
  onTarget: boolean; // topPage is the URL keywords.csv assigns — false is a cannibalisation signal
}

export interface TrackedKeyword {
  city: string;
  keyword: string;
  targetUrl: string;
  priority: string;
  current: KeywordStat | null; // null = no impressions recorded (or anonymised), never 0
  previous: KeywordStat | null;
}

export interface SitemapHealth {
  path: string;
  submitted: number | null;
  lastDownloaded: string | null;
  isPending: boolean;
  errors: number;
  warnings: number;
}

export interface ExpansionRow {
  city: string; // slug of a city outside the footprint
  name: string;
  impressions: number;
  clicks: number;
  queries: number;
  topQueries: string[];
}

export interface GscSnapshot {
  kind: 'gsc';
  version: 1;
  generatedAt: string;
  site: string;
  windows: Record<WindowKey, Window>;
  byCity: Record<WindowKey, Record<string, Metrics>>; // city slug | 'national' | 'other'
  byPageType: Record<WindowKey, Record<string, Metrics>>;
  hostsByImpressions: Record<string, number>; // a www or http host here is a canonical leak
  topPages: Array<{ path: string; clicks: number; impressions: number }>; // top 50 by clicks, for the freshness review
  keywords: TrackedKeyword[];
  sitemaps: SitemapHealth[] | null;
  expansion: ExpansionRow[];
  errors: string[];
}

export type Verdict = 'PASS' | 'PARTIAL' | 'FAIL' | 'NEUTRAL' | 'VERDICT_UNSPECIFIED';

export interface LedgerEntry {
  path: string;
  pageType: string;
  city: string;
  inspectedAt: string;
  verdict: Verdict;
  coverageState: string;
  indexingState: string;
  robotsTxtState: string;
  pageFetchState: string;
  lastCrawlTime: string | null;
  googleCanonical: string | null;
  userCanonical: string | null;
  inSitemap: boolean;
  previousVerdict?: Verdict;
  previousVerdictAt?: string;
  retired?: boolean; // no longer in the indexable estate; kept for history
}

export interface InspectionLedger {
  kind: 'inspection-ledger';
  version: 1;
  site: string;
  updatedAt: string;
  entries: Record<string, LedgerEntry>;
}

export interface CensusCounts {
  estate: number;
  pass: number;
  other: number;
  fresh: number;
}

export interface InspectionSummary {
  asOf: string;
  estate: number;
  inspected: number;
  fresh: number;
  stale: number;
  retired: number;
  byVerdict: Record<string, number>;
  byCoverageState: Record<string, number>;
  byCity: Record<string, CensusCounts>;
  byPageType: Record<string, CensusCounts>;
  transitions: Array<{ path: string; from: string; to: string; at: string }>;
}

export type CtaEvent = 'whatsapp_click' | 'call_click' | 'app_click';
export type CtaCounts = Record<CtaEvent, number>;

export interface CtaBreakdown {
  total: CtaCounts;
  byCity: Record<string, CtaCounts>;
  byService: Record<string, CtaCounts>;
  topLocalities: Array<{ city: string; locality: string; events: CtaCounts }>;
}

export interface OrganicGeo {
  totalSessions: number;
  byCity: Record<string, { sessions: number; users: number }>;
  unmapped: Array<{ city: string; region: string; sessions: number }>; // reconcile into the mapping, never guess
}

export interface Ga4Snapshot {
  kind: 'ga4';
  version: 1;
  generatedAt: string;
  propertyId: string;
  windows: Record<WindowKey, Window>;
  customDimensions: { registered: string[]; missing: string[] };
  cta: Record<WindowKey, CtaBreakdown | null>;
  organicGeo: Record<WindowKey, OrganicGeo | null>;
  errors: string[];
}

export interface BingCrawlLatest {
  date: string;
  inIndex: number;
  crawledPages: number;
  code4xx: number;
  code5xx: number;
  crawlErrors: number;
  blockedByRobots: number;
}

export interface BingSnapshot {
  kind: 'bing';
  version: 1;
  generatedAt: string;
  siteUrl: string;
  windows: Record<WindowKey, Window>;
  crawl: { latest: BingCrawlLatest | null; series: Array<{ date: string; inIndex: number; crawledPages: number; code5xx: number }> };
  traffic: Record<WindowKey, { clicks: number; impressions: number } | null>;
  queries: Array<{ query: string; clicks: number; impressions: number; avgImpressionPosition: number; avgClickPosition: number }>;
  feeds: Array<{ url: string; status: string; urlCount: number; lastCrawled: string | null; submitted: string | null }>;
  errors: string[];
}

export interface BookingCounts {
  total: number;
  confirmed: number; // status active or completed
  byStatus: Record<string, number>;
  byCity: Record<string, number>;
  byService: Record<string, number>;
  unmappedCity: number;
}

export interface LeadCounts {
  total: number;
  byCity: Record<string, number>;
  byService: Record<string, number>;
  byStatus: Record<string, number>;
  staleNew: number; // status 'new' and older than 24 h at snapshot time
}

export interface SupportCounts {
  conversations: number;
  escalated: number;
  leadCaptured: number;
  byCity: Record<string, number>;
}

export interface SupabaseSnapshot {
  kind: 'supabase';
  version: 1;
  generatedAt: string;
  windows: Record<WindowKey, Window>;
  signups: Record<WindowKey, number>;
  bookings: Record<WindowKey, BookingCounts>;
  support: Record<WindowKey, SupportCounts>;
  leads: Record<WindowKey, LeadCounts> | null; // null until the leads table exists
  errors: string[];
}

export interface Alert {
  id: string;
  severity: 'warn' | 'critical';
  metric: string;
  message: string;
  current: number | null;
  previous: number | null;
}

export type CityRow = Record<string, number | null>;

export interface WeeklySummary {
  asOf: string;
  windows: Record<WindowKey, Window>;
  cities: Record<string, CityRow>;
  site: Record<string, number | null>;
  alerts: Alert[];
}
