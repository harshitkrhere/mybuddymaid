// lib/growth/keywords.ts — the rank-tracking set. docs/seo/keywords.csv maps every keyword to
// the one URL that owns it; the weekly report follows the top 20 per Tier-1 city, chosen
// deterministically (priority, then page type from hub to long tail, then file order) so the
// tracked list does not drift from week to week.
export interface KeywordRow {
  keyword: string; // lowercased
  targetUrl: string;
  city: string; // city slug, 'national' or 'brand'
  priority: string;
  pageType: string;
  targetIndexable: boolean;
  index: number; // position in the CSV, the final tie-breaker
}

/** Minimal RFC 4180 reader: quoted fields, doubled quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function parseKeywordsCsv(text: string): KeywordRow[] {
  const [header, ...rest] = parseCsv(text);
  if (!header) return [];
  const col = (name: string) => header.indexOf(name);
  const k = col('keyword');
  const t = col('target_url');
  const c = col('city');
  const p = col('priority');
  const pt = col('page_type');
  const ti = col('target_indexable');
  if ([k, t, c, p, pt].some((i) => i < 0)) throw new Error('keywords.csv is missing a required column');
  return rest
    .filter((r) => r.length > pt && r[k])
    .map((r, index) => ({
      keyword: r[k].trim().toLowerCase(),
      targetUrl: r[t].trim(),
      city: r[c].trim(),
      priority: r[p].trim(),
      pageType: r[pt].trim(),
      targetIndexable: ti < 0 ? true : r[ti].trim().toLowerCase() !== 'no',
      index,
    }));
}

const PRIORITY_RANK: Record<string, number> = { 'very-high': 0, high: 1, medium: 2 };

/** Hub pages first: they carry the commercial intent the brief wants watched most closely. */
export function pageTypeRank(pageType: string): number {
  const p = pageType.toLowerCase();
  if (p.startsWith('home')) return 0;
  if (p.startsWith('service-hub')) return 1;
  if (p.startsWith('city')) return 2;
  if (p.startsWith('service-city')) return 3;
  if (p.startsWith('zone')) return 4;
  if (p.startsWith('locality')) return 5;
  if (p.startsWith('service x locality')) return 6;
  if (p.startsWith('pincode')) return 7;
  return 8;
}

export function pickTracked(rows: KeywordRow[], city: string, limit = 20): KeywordRow[] {
  return rows
    .filter((r) => r.city === city && r.targetIndexable)
    .sort(
      (a, b) =>
        (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) ||
        pageTypeRank(a.pageType) - pageTypeRank(b.pageType) ||
        a.index - b.index,
    )
    .slice(0, limit);
}
