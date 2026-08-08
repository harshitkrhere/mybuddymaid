// URL slug parser for city×service pages.
// Maps flat URLs like "best-cook-service-in-delhi" back to service + city data.

import { SERVICES, type Service } from '@/data/services';
import { ALL_CITIES, type City } from '@/data/cities';

// Map from URL prefix to service slug
const URL_PREFIX_TO_SERVICE: Record<string, string> = {
  'best-maid-service-in': 'maid-service',
  'best-full-time-maid-service-in': 'full-time-maid-service',
  'best-elderly-care-service-in': 'elderly-care-service',
  'best-cook-service-in': 'cook-service',
  'best-nanny-service-in': 'nanny-service',
  'best-postnatal-care-service-in': 'postnatal-care-service',
};

// Reverse map for generating URLs from service slug
const SERVICE_SLUG_TO_PREFIX: Record<string, string> = Object.fromEntries(
  Object.entries(URL_PREFIX_TO_SERVICE).map(([prefix, slug]) => [slug, prefix])
);

export interface ParsedSlug {
  service: Service;
  city: City;
  urlPrefix: string;
}

/**
 * Parse a flat URL slug into service + city.
 * e.g., "best-cook-service-in-delhi" → { service: Cook, city: Delhi }
 */
export function parseSlug(slug: string): ParsedSlug | null {
  for (const [prefix, serviceSlug] of Object.entries(URL_PREFIX_TO_SERVICE)) {
    if (slug.startsWith(prefix + '-')) {
      const citySlug = slug.slice(prefix.length + 1); // +1 for the "-"
      const service = SERVICES.find(s => s.slug === serviceSlug);
      const city = ALL_CITIES.find(c => c.slug === citySlug);
      if (service && city) {
        return { service, city, urlPrefix: prefix };
      }
    }
  }
  return null;
}

/**
 * Generate the URL slug for a service + city combination.
 * e.g., ("cook-service", "delhi") → "best-cook-service-in-delhi"
 */
export function generateSlug(serviceSlug: string, citySlug: string): string {
  const prefix = SERVICE_SLUG_TO_PREFIX[serviceSlug];
  if (!prefix) return '';
  return `${prefix}-${citySlug}`;
}

/**
 * Generate all valid slugs for generateStaticParams.
 */
export function getAllSlugs(): string[] {
  const slugs: string[] = [];
  for (const service of SERVICES) {
    const prefix = SERVICE_SLUG_TO_PREFIX[service.slug];
    if (!prefix) continue;
    for (const city of ALL_CITIES) {
      slugs.push(`${prefix}-${city.slug}`);
    }
  }
  return slugs;
}

/**
 * Get nearby cities for internal linking (same state or geographically close).
 * Returns up to 4 cities, excluding the current one.
 */
export function getNearbyCities(currentCity: City): City[] {
  // Prioritize same-state cities
  const sameState = ALL_CITIES.filter(
    c => c.state === currentCity.state && c.slug !== currentCity.slug
  );
  
  if (sameState.length >= 4) return sameState.slice(0, 4);
  
  // Fill with nearest by geo distance
  const others = ALL_CITIES
    .filter(c => c.slug !== currentCity.slug && !sameState.includes(c))
    .sort((a, b) => {
      const distA = Math.abs(a.latitude - currentCity.latitude) + Math.abs(a.longitude - currentCity.longitude);
      const distB = Math.abs(b.latitude - currentCity.latitude) + Math.abs(b.longitude - currentCity.longitude);
      return distA - distB;
    });
  
  return [...sameState, ...others].slice(0, 4);
}

/**
 * Get other services for internal linking (all services except current).
 */
export function getOtherServices(currentService: Service): Service[] {
  return SERVICES.filter(s => s.slug !== currentService.slug);
}

export { SERVICE_SLUG_TO_PREFIX };
