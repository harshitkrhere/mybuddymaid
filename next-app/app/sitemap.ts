// Dynamic sitemap generated at build time.
// Replaces the static sitemap.xml in mybuddymaid/ once we cut over to Next.js.

import type { MetadataRoute } from 'next';
import { SERVICES } from '@/data/services';
import { ALL_CITIES } from '@/data/cities';

const SITE_URL = 'https://mybuddymaid.in';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Homepage
  const homepage: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
  ];

  // Service hub pages
  const serviceHubPages: MetadataRoute.Sitemap = SERVICES.map(service => ({
    url: `${SITE_URL}/${service.slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }));

  // Hub pages
  const hubPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/cities`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/about-us`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/contact-us`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/privacy-policy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/terms-of-service`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  // Service slugs mapped to URL patterns from existing static pages
  const serviceUrlPrefixes: Record<string, string> = {
    'maid-service': 'best-maid-service-in',
    'full-time-maid-service': 'best-full-time-maid-service-in',
    'elderly-care-service': 'best-elderly-care-service-in',
    'cook-service': 'best-cook-service-in',
    'nanny-service': 'best-nanny-service-in',
    'postnatal-care-service': 'best-postnatal-care-service-in',
  };

  // City × Service pages (the bulk of SEO pages)
  const cityServicePages: MetadataRoute.Sitemap = [];
  for (const service of SERVICES) {
    const prefix = serviceUrlPrefixes[service.slug];
    if (!prefix) continue;

    for (const city of ALL_CITIES) {
      cityServicePages.push({
        url: `${SITE_URL}/${prefix}-${city.slug}`,
        lastModified: now,
        changeFrequency: 'monthly',
        priority: city.isPrimary ? 0.8 : 0.6,
      });
    }
  }

  return [...homepage, ...serviceHubPages, ...hubPages, ...cityServicePages];
}
