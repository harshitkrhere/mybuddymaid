// Run: npm test (vitest) from app/
//
// The booking app fired no analytics at all (audit gap 6), so the funnel ended at the site's
// "Book in the app" click. Five moments now report through window.gtag with source 'app':
// sign-up started, onboarding completed, booking requested, the paused-checkout modal shown,
// and the modal's own WhatsApp/call buttons. Source-level for the pages (the call is the whole
// change; the flows behind them are mocked elsewhere) and a unit test for the helper itself.
import { afterEach, expect, test, vi } from 'vitest';
import { track } from './track';
import authPage from '../pages/AuthPage.jsx?raw';
import onboardingPage from '../pages/OnboardingPage.jsx?raw';
import serviceDetailPage from '../pages/ServiceDetailPage.jsx?raw';
import pricingPage from '../pages/PricingPage.jsx?raw';
import homePage from '../pages/HomePage.jsx?raw';

afterEach(() => {
  delete window.gtag;
});

test('track() sends the event through the gtag shim with source app, and is a no-op without it', () => {
  expect(() => track('anything', { x: 1 })).not.toThrow();
  window.gtag = vi.fn();
  track('booking_requested', { service: 'cook', city: 'noida', locality: 'sector-50' });
  expect(window.gtag).toHaveBeenCalledWith('event', 'booking_requested', expect.objectContaining({ source: 'app', service: 'cook', city: 'noida', page_path: expect.any(String) }));
});

test('each funnel moment in the app fires its event', () => {
  expect(authPage).toContain("track('signup_started', { method: 'google' })");
  expect(authPage).toContain("track('signup_started', { method: 'email' })");
  expect(onboardingPage).toContain("track('onboarding_completed', { city })");
  expect(serviceDetailPage).toContain("track('booking_requested', { service: serviceSlug, city: citySlug, locality: localitySlug })");
  expect(pricingPage).toContain("track('paused_modal_shown', { plan: planKey })");
  expect(pricingPage).toMatch(/paused-btn-whatsapp"\s+data-mbm-track="whatsapp_click"/);
  expect(pricingPage).toMatch(/paused-btn-phone"\s+data-mbm-track="call_click"/);
});

test('the support popup takes the number from the data layer and tags its links (audit gap 14)', () => {
  expect(serviceDetailPage).not.toContain('9355114869');
  expect(serviceDetailPage).toContain('href={`tel:${CONTACT.phoneE164}`}');
  expect(serviceDetailPage).toContain('href={`https://wa.me/${CONTACT.whatsappNumber}?text=');
  expect(serviceDetailPage).toMatch(/support-call"\s+data-mbm-track="call_click"/);
  expect(serviceDetailPage).toMatch(/support-wa"\s+data-mbm-track="whatsapp_click"/);
});

test('the home page carries no invented social proof (ASSUMPTIONS.md #47)', () => {
  expect(homePage).not.toMatch(/Rating/);
  expect(homePage).not.toMatch(/Families Served/);
  expect(homePage).not.toMatch(/24hr/);
  expect(homePage).not.toContain('Star');
});
