// data/blog/tags.ts — what each guide is about, so location pages can link the guide that
// fits them and each guide can link the places it applies to. posts.ts is generated from
// the legacy site and left as content; this file is the curated layer on top of it.
//
// The locality lock applies here too: a guide for a city outside the footprint keeps its
// URL (it may have links pointing at it) but is never linked from a location page, and its
// own "where we serve" block lists the cities we actually serve.
import type { CitySlug, ServiceSlug } from '@/data/seo/types';

export type GuideKind = 'city-guide' | 'service-guide' | 'trust' | 'general';

export interface BlogTags {
  kind: GuideKind;
  cities?: CitySlug[];
  services?: ServiceSlug[];
  /** The guide is about a city we do not serve; never linked from a location page. */
  outsideFootprint?: boolean;
}

export const BLOG_TAGS: Record<string, BlogTags> = {
  // city guides — the topical-authority anchors the brief asks for, one per Tier-1 city
  'domestic-help-guide-bangalore-2026': { kind: 'city-guide', cities: ['bangalore'] },
  'domestic-help-guide-delhi-2026': { kind: 'city-guide', cities: ['delhi'] },
  'domestic-help-guide-gurugram-2026': { kind: 'city-guide', cities: ['gurgaon'] },
  'domestic-help-guide-mumbai-2026': { kind: 'city-guide', cities: ['mumbai'] },
  'domestic-help-guide-noida-2026': { kind: 'city-guide', cities: ['noida', 'greater-noida'] },
  'domestic-help-guide-pune-2026': { kind: 'city-guide', cities: ['pune'] },
  'find-reliable-maid-delhi': { kind: 'city-guide', cities: ['delhi', 'noida', 'gurgaon', 'greater-noida'] },
  // city guides for places outside the footprint — kept, not linked from location pages
  'domestic-help-guide-chennai-2026': { kind: 'city-guide', outsideFootprint: true },
  'domestic-help-guide-hyderabad-2026': { kind: 'city-guide', outsideFootprint: true },
  'domestic-help-guide-jaipur-2026': { kind: 'city-guide', outsideFootprint: true },
  'domestic-help-guide-kolkata-2026': { kind: 'city-guide', outsideFootprint: true },
  // service guides
  'hiring-cook-for-indian-home-guide': { kind: 'service-guide', services: ['cook'] },
  'swiggy-vs-home-cook-cost-comparison': { kind: 'service-guide', services: ['cook'] },
  'maid-vs-cook-which-to-hire': { kind: 'service-guide', services: ['cook', 'part-time-maid'] },
  'when-to-hire-nanny-for-baby': { kind: 'service-guide', services: ['babysitter-nanny'] },
  'nanny-vs-daycare-india': { kind: 'service-guide', services: ['babysitter-nanny'] },
  'postnatal-care-traditions-india': { kind: 'service-guide', services: ['babysitter-nanny'] },
  'elderly-care-at-home-complete-guide': { kind: 'service-guide', services: ['elder-care'] },
  'elderly-care-at-home-guide': { kind: 'service-guide', services: ['elder-care'] },
  'elderly-care-home-vs-caregiver': { kind: 'service-guide', services: ['elder-care'] },
  'how-to-hire-maid-india-2026': { kind: 'service-guide', services: ['full-time-maid', 'part-time-maid'] },
  'part-time-vs-full-time-maid': { kind: 'service-guide', services: ['part-time-maid', 'full-time-maid'] },
  'managing-live-in-maid-india-guide': { kind: 'service-guide', services: ['full-time-maid'] },
  'home-help-hiring-checklist-india': { kind: 'service-guide', services: ['domestic-help'] },
  'maid-vs-cook-vs-nanny': { kind: 'service-guide', services: ['domestic-help'] },
  // trust — the verification story, linked from locality hubs
  'how-to-verify-maid-background-india': { kind: 'trust' },
  'verified-vs-unverified-maid': { kind: 'trust' },
  '10-questions-to-ask-before-hiring-maid': { kind: 'trust' },
  'maid-theft-prevention-tips-india': { kind: 'trust' },
  // general
  'cctv-for-monitoring-maid-india': { kind: 'general' },
  'domestic-worker-rights-india-2026': { kind: 'general' },
  'festival-bonus-guide-domestic-help-india': { kind: 'general' },
  'how-to-manage-domestic-help-india': { kind: 'general' },
  'maid-salary-trends-india-2026': { kind: 'general' },
  'work-life-balance-with-domestic-help': { kind: 'general' },
};

export const tagsOf = (slug: string): BlogTags => BLOG_TAGS[slug] ?? { kind: 'general' };

/** Guides that fit a city, in file order (stable). */
export function cityGuides(city: string): string[] {
  return Object.entries(BLOG_TAGS)
    .filter(([, t]) => t.kind === 'city-guide' && !t.outsideFootprint && t.cities?.includes(city as CitySlug))
    .map(([slug]) => slug);
}

/** Guides that fit a service, in file order (stable). */
export function serviceGuides(service: string): string[] {
  return Object.entries(BLOG_TAGS)
    .filter(([, t]) => t.kind === 'service-guide' && t.services?.includes(service as ServiceSlug))
    .map(([slug]) => slug);
}

export const TRUST_GUIDES: string[] = Object.entries(BLOG_TAGS)
  .filter(([, t]) => t.kind === 'trust')
  .map(([slug]) => slug);
