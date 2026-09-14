// lib/growth/expansion.ts — demand outside the footprint, logged and never acted on.
//
// The brief's locality lock: no page, ad or listing for a city the business does not serve.
// Search Console still shows what people ask for, so each week the queries that name a
// non-served city are counted and appended to docs/growth/expansion-candidates.md as
// evidence for a later expansion decision — the owner's, not the pipeline's.
import type { City, Zone } from '@/data/seo';
import type { SaRow } from './gsc';
import type { ExpansionRow } from './types';

export interface CandidateCity {
  slug: string;
  name: string;
  aliases: string[]; // lowercased spellings to look for in query text
}

/** Legacy city list minus everything the data layer serves under any name. */
export function outsideFootprintCandidates(legacy: Array<{ slug: string; name: string }>, cities: City[], zones: Zone[]): CandidateCity[] {
  const served = new Set<string>();
  for (const c of cities) {
    served.add(c.slug);
    served.add(c.name.toLowerCase());
    for (const a of c.altNames) served.add(a.toLowerCase());
  }
  for (const z of zones) {
    served.add(z.slug);
    served.add(z.name.toLowerCase());
    for (const a of z.altNames) served.add(a.toLowerCase());
  }
  const out: CandidateCity[] = [];
  const seen = new Set<string>();
  for (const l of legacy) {
    const name = l.name.toLowerCase();
    const spaced = l.slug.replace(/-/g, ' ');
    if (served.has(l.slug) || served.has(name) || served.has(spaced) || seen.has(l.slug)) continue;
    seen.add(l.slug);
    out.push({ slug: l.slug, name: l.name, aliases: [...new Set([name, spaced])] });
  }
  return out;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** rows carry dimension [query]. A query counts for a city when it contains the city name as whole words. */
export function outsideFootprintDemand(rows: SaRow[], candidates: CandidateCity[]): ExpansionRow[] {
  const patterns = candidates.map((c) => ({ c, re: new RegExp(`(^|[^a-z])(${c.aliases.map(escape).join('|')})([^a-z]|$)`, 'i') }));
  const acc = new Map<string, { row: ExpansionRow; queries: Array<{ q: string; impressions: number }> }>();
  for (const r of rows) {
    const q = r.keys[0] ?? '';
    for (const { c, re } of patterns) {
      if (!re.test(q)) continue;
      const e = acc.get(c.slug) ?? { row: { city: c.slug, name: c.name, impressions: 0, clicks: 0, queries: 0, topQueries: [] }, queries: [] };
      e.row.impressions += r.impressions;
      e.row.clicks += r.clicks;
      e.row.queries++;
      e.queries.push({ q, impressions: r.impressions });
      acc.set(c.slug, e);
    }
  }
  return [...acc.values()]
    .map(({ row, queries }) => ({ ...row, topQueries: queries.sort((a, b) => b.impressions - a.impressions).slice(0, 3).map((x) => x.q) }))
    .sort((a, b) => b.impressions - a.impressions || a.name.localeCompare(b.name));
}

export function renderExpansionTable(rows: ExpansionRow[]): string {
  if (!rows.length) return '_No query in this window named a city outside the footprint._';
  const lines = ['| City (not served) | Impressions | Clicks | Queries | Top queries |', '|---|---:|---:|---:|---|'];
  for (const r of rows) lines.push(`| ${r.name} | ${r.impressions} | ${r.clicks} | ${r.queries} | ${r.topQueries.map((q) => `"${q}"`).join(', ')} |`);
  return lines.join('\n');
}

const HEADER = `# Expansion candidates — demand outside the footprint

MyBuddyMaid serves only the eight cities in \`next-app/data/seo\`. Nothing here is a page, an ad
or a listing: it is the search demand Search Console recorded for cities we do not serve, kept
as evidence for an expansion decision that is the owner's to take. Written by the weekly growth
job (\`npm run growth:report\`); one dated section per week, newest first, last 26 kept.
`;

/** Prepends this week's table under a dated heading, keeping the most recent `keep` sections. */
export function mergeExpansionLog(existing: string | null, rows: ExpansionRow[], asOf: string, keep = 26): string {
  const section = `## Week ending ${asOf}\n\n${renderExpansionTable(rows)}\n`;
  const body = existing ? existing.slice(existing.indexOf('## Week ending')) : '';
  const sections = body ? body.split(/(?=^## Week ending )/m).filter((s) => s.trim() && !s.startsWith(`## Week ending ${asOf}`)) : [];
  return `${HEADER}\n${[section, ...sections].slice(0, keep).join('\n')}`;
}
