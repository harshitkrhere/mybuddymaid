// components/seo/CtaButtons.tsx — server-rendered CTAs. These carry no React event
// handlers: they are plain anchors tagged with data-mbm-* attributes, and a single
// delegated listener in the root layout turns a click into a GA4 event. That keeps every
// SEO page free of a client boundary (no hydration cost) while preserving locality-level
// lead attribution.
import { whatsappUrl, TEL_URL, PHONE_DISPLAY } from '@/lib/seo-engine/links';

export interface CtaContext {
  whatsappText: string;
  city: string;
  zone?: string;
  locality?: string;
  service?: string;
  pincode?: string;
}

function trackAttrs(event: string, ctx: CtaContext) {
  return {
    'data-mbm-track': event,
    'data-mbm-city': ctx.city || '(none)',
    'data-mbm-zone': ctx.zone || '(none)',
    'data-mbm-locality': ctx.locality || '(none)',
    'data-mbm-service': ctx.service || '(none)',
    'data-mbm-pincode': ctx.pincode || '(none)',
  };
}

export function CtaButtons({ ctx, compact = false }: { ctx: CtaContext; compact?: boolean }) {
  const appHref = `/app/auth?city=${encodeURIComponent(ctx.city)}&locality=${encodeURIComponent(ctx.locality ?? '')}&service=${encodeURIComponent(ctx.service ?? '')}`;
  return (
    <div className={compact ? 'cta-row cta-row--compact' : 'cta-row'}>
      <a className="btn btn-whatsapp" href={whatsappUrl(ctx.whatsappText)} target="_blank" rel="noopener" {...trackAttrs('whatsapp_click', ctx)}>
        WhatsApp us
      </a>
      <a className="btn btn-call" href={TEL_URL} {...trackAttrs('call_click', ctx)}>
        Call {PHONE_DISPLAY}
      </a>
      {!compact && (
        <a className="btn btn-app" href={appHref} {...trackAttrs('app_click', ctx)}>
          Book in the app
        </a>
      )}
    </div>
  );
}

/** Fixed bottom bar on mobile; body padding reserves its height so it never shifts content. */
export function StickyCta({ ctx }: { ctx: CtaContext }) {
  return (
    <div className="sticky-cta" role="complementary" aria-label="Quick contact">
      <a className="btn btn-whatsapp" href={whatsappUrl(ctx.whatsappText)} target="_blank" rel="noopener" {...trackAttrs('whatsapp_click', ctx)}>
        WhatsApp
      </a>
      <a className="btn btn-call" href={TEL_URL} {...trackAttrs('call_click', ctx)}>
        Call
      </a>
    </div>
  );
}
