// Run: npx tsx --test lib/growth/bing.test.ts
//
// Bing's JSON API wraps everything in {"d": …} and serialises dates as "/Date(ms-offset)/".
// The parsers are pinned on those two facts and on picking the latest crawl-stats row, which
// is where the "pages in Bing's index" number comes from.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bingUrl, latestCrawl, parseBingDate, parseCrawlStats, parseFeeds, parseTraffic, pickSite, sumTraffic } from './bing';

test('parseBingDate reads the WCF date format and plain ISO dates', () => {
  assert.equal(parseBingDate('/Date(1316156400000-0700)/'), '2011-09-16');
  assert.equal(parseBingDate('2026-09-11T00:00:00'), '2026-09-11');
  assert.equal(parseBingDate(42), null);
});

test('crawl stats are sorted by date and the latest row carries InIndex', () => {
  const rows = parseCrawlStats({
    d: [
      { Date: '/Date(1757548800000)/', InIndex: 2300, CrawledPages: 400, Code5xx: 1, Code4xx: 3, CrawlErrors: 0, BlockedByRobotsTxt: 0 },
      { Date: '/Date(1757462400000)/', InIndex: 2250, CrawledPages: 380, Code5xx: 0 },
    ],
  });
  assert.deepEqual(rows.map((r) => r.date), ['2025-09-10', '2025-09-11']);
  assert.equal(latestCrawl(rows)?.inIndex, 2300);
  assert.equal(latestCrawl([]), null);
});

test('traffic is summed inside a window and null when the window has no rows', () => {
  const rows = parseTraffic({ d: [{ Date: '2026-09-05', Clicks: 3, Impressions: 100 }, { Date: '2026-09-06', Clicks: 2, Impressions: 50 }, { Date: '2026-08-01', Clicks: 9, Impressions: 9 }] });
  assert.deepEqual(sumTraffic(rows, { start: '2026-09-05', end: '2026-09-11' }), { clicks: 5, impressions: 150 });
  assert.equal(sumTraffic(rows, { start: '2026-07-01', end: '2026-07-07' }), null);
});

test('pickSite matches the property by host, ignoring www, and bingUrl carries the key', () => {
  const sites = { d: [{ Url: 'https://example.com/' }, { Url: 'https://www.mybuddymaid.in/' }] };
  assert.equal(pickSite(sites, 'mybuddymaid.in'), 'https://www.mybuddymaid.in/');
  assert.equal(pickSite(sites, 'nowhere.in'), null);
  const u = new URL(bingUrl('GetCrawlStats', 'KEY', { siteUrl: 'https://mybuddymaid.in/' }));
  assert.equal(u.searchParams.get('apikey'), 'KEY');
  assert.equal(u.searchParams.get('siteUrl'), 'https://mybuddymaid.in/');
  assert.equal(parseFeeds({ d: [{ Url: 'https://mybuddymaid.in/sitemap.xml', Status: 'Ok', UrlCount: 2533 }] })[0].urlCount, 2533);
});
