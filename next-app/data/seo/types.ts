// data/seo/types.ts — shared types for the SEO data layer (single source of truth).
// Validation lives in scripts/seo/validate.ts (Zod); these are the compile-time shapes.

export type CitySlug =
  | 'delhi'
  | 'noida'
  | 'greater-noida'
  | 'gurgaon'
  | 'mumbai'
  | 'pune'
  | 'bangalore'
  | 'mangalore';

export type PricingTier = 'metro-premium' | 'metro' | 'tier-2';

export type ServiceSlug =
  | 'full-time-maid'
  | 'part-time-maid'
  | 'cook'
  | 'babysitter-nanny'
  | 'elder-care'
  | 'domestic-help';

export type Priority = 'very-high' | 'high' | 'medium';

export type LocalityKind = 'locality' | 'sector' | 'township' | 'road' | 'belt';

export type HousingProfile =
  | 'gated-societies'
  | 'independent-houses'
  | 'mixed'
  | 'builder-floors';

export type DemandProfile = 'working-professionals' | 'families' | 'elderly' | 'students';

export interface FAQ {
  id: string;
  q: string;
  a: string;
  scope: 'global' | 'service' | 'city' | 'zone' | 'locality' | 'housing' | 'entity';
  tags: string[];
}

export interface City {
  slug: CitySlug;
  name: string;
  altNames: string[];
  state: string;
  tier: 1 | 2;
  lat: number;
  lng: number;
  pricingTier: PricingTier;
  zones: string[];
  heroLocalities: string[];
  /** Pincodes served at city level that have no locality hub (e.g. 110004, 575001). */
  cityLevelPincodes: string[];
  intro: string;
  updatedAt: string; // ISO date
}

export interface Zone {
  slug: string;
  city: CitySlug;
  name: string;
  altNames: string[];
  /** Pincodes attached at zone level (zone-like source rows, e.g. 110011 central-delhi). */
  zonePincodes: string[];
  localities: string[];
  intro: string;
  updatedAt: string;
}

export interface Locality {
  slug: string;
  city: CitySlug;
  zone: string;
  name: string;
  altNames: string[];
  pincodes: string[];
  priority: Priority;
  kind: LocalityKind;
  lat?: number;
  lng?: number;
  neighbours: string[]; // locality slugs within the same city
  landmarks: string[];
  housingProfile: HousingProfile;
  demandProfile: DemandProfile[];
  /** Where helpers typically travel from. Empty until operator-confirmed or well-known. */
  helperSourceAreas: string[];
  localIntro: string; // 120-200 words, curated; empty until drafted
  commuteNotes: string;
  housingNotes: string;
  localFaqs: FAQ[];
  reviewed: boolean;
  sourceRefs: string[];
  updatedAt: string;
}

export interface ServicePricingBand {
  from: number;
  to: number;
  unit: 'month' | 'hour';
}

export type ServiceMode = 'full-time' | 'part-time' | 'live-in' | 'hourly';

export interface Service {
  slug: ServiceSlug;
  name: string;
  /** Keyword variants — used on-page, never as separate URLs (Appendix D). */
  altNames: string[];
  shortDescription: string;
  modes: ServiceMode[];
  tasksIncluded: string[];
  tasksExcluded: string[];
  typicalHours: string;
  pricing: Record<PricingTier, ServicePricingBand>;
  faqPool: FAQ[];
  relatedServices: ServiceSlug[];
  updatedAt: string;
}

export interface PincodeRecord {
  pin: string;
  city: CitySlug;
  /** Locality slugs sharing this pin. Indexable pincode page only when length >= 2. */
  localities: string[];
}

export type EntityKind = 'society' | 'sector' | 'landmark' | 'metro-station' | 'tower';

export interface Entity {
  slug: string;
  city: CitySlug;
  locality: string;
  kind: EntityKind;
  name: string;
  altNames: string[];
  pincode: string;
  lat?: number;
  lng?: number;
  facts: Record<string, string>;
  source: string;
  licence: string;
  status: 'draft' | 'ready' | 'live';
  updatedAt: string;
}
