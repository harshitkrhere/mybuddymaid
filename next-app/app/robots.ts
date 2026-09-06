import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo-engine/meta';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/app', '/app/', '/_spa/', '/maintenance', '/og', '/*?*'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
