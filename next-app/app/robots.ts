import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo-engine/meta';

// Two rules were removed on 2026-09-14 (audit 2.3: FIN-B10, FIN-SEO02, FIN-S05):
//   - `/*?*` blocked every URL with a query string, which is every ad landing URL
//     (?gclid=…, ?utm_…) — Google Ads reports those as "destination not crawlable";
//   - `/og` blocked the endpoint every page's og:image points at, so no OG image could
//     be fetched by a compliant crawler.
// The OG endpoint is protected by a signature instead (lib/seo-engine/og-sign.ts), and
// query-string variants of a page resolve to its canonical through the self-canonical tag.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/app', '/app/', '/_spa/', '/maintenance'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
