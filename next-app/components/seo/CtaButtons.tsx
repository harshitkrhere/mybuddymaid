// components/seo/CtaButtons.tsx — server-rendered CTAs. These carry no React event
// handlers: they are plain anchors tagged with data-mbm-* attributes, and a single
// delegated listener in the root layout turns a click into a GA4 event. That keeps every
// SEO page free of a client boundary (no hydration cost) while preserving locality-level
// lead attribution.
import { whatsappUrl, TEL_URL, PHONE_DISPLAY } from '@/lib/seo-engine/links';
import { PURCHASES_PAUSED } from '@/data/seo';
import { SUPPORT_HOURS } from '@/data/seo/contact';

export interface CtaContext {
  whatsappText: string;
  city: string;
  zone?: string;
  locality?: string;
  service?: string;
  pincode?: string;
  /** The society page the visitor is on (Phase 5), so a call-back request is attributed to it. */
  entity?: string;
}

/**
 * The attributes the delegated listener in components/shared/Analytics.tsx reads. Every
 * WhatsApp, call and app link on the site should carry them — the footer, the contact page
 * and the header included — or its clicks are invisible in the funnel.
 */
export function trackAttrs(event: string, ctx: CtaContext) {
  return {
    'data-mbm-track': event,
    'data-mbm-city': ctx.city || '(none)',
    'data-mbm-zone': ctx.zone || '(none)',
    'data-mbm-locality': ctx.locality || '(none)',
    'data-mbm-service': ctx.service || '(none)',
    'data-mbm-pincode': ctx.pincode || '(none)',
  };
}

/** Context for a link with no page locality behind it (footer, header, contact page). */
export const NO_CONTEXT: CtaContext = { whatsappText: '', city: '' };

/**
 * The published reply promise beside every WhatsApp and call button (A3). From
 * data/seo/contact.ts, so it cannot drift from the terms (§14.4), the booking app's modal or
 * the assistant's out-of-hours line.
 */
export function replyTimeLine(): string {
  return `Replies ${SUPPORT_HOURS.label}. Outside these hours we reply within ${SUPPORT_HOURS.replyWithinHours} hours.`;
}

/** A page with no locality behind it (a guide, the services index): only the prefilled message varies. */
export function siteContext(whatsappText: string, extra: Partial<CtaContext> = {}): CtaContext {
  return { whatsappText, city: '', ...extra };
}

export function CtaButtons({ ctx, compact = false, hero = false }: { ctx: CtaContext; compact?: boolean; hero?: boolean }) {
  const appHref = `/app/auth?city=${encodeURIComponent(ctx.city)}&locality=${encodeURIComponent(ctx.locality ?? '')}&service=${encodeURIComponent(ctx.service ?? '')}`;
  // While online checkout is paused a booking closes on WhatsApp or the phone, so in the hero
  // the app is a text link and WhatsApp is the button that reads as primary (FIN-U04, A6). The
  // closing CTA and the sticky bar keep their rows as they were.
  const appAsLink = hero && PURCHASES_PAUSED;
  return (
    <div className={compact ? 'cta-block cta-block--compact' : 'cta-block'}>
      <div className={compact ? 'cta-row cta-row--compact' : 'cta-row'}>
        <a className="btn btn-whatsapp" href={whatsappUrl(ctx.whatsappText)} target="_blank" rel="noopener" {...trackAttrs('whatsapp_click', ctx)}>
          WhatsApp us
        </a>
        <a className="btn btn-call" href={TEL_URL} {...trackAttrs('call_click', ctx)}>
          Call {PHONE_DISPLAY}
        </a>
        {!compact && !appAsLink && (
          <a className="btn btn-app" href={appHref} {...trackAttrs('app_click', ctx)}>
            Book in the app
          </a>
        )}
      </div>
      {!compact && <p className="cta-note">{replyTimeLine()}</p>}
      {appAsLink && (
        <p className="cta-alt">
          or{' '}
          <a className="cta-link" href={appHref} {...trackAttrs('app_click', ctx)}>
            book in the app
          </a>
        </p>
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
