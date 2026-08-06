// Dynamic robots.txt — equivalent to the static robots.txt we deployed.

import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/home',
          '/auth',
          '/profile',
          '/bookings',
          '/onboarding',
          '/pricing',
          '/splash',
          '/services',
          '/api/',
          '/_next/',
        ],
      },
    ],
    sitemap: 'https://mybuddymaid.in/sitemap.xml',
  };
}
