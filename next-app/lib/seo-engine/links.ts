// lib/seo-engine/links.ts — internal-link helpers: URL builders and anchor-text
// rotation (4–5 natural variants per target, Appendix D) so anchors vary without spam.
import type { Locality, Service } from '@/data/seo/types';
import { hashKey } from './faqs';

export const paths = {
  city: (city: string) => `/${city}`,
  zone: (city: string, zone: string) => `/${city}/${zone}`,
  locality: (city: string, loc: string) => `/${city}/${loc}`,
  serviceLocality: (city: string, loc: string, svc: string) => `/${city}/${loc}/${svc}`,
  serviceHub: (svc: string) => `/services/${svc}`,
  serviceCity: (svc: string, city: string) => `/services/${svc}/${city}`,
  pincode: (pin: string) => `/pincode/${pin}`,
};

const LOCALITY_ANCHORS = [
  (n: string) => `maid service in ${n}`,
  (n: string) => `maids in ${n}`,
  (n: string) => `${n} house help`,
  (n: string) => `hire a verified maid in ${n}`,
  (n: string) => `domestic help in ${n}`,
];

/** Anchor text for a link to a locality hub, rotated by (source page, target). */
export function localityAnchor(target: Locality, fromKey: string): string {
  const v = LOCALITY_ANCHORS[hashKey(`${fromKey}→${target.slug}`) % LOCALITY_ANCHORS.length];
  return v(target.name);
}

const SERVICE_ANCHORS = [
  (s: string, n: string) => `${s.toLowerCase()} in ${n}`,
  (s: string, n: string) => `${n} ${s.toLowerCase()}`,
  (s: string, n: string) => `hire a ${s.toLowerCase()} in ${n}`,
  (s: string, n: string) => `verified ${s.toLowerCase()} for ${n}`,
];

export function serviceLocalityAnchor(svc: Service, target: Locality, fromKey: string): string {
  const v = SERVICE_ANCHORS[hashKey(`${fromKey}→${target.slug}/${svc.slug}`) % SERVICE_ANCHORS.length];
  return v(svc.name, target.name);
}

export function whatsappUrl(text: string): string {
  return `https://wa.me/919355114869?text=${encodeURIComponent(text)}`;
}
/**
 * The prefilled WhatsApp message for a plan. Identical to the sentence the booking app's
 * paused-checkout modal composes (app/src/pages/PricingPage.jsx); links.test.ts checks both.
 */
export function planWhatsappText(planName: string): string {
  return `Hi MyBuddyMaid, I would like to book the ${planName} package. Please help me complete the booking.`;
}

/**
 * Where a plan CTA sends the visitor. While online checkout is paused the conversion happens on
 * WhatsApp, so the button goes there directly with the plan named, instead of through sign-up,
 * onboarding and a modal that says the same thing eight steps later (FIN-U01). When checkout is
 * live the button opens the app with the plan carried as context (FIN-B02).
 */
export function planCtaHref(plan: { key: string; name: string }, paused: boolean): string {
  return paused ? whatsappUrl(planWhatsappText(plan.name)) : `/app/auth?plan=${encodeURIComponent(plan.key)}`;
}

export const TEL_URL = 'tel:+919355114869';
export const PHONE_DISPLAY = '+91 93551 14869';
