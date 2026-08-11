// SEO metadata generation helpers.
// Generates consistent <head> metadata for all page types.

import type { Metadata } from 'next';

const SITE_URL = 'https://mybuddymaid.in';
const SITE_NAME = 'MyBuddyMaid';
const DEFAULT_OG_IMAGE = `${SITE_URL}/hero-new.png`;

export interface PageMetadataOptions {
  title: string;
  description: string;
  path: string;                 // e.g., "/best-cook-service-in-delhi"
  ogImage?: string;
  noindex?: boolean;
  type?: 'website' | 'article';
}

/**
 * Generate consistent Next.js Metadata for any page.
 * Handles canonical URL, OG tags, Twitter cards, and robots directives.
 */
export function generatePageMetadata(options: PageMetadataOptions): Metadata {
  const {
    title,
    description,
    path,
    ogImage = DEFAULT_OG_IMAGE,
    noindex = false,
    type = 'website',
  } = options;

  const canonicalUrl = `${SITE_URL}${path}`;
  const fullTitle = path === '/' ? title : `${title} — ${SITE_NAME}`;

  return {
    title: fullTitle,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: noindex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          'max-image-preview': 'large' as const,
          'max-snippet': -1,
          'max-video-preview': -1,
        },
    openGraph: {
      title: fullTitle,
      description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      locale: 'en_IN',
      type,
      images: [
        {
          url: ogImage,
          width: 800,
          height: 800,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [ogImage],
    },
  };
}

/**
 * Generate metadata for a city+service page.
 * Example: "Best Cook Service in Delhi — MyBuddyMaid"
 */
export function generateCityServiceMetadata(
  serviceName: string,
  cityName: string,
  serviceSlug: string,
  citySlug: string,
): Metadata {
  const title = `Best ${serviceName} in ${cityName}`;
  const description = `Book verified ${serviceName.toLowerCase()} in ${cityName}. Police-verified professionals, 1-year replacement guarantee. Trusted by 12,000+ families. Starting ₹3,999.`;
  const path = `/best-${serviceSlug}-in-${citySlug}`;

  return generatePageMetadata({ title, description, path });
}

export { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE };
