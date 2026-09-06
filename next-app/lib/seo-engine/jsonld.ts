// lib/seo-engine/jsonld.ts — structured-data builders (brief §6.4). Site-wide
// Organization with the single registered office; BreadcrumbList on every page;
// Service (+Offer price band, areaServed city + postal codes) on location pages;
// FAQPage only where FAQs are visible. No LocalBusiness per locality, no ratings.
import type { City, FAQ, Locality, Service } from '@/data/seo/types';
import { SITE_URL, BRAND } from './meta';

export const ORGANIZATION = {
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: BRAND,
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  foundingDate: '2021',
  email: 'info@mybuddymaid.in',
  telephone: '+919355114869',
  sameAs: ['https://www.instagram.com/mybuddymaid', 'https://www.facebook.com/mybuddymaid'],
  contactPoint: [
    {
      '@type': 'ContactPoint',
      telephone: '+919355114869',
      contactType: 'customer service',
      areaServed: 'IN',
      availableLanguage: ['en', 'hi'],
    },
  ],
  address: {
    '@type': 'PostalAddress',
    streetAddress: '175, 5th Floor, Main Road, Chandra Layout',
    addressLocality: 'Bengaluru',
    addressRegion: 'Karnataka',
    postalCode: '560040',
    addressCountry: 'IN',
  },
} as const;

export function organizationLd() {
  return { '@context': 'https://schema.org', ...ORGANIZATION };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path}`,
    })),
  };
}

export function faqLd(faqs: FAQ[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function serviceLd(opts: {
  name: string;
  serviceType: string;
  description: string;
  path: string;
  city: City;
  pincodes: string[];
  band?: { from: number; to: number; unit: 'month' | 'hour' };
  services?: Service[];
}) {
  const areaServed: unknown[] = [{ '@type': 'City', name: opts.city.name, address: { '@type': 'PostalAddress', addressRegion: opts.city.state, addressCountry: 'IN' } }];
  for (const pin of opts.pincodes) areaServed.push({ '@type': 'PostalAddress', postalCode: pin, addressLocality: opts.city.name, addressCountry: 'IN' });
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: opts.name,
    serviceType: opts.serviceType,
    description: opts.description,
    url: `${SITE_URL}${opts.path}`,
    provider: { '@id': ORGANIZATION['@id'] },
    areaServed,
  };
  if (opts.band) {
    ld.offers = {
      '@type': 'Offer',
      priceCurrency: 'INR',
      availability: 'https://schema.org/InStock',
      priceSpecification: {
        '@type': 'PriceSpecification',
        priceCurrency: 'INR',
        minPrice: opts.band.from,
        maxPrice: opts.band.to,
        unitText: opts.band.unit === 'month' ? 'MONTH' : 'HOUR',
      },
    };
  }
  if (opts.services?.length) {
    ld.hasOfferCatalog = {
      '@type': 'OfferCatalog',
      name: `Services in ${opts.name}`,
      itemListElement: opts.services.map((s) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.name } })),
    };
  }
  return ld;
}

/** Serialise for a <script type="application/ld+json"> with `<` escaped (XSS-safe). */
export function serializeLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export type LocationLdInput = { loc: Locality; city: City };
