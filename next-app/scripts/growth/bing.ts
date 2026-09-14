// scripts/growth/bing.ts — the weekly Bing Webmaster Tools snapshot: pages in Bing's index
// (GetCrawlStats.InIndex), clicks and impressions for two adjacent weeks, top queries and
// sitemap feed health. Also the sitemap re-submission that follows a batch release.
//
//   $env:BING_WEBMASTER_API_KEY = '<key>'   # Bing Webmaster Tools -> Settings -> API access
//   npm run growth:bing
//   npm run growth:bing -- --submit-sitemap  # after `seo:indexnow --batch <shard>`
//
// The site must be verified in the same Bing account (the import from Search Console does
// that); the site URL is resolved from GetUserSites so it matches what Bing stores.
import * as path from 'node:path';
import { SITE_URL } from '../../lib/seo-engine/meta';
import { bingGet, buildBingSnapshot, parseCrawlStats, parseFeeds, parseQueryStats, parseTraffic, pickSite, submitFeed } from '../../lib/growth/bing';
import { dataDir, endDate, fail, fetchImpl, hasFlag, nowIso, rawDump, windowsFor, writeJson } from './_env';

async function main() {
  const apiKey = process.env.BING_WEBMASTER_API_KEY ?? fail('Set BING_WEBMASTER_API_KEY (Bing Webmaster Tools -> Settings -> API access).');
  const host = new URL(SITE_URL).host;
  const sites = await bingGet(fetchImpl, 'GetUserSites', apiKey);
  rawDump('bing-sites', sites);
  const siteUrl = process.env.BING_SITE_URL ?? pickSite(sites, host) ?? fail(`Bing does not list a verified site for ${host}; finish the Search Console import first.`);

  if (hasFlag('--submit-sitemap')) {
    await submitFeed(fetchImpl, apiKey, siteUrl, `${SITE_URL}/sitemap.xml`);
    console.log(`submitted ${SITE_URL}/sitemap.xml for ${siteUrl}`);
    return;
  }

  const end = endDate();
  const windows = windowsFor(end);
  const errors: string[] = [];
  const attempt = async <T>(method: string, parse: (json: unknown) => T, fallback: T): Promise<T> => {
    try {
      const json = await bingGet(fetchImpl, method, apiKey, { siteUrl });
      rawDump(`bing-${method}`, json);
      return parse(json);
    } catch (e) {
      const msg = `${method}: ${(e as Error).message}`;
      console.error(msg);
      errors.push(msg);
      return fallback;
    }
  };
  const crawl = await attempt('GetCrawlStats', parseCrawlStats, []);
  const traffic = await attempt('GetRankAndTrafficStats', parseTraffic, []);
  const queries = await attempt('GetQueryStats', parseQueryStats, []);
  const feeds = await attempt('GetFeeds', parseFeeds, []);

  const snapshot = buildBingSnapshot({ siteUrl, generatedAt: nowIso(), windows, crawl, traffic, queries, feeds, errors });
  const file = path.join(dataDir('bing'), `${end}.json`);
  writeJson(file, snapshot);
  const l = snapshot.crawl.latest;
  console.log(`\nBing ${windows.current.start} to ${windows.current.end} -> ${file}`);
  console.log(l ? `in index ${l.inIndex} (crawled ${l.crawledPages}, 5xx ${l.code5xx}) as of ${l.date}` : 'crawl stats: unavailable');
  const t = snapshot.traffic.current;
  console.log(t ? `clicks ${t.clicks}, impressions ${t.impressions}` : 'traffic: no rows in window');
  if (errors.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
