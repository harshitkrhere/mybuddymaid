// data/seo/services.ts — the six page-generating services (Appendix A).
// The umbrella "Maid Service" is NOT a seventh per-locality page: it is owned by the
// hub pages (home, city, zone, locality) and one national overview at
// /services/maid-service. Postnatal care is folded into babysitter-nanny as on-page
// variants (operator decision, ASSUMPTIONS.md #3).
//
// Pricing bands derive from the company's own published app prices (ASSUMPTIONS.md #4):
// part-time ₹5,000 · cook ₹12,000 · nanny ₹16,000 · elder-care ₹17,000 ·
// full-time ₹19,000/mo. Bands are identical across tiers until the operator supplies
// per-tier values; every band is rendered as indicative "starting from" copy.
import type { PricingTier, Service, ServicePricingBand } from './types';
import { SERVICE_FAQ_POOLS } from './faqs/service-faqs';

const UPDATED = '2026-09-05';

const band = (from: number, to: number): Record<PricingTier, ServicePricingBand> => ({
  'metro-premium': { from, to, unit: 'month' },
  metro: { from, to, unit: 'month' },
  'tier-2': { from, to, unit: 'month' },
});

export const SERVICES: Service[] = [
  {
    slug: 'full-time-maid',
    name: 'Full-Time Maid',
    altNames: [
      'full time maid',
      'full day maid',
      '8-hour maid',
      '10-hour maid',
      '12-hour maid',
      'live-in maid',
      '24 hours maid',
      'permanent maid',
    ],
    shortDescription:
      'A dedicated helper for 8–12 hours a day (or live-in) who handles all daily household chores.',
    modes: ['full-time', 'live-in'],
    tasksIncluded: [
      'Sweeping, mopping and dusting the whole home',
      'Washing utensils and kitchen cleanup',
      'Laundry, ironing and wardrobe upkeep',
      'Bathroom and balcony cleaning',
      'Bed-making and daily tidying',
      'Basic kitchen prep (chopping, kneading) if agreed',
    ],
    tasksExcluded: [
      'Full meal cooking (hire a Cook, or agree it explicitly as an add-on)',
      'Childcare as a primary duty (hire a Babysitter/Nanny)',
      'Medical or nursing care',
      'Deep-cleaning projects like sofa or water-tank cleaning',
    ],
    typicalHours: '8–12 hours/day, 6 days a week; live-in stays at your home with weekly time off',
    pricing: band(16000, 26000),
    faqPool: SERVICE_FAQ_POOLS['full-time-maid'] ?? [],
    relatedServices: ['part-time-maid', 'domestic-help', 'cook'],
    updatedAt: UPDATED,
  },
  {
    slug: 'part-time-maid',
    name: 'Part-Time Maid',
    altNames: [
      'part time maid',
      'hourly maid',
      'morning maid',
      'evening maid',
      'cleaning maid',
      'jhadu-pocha maid',
      'bartan maid',
    ],
    shortDescription:
      'Task-based help for 1–4 hours a day — sweeping-mopping, utensils, dusting and laundry on a fixed daily slot.',
    modes: ['part-time', 'hourly'],
    tasksIncluded: [
      'Sweeping and mopping (jhadu-pocha)',
      'Washing utensils (bartan)',
      'Dusting and surface cleaning',
      'Laundry and hanging clothes',
      'Kitchen counter and stove wipe-down',
    ],
    tasksExcluded: [
      'Cooking meals (hire a Cook)',
      'Childcare or elder care duties',
      'Deep-cleaning projects',
      'Staying beyond the agreed slot without a revised arrangement',
    ],
    typicalHours: '1–4 hours/day in a fixed morning or evening slot, 6–7 days a week',
    pricing: band(4500, 9000),
    faqPool: SERVICE_FAQ_POOLS['part-time-maid'] ?? [],
    relatedServices: ['full-time-maid', 'domestic-help', 'cook'],
    updatedAt: UPDATED,
  },
  {
    slug: 'cook',
    name: 'Cook',
    altNames: [
      'cook service',
      'home cook',
      'cooking maid',
      'cook at home',
      'veg cook',
      'non-veg cook',
      'morning cook',
      'full-time cook',
      'part-time cook',
    ],
    shortDescription:
      'A home cook for one or more daily meal slots, matched to your cuisine and diet preferences.',
    modes: ['full-time', 'part-time', 'live-in'],
    tasksIncluded: [
      'Cooking breakfast, lunch and/or dinner as agreed',
      'Veg or non-veg cooking per household preference',
      'Kitchen prep — chopping, kneading, marination',
      'Post-cooking kitchen cleanup',
      'Tiffin/dabba preparation if agreed',
    ],
    tasksExcluded: [
      'House cleaning beyond the kitchen (hire a maid)',
      'Grocery shopping unless explicitly agreed',
      'Catering for large events',
      'Childcare or elder care duties',
    ],
    typicalHours: '1–2 hours per meal slot for part-time; full day for full-time cooks',
    pricing: band(10000, 18000),
    faqPool: SERVICE_FAQ_POOLS['cook'] ?? [],
    relatedServices: ['part-time-maid', 'full-time-maid', 'domestic-help'],
    updatedAt: UPDATED,
  },
  {
    slug: 'babysitter-nanny',
    name: 'Babysitter / Nanny',
    altNames: [
      'babysitter',
      'nanny',
      'child caretaker',
      'aaya',
      'full-time nanny',
      'live-in nanny',
      'baby care taker',
      'japa maid',
      'postnatal care',
    ],
    shortDescription:
      'Trained childcare help for infants, toddlers and school-age children — including japa/postnatal support for newborns and mothers.',
    modes: ['full-time', 'part-time', 'live-in'],
    tasksIncluded: [
      'Feeding, bathing and dressing the child',
      'Nap-time and daily routine management',
      'Age-appropriate play and supervision',
      'Preparing baby food and bottles',
      'School pickup/drop support if agreed',
      'Japa/postnatal newborn and mother care (massage, feeding support) where requested',
    ],
    tasksExcluded: [
      'Medical or nursing procedures',
      'Full household cleaning (light child-related tidying only)',
      'Cooking for the whole family (hire a Cook)',
      'Tutoring beyond basic homework supervision',
    ],
    typicalHours: 'Part-time slots to full-day 8–12 hours; live-in for newborn/japa care',
    pricing: band(14000, 24000),
    faqPool: SERVICE_FAQ_POOLS['babysitter-nanny'] ?? [],
    relatedServices: ['elder-care', 'full-time-maid', 'cook'],
    updatedAt: UPDATED,
  },
  {
    slug: 'elder-care',
    name: 'Elder Care',
    altNames: [
      'elder care maid',
      'caretaker for elderly',
      'senior citizen caretaker',
      'old age care at home',
      'patient attendant',
    ],
    shortDescription:
      'Non-medical companionship and daily assistance for senior citizens at home — mobility support, meals, medication reminders and company.',
    modes: ['full-time', 'live-in', 'part-time'],
    tasksIncluded: [
      'Companionship and supervision through the day',
      'Mobility and walking assistance',
      'Meal serving and feeding assistance',
      'Medication reminders (not administration)',
      'Hygiene and grooming assistance',
      'Accompanying on walks and doctor visits',
    ],
    tasksExcluded: [
      'Nursing procedures — injections, wound care, catheters (this is non-medical care)',
      'Physiotherapy or medical treatment',
      'Heavy household cleaning (hire a maid alongside)',
      'Administering medicines',
    ],
    typicalHours: '8–12 hours/day or live-in; part-time slots for daily check-in care',
    pricing: band(15000, 25000),
    faqPool: SERVICE_FAQ_POOLS['elder-care'] ?? [],
    relatedServices: ['babysitter-nanny', 'full-time-maid', 'domestic-help'],
    updatedAt: UPDATED,
  },
  {
    slug: 'domestic-help',
    name: 'Domestic Help',
    altNames: [
      'domestic helper',
      'house help',
      'household help',
      'all-rounder helper',
      'housekeeping helper',
    ],
    shortDescription:
      'An all-rounder housekeeping helper — cleaning, utensils, laundry and dusting combined, part-time or full-time.',
    modes: ['full-time', 'part-time'],
    tasksIncluded: [
      'General housekeeping — sweeping, mopping, dusting',
      'Utensils and kitchen cleanup',
      'Laundry and ironing',
      'Organising and tidying rooms',
      'Light errands within the society if agreed',
    ],
    tasksExcluded: [
      'Full meal cooking (hire a Cook)',
      'Primary childcare or elder care',
      'Driving or outdoor errands beyond the society',
      'Deep-cleaning projects',
    ],
    typicalHours: '2–4 hours/day part-time up to 8–12 hours/day full-time',
    pricing: band(5000, 19000),
    faqPool: SERVICE_FAQ_POOLS['domestic-help'] ?? [],
    relatedServices: ['part-time-maid', 'full-time-maid', 'cook'],
    updatedAt: UPDATED,
  },
];

export const SERVICE_BY_SLUG = new Map(SERVICES.map((s) => [s.slug, s]));

/** Legacy service slug → new service slug (redirect map + old anchor mapping). */
export const LEGACY_SERVICE_MAP: Record<string, string | null> = {
  maid: null, // legacy umbrella "maid-service" pages → locality/city hubs, not a service page
  'full-time-maid': 'full-time-maid',
  cook: 'cook',
  nanny: 'babysitter-nanny',
  'elderly-care': 'elder-care',
  'postnatal-care': 'babysitter-nanny',
};
