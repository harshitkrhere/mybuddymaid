// scripts/growth/gsc.ts — the weekly Search Console snapshot: impressions, clicks and
// position per city and page type for two adjacent weeks, the top-20 tracked keywords per
// Tier-1 city, sitemap shard health, and the demand recorded for cities we do not serve.
//
//   $env:GSC_SERVICE_ACCOUNT_JSON = 'C:\keys\mbm-growth.json'
//   npm run growth:gsc                    # window ends three days ago
//   npm run growth:gsc -- --end 2026-09-11
//
// Writes docs/growth/data/gsc/<end>.json. Requires the service account to be a user on the
// Search Console property (Full, so the same key also serves the URL Inspection census).
import * as path from 'node:path';
import { CITIES, ZONES } from '../../data/seo';
import { SITE_URL } from '../../lib/seo-engine/meta';
import { TIER1_CITIES } from '../../lib/growth/classify';
import { outsideFootprintCandidates, outsideFootprintDemand } from '../../lib/growth/expansion';
import { accessToken, SCOPES } from '../../lib/growth/google-auth';
import { buildGscSnapshot, cityPagePattern, listSitemaps, parseSitemapsList, queryAll, saBody, type GscClient, type SaRow } from '../../lib/growth/gsc';
import { parseKeywordsCsv, pickTracked, type KeywordRow } from '../../lib/growth/keywords';
import type { WindowKey } from '../../lib/growth/windows';
import { dataDir, endDate, fetchImpl, nowIso, rawDump, readJson, readServiceAccount, REPO, SITE, windowsFor, writeJson } from './_env';
import * as fs from 'node:fs';

/** Home and the service hubs: the pages whose keywords are tracked under 'national'. */
const nationalPattern = (siteUrl: string) => `^${siteUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(services/[a-z-]+)?$`;

async function main() {
  const end = endDate();
  const windows = windowsFor(end);
  const key = readServiceAccount();
  const token = await accessToken(key, [SCOPES.gsc]);
  const client: GscClient = { site: SITE, token, fetchImpl };
  const errors: string[] = [];
  const attempt = async <T>(label: string, f: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await f();
    } catch (e) {
      const msg = `${label}: ${(e as Error).message}`;
      console.error(msg);
      errors.push(msg);
      return fallback;
    }
  };

  const keywordsCsv = fs.readFileSync(path.join(REPO, 'docs', 'seo', 'keywords.csv'), 'utf8');
  const allKeywords = parseKeywordsCsv(keywordsCsv);
  const tracked: KeywordRow[] = [...TIER1_CITIES, 'national'].flatMap((city) => pickTracked(allKeywords, city));

  const pageRows = {} as Record<WindowKey, SaRow[]>;
  const keywordRows = {} as Record<WindowKey, SaRow[]>;
  for (const k of ['current', 'previous'] as WindowKey[]) {
    const w = windows[k];
    pageRows[k] = await attempt(`pages ${k}`, () => queryAll(client, saBody(w, ['page'], { aggregationType: 'byPage' })), []);
    rawDump(`gsc-pages-${k}`, pageRows[k]);
    const rows: SaRow[] = [];
    for (const city of TIER1_CITIES) {
      rows.push(
        ...(await attempt(`keywords ${city} ${k}`, () => queryAll(client, saBody(w, ['query', 'page'], { filters: [{ dimension: 'page', operator: 'includingRegex', expression: cityPagePattern(city, SITE_URL) }] })), [])),
      );
    }
    rows.push(...(await attempt(`keywords national ${k}`, () => queryAll(client, saBody(w, ['query', 'page'], { filters: [{ dimension: 'page', operator: 'includingRegex', expression: nationalPattern(SITE_URL) }] })), [])));
    keywordRows[k] = rows;
    rawDump(`gsc-keywords-${k}`, rows);
  }

  const queryRows = await attempt('queries current', () => queryAll(client, saBody(windows.current, ['query'])), []);
  rawDump('gsc-queries-current', queryRows);
  const legacy = readJson<Array<{ slug: string; name: string }>>(path.join(REPO, 'docs', 'seo', 'legacy-data', 'cities.json')) ?? [];
  const expansion = outsideFootprintDemand(queryRows, outsideFootprintCandidates(legacy, CITIES, ZONES));

  const sitemapsJson = await attempt('sitemaps', () => listSitemaps(client, `${SITE_URL}/sitemap.xml`), null);
  rawDump('gsc-sitemaps', sitemapsJson);
  const sitemaps = sitemapsJson ? parseSitemapsList(sitemapsJson, SITE_URL) : null;

  const snapshot = buildGscSnapshot({ site: SITE, generatedAt: nowIso(), windows, pageRows, keywordRows, tracked, sitemaps, expansion, errors });
  const file = path.join(dataDir('gsc'), `${end}.json`);
  writeJson(file, snapshot);

  console.log(`\nSearch Console ${windows.current.start} to ${windows.current.end} -> ${file}\n`);
  console.log('| City | Pages | Clicks | Impressions | Position |');
  console.log('|---|---:|---:|---:|---:|');
  for (const [city, m] of Object.entries(snapshot.byCity.current).sort((a, b) => b[1].clicks - a[1].clicks)) {
    console.log(`| ${city} | ${m.pages} | ${m.clicks} | ${m.impressions} | ${m.position ?? '-'} |`);
  }
  const seen = snapshot.keywords.filter((k) => k.current).length;
  console.log(`\nkeywords: ${seen} of ${snapshot.keywords.length} tracked had impressions; ${expansion.length} non-served cities named in queries`);
  if (errors.length) {
    console.error(`\n${errors.length} part(s) failed; the snapshot was written without them.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
