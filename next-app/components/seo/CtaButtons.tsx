'use client';
// components/seo/CtaButtons.tsx — WhatsApp / call / app CTAs with GA4 events carrying
// city / zone / locality / service / pincode so every lead is attributable to a page.
import { whatsappUrl, TEL_URL, PHONE_DISPLAY } from '@/lib/seo-engine/links';

export interface CtaContext {
  whatsappText: string;
  city: string;
  zone?: string;
  locality?: string;
  service?: string;
  pincode?: string;
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(event: 'whatsapp_click' | 'call_click' | 'lead_submit' | 'app_click', ctx: CtaContext) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', event, {
    city: ctx.city || '(none)',
    zone: ctx.zone || '(none)',
    locality: ctx.locality || '(none)',
    service: ctx.service || '(none)',
    pincode: ctx.pincode || '(none)',
    page_path: window.location.pathname,
  });
}

export function CtaButtons({ ctx, compact = false }: { ctx: CtaContext; compact?: boolean }) {
  const appHref = `/app/auth?ctx=${encodeURIComponent(JSON.stringify({ city: ctx.city, locality: ctx.locality, service: ctx.service }))}`;
  return (
    <div className={compact ? 'cta-row cta-row--compact' : 'cta-row'}>
      <a className="btn btn-whatsapp" href={whatsappUrl(ctx.whatsappText)} target="_blank" rel="noopener" onClick={() => track('whatsapp_click', ctx)}>
        WhatsApp us
      </a>
      <a className="btn btn-call" href={TEL_URL} onClick={() => track('call_click', ctx)}>
        Call {PHONE_DISPLAY}
      </a>
      {!compact && (
        <a className="btn btn-app" href={appHref} onClick={() => track('app_click', ctx)}>
          Book in the app
        </a>
      )}
    </div>
  );
}

/** Fixed bottom bar on mobile; the layout reserves its height so it never shifts content. */
export function StickyCta({ ctx }: { ctx: CtaContext }) {
  return (
    <div className="sticky-cta" role="complementary" aria-label="Quick contact">
      <a className="btn btn-whatsapp" href={whatsappUrl(ctx.whatsappText)} target="_blank" rel="noopener" onClick={() => track('whatsapp_click', ctx)}>
        WhatsApp
      </a>
      <a className="btn btn-call" href={TEL_URL} onClick={() => track('call_click', ctx)}>
        Call
      </a>
    </div>
  );
}
