// JSON-LD structured data generators.
// Produces schema.org markup for Google rich results.

import { SITE_URL } from './metadata';

/**
 * Organization schema — appears on every page.
 * Powers Google Knowledge Panel.
 */
export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MyBuddyMaid',
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description:
      "India's premier network of police-verified maids, cooks, nannies & elderly care professionals.",
    telephone: '+919318429135',
    email: 'info@mybuddymaid.in',
    foundingDate: '2021',
    sameAs: [
      'https://www.instagram.com/mybuddymaid/',
      'https://www.facebook.com/mybuddymaid/',
    ],
    address: {
      '@type': 'PostalAddress',
      streetAddress: '175, 5th Floor, Main Road, Chandra Layout',
      addressLocality: 'Bengaluru',
      addressRegion: 'Karnataka',
      postalCode: '560040',
      addressCountry: 'IN',
    },
  };
}

/**
 * LocalBusiness schema for city-specific pages.
 * Each city gets its own geo coordinates.
 */
export function localBusinessSchema(cityName: string, lat: number, lng: number) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: `MyBuddyMaid ${cityName}`,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    image: `${SITE_URL}/hero-new.png`,
    telephone: '+919318429135',
    email: 'info@mybuddymaid.in',
    priceRange: '₹3,999 - ₹6,999',
    address: {
      '@type': 'PostalAddress',
      addressLocality: cityName,
      addressCountry: 'IN',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: lat.toString(),
      longitude: lng.toString(),
    },
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: '08:00',
      closes: '21:00',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      bestRating: '5',
      ratingCount: '500',
      reviewCount: '500',
    },
  };
}

/**
 * Service schema for individual service pages.
 */
export function serviceSchema(
  serviceName: string,
  description: string,
  price: string,
  cityName?: string,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: serviceName,
    description,
    provider: {
      '@type': 'Organization',
      name: 'MyBuddyMaid',
      url: SITE_URL,
    },
    areaServed: cityName
      ? { '@type': 'City', name: cityName }
      : undefined,
    offers: {
      '@type': 'Offer',
      price: price.replace(/[^0-9]/g, '') || '3999',
      priceCurrency: 'INR',
      availability: 'https://schema.org/InStock',
    },
  };
}

/**
 * FAQ schema for pages with FAQ sections.
 */
export function faqSchema(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/**
 * BreadcrumbList schema.
 */
export function breadcrumbSchema(
  items: Array<{ name: string; url: string }>,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.url}`,
    })),
  };
}

/**
 * Render JSON-LD as a <script> tag (use in page components).
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
