// supabase/functions/send-package-email/index.ts
// Sends branded confirmation emails via Resend after a plan purchase.
// Supports 4 plan tiers: Silver, Gold, Diamond, Platinum — each with a unique design.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Brand Tokens ────────────────────────────────────────────────────────────
const BRAND = {
  primary: '#0D5C63',
  accent: '#F4A623',
  background: '#FAFAF7',
  dark: '#1A1A2E',
  white: '#FFFFFF',
  font: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, Arial, sans-serif",
  supportEmail: 'info@mybuddymaid.in',
  supportPhone: '+91 9599390188',
  website: 'https://mybuddymaid.in',
  from: 'MyBuddyMaid <noreply@mybuddymaid.in>',
};

// ─── CORS Headers ────────────────────────────────────────────────────────────
const ALLOWED_ORIGIN = 'https://mybuddymaid.in';
const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatCurrency(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ─── Plan meta ───────────────────────────────────────────────────────────────
interface PlanMeta {
  subject: string;
  badgeColor: string;
  badgeLabel: string;
  headerBg: string;
  opening: (name: string) => string;
  benefits: string[];
  buildExtras: (p: Payload) => string;
}

interface Payload {
  user_name: string;
  user_email: string;
  user_id: string;
  plan_name: string;
  amount_paid: number;
  razorpay_payment_id: string;
  purchased_at: string;
  replacements_total: number;
  expires_at: string;
}

const PLAN_META: Record<string, PlanMeta> = {
  // ╔═══════════════════════════════════════════════════════════════════╗
  // ║  SILVER                                                         ║
  // ╚═══════════════════════════════════════════════════════════════════╝
  silver: {
    subject: 'Your Silver Plan is Active — Welcome to MyBuddyMaid ✨',
    badgeColor: '#9CA3AF',
    badgeLabel: 'Silver Member',
    headerBg: BRAND.primary,
    opening: (n) =>
      `Congratulations ${n}, you've just taken the first step toward effortless home management.`,
    benefits: [
      '10-month free replacement guarantee',
      '3 free replacements',
      '1 curated profile delivered within 24 hours',
      'Background-checked and trained helper',
    ],
    buildExtras: (p) => {
      // Next-steps block
      return `
        <tr><td style="padding:0 0 8px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            <tr><td style="padding:24px 0 8px;font-family:${BRAND.font};font-size:18px;font-weight:700;color:${BRAND.dark};">
              What Happens Next?
            </td></tr>
            ${[
              'We review your requirements and preferences carefully.',
              'A curated profile is delivered to you within <strong>24 hours</strong>.',
              'Interview the candidate, and once you approve — we begin!',
            ]
              .map(
                (txt, i) => `
            <tr><td style="padding:8px 0;font-family:${BRAND.font};font-size:15px;color:#374151;">
              <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td width="36" valign="top" style="padding-right:12px;">
                    <div style="width:32px;height:32px;border-radius:50%;background:${BRAND.primary};color:#fff;text-align:center;line-height:32px;font-weight:700;font-size:14px;font-family:${BRAND.font};">${i + 1}</div>
                  </td>
                  <td style="font-family:${BRAND.font};font-size:15px;color:#374151;line-height:1.6;">${txt}</td>
                </tr>
              </table>
            </td></tr>`
              )
              .join('')}
          </table>
        </td></tr>`;
    },
  },

  // ╔═══════════════════════════════════════════════════════════════════╗
  // ║  GOLD                                                           ║
  // ╚═══════════════════════════════════════════════════════════════════╝
  gold: {
    subject: 'Gold Plan Confirmed — Your Premium Home Help Journey Starts Now 🏅',
    badgeColor: '#F4A623',
    badgeLabel: 'GOLD',
    headerBg: BRAND.primary,
    opening: (n) =>
      `Welcome to the Gold experience, ${n}. You're among our most popular choice — and for good reason.`,
    benefits: [
      '12-month free replacement guarantee',
      '5 free replacements',
      '3 curated profiles to choose from',
      'Enhanced background + reference checks',
      'Dedicated account manager',
    ],
    buildExtras: (_p) => {
      return `
        <tr><td style="padding:0 0 8px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#FEF3C7;border-radius:10px;">
            <tr><td style="padding:20px 24px;font-family:${BRAND.font};">
              <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td width="40" valign="top" style="font-size:28px;padding-right:14px;">👤</td>
                  <td>
                    <span style="font-size:15px;font-weight:700;color:${BRAND.dark};display:block;margin-bottom:4px;">Your Dedicated Account Manager</span>
                    <span style="font-size:14px;color:#92400E;line-height:1.5;">A personal account manager will be assigned to you within 24 hours. They'll handle everything — from matching to scheduling to any concerns down the line.</span>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td></tr>`;
    },
  },

  // ╔═══════════════════════════════════════════════════════════════════╗
  // ║  DIAMOND                                                        ║
  // ╚═══════════════════════════════════════════════════════════════════╝
  diamond: {
    subject: 'Diamond Plan Activated — Elite Home Help, Delivered in 24 Hours 💎',
    badgeColor: '#60A5FA',
    badgeLabel: 'DIAMOND',
    headerBg: BRAND.primary,
    opening: (n) =>
      `You've chosen our elite tier, ${n}. Expect nothing less than the best — hand-picked professionals, lightning-fast delivery, and white-glove support.`,
    benefits: [
      '18-month replacement guarantee',
      '10 free replacements',
      '5 curated profiles to choose from',
      'Full police verification for every candidate',
      'Guaranteed deployment within 24 hours',
      'Priority account manager available 6 days/week',
    ],
    buildExtras: (_p) => {
      return `
        <tr><td style="padding:0 0 8px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:${BRAND.primary};border-radius:10px;">
            <tr><td style="padding:22px 24px;font-family:${BRAND.font};">
              <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td width="40" valign="top" style="font-size:28px;padding-right:14px;">⚡</td>
                  <td>
                    <span style="font-size:15px;font-weight:700;color:#ffffff;display:block;margin-bottom:4px;">24-Hour Delivery Guarantee</span>
                    <span style="font-size:14px;color:#d1fae5;line-height:1.5;">We guarantee your first profile delivery within 24 hours. If we don't deliver, you'll receive a priority escalation at no extra cost.</span>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td></tr>`;
    },
  },

  // ╔═══════════════════════════════════════════════════════════════════╗
  // ║  PLATINUM                                                       ║
  // ╚═══════════════════════════════════════════════════════════════════╝
  platinum: {
    subject: 'Legacy Plan (Platinum)',
    badgeColor: '#A855F7',
    badgeLabel: 'LEGACY',
    headerBg: '#1A1A2E',
    opening: (n) => `Hello ${n}, this is a receipt for a legacy plan (Platinum).`,
    benefits: [
      'Legacy plan features',
    ],
    buildExtras: (_p) => {
      return ``;
    },
  },
};

// ─── HTML Builder ────────────────────────────────────────────────────────────

function buildEmailHtml(payload: Payload, meta: PlanMeta): string {
  const {
    user_name,
    plan_name,
    amount_paid,
    razorpay_payment_id,
    purchased_at,
    replacements_total,
    expires_at,
  } = payload;

  const isPlatinum = plan_name === 'platinum';
  const isGold = plan_name === 'gold';

  // Benefits list
  const benefitsHtml = meta.benefits
    .map(
      (b) => `
    <tr><td style="padding:6px 0;font-family:${BRAND.font};font-size:15px;color:#374151;line-height:1.6;">
      <span style="color:${BRAND.primary};font-weight:700;margin-right:8px;">✓</span>${b}
    </td></tr>`
    )
    .join('');

  // Highlight / payment box
  const highlightBg = isPlatinum ? '#1A1A2E' : BRAND.primary;
  const highlightTextColor = '#FFFFFF';
  const ribbonHtml = isGold
    ? `<tr><td align="center" style="padding:0 0 12px;">
        <div style="display:inline-block;background:${BRAND.accent};color:${BRAND.dark};font-family:${BRAND.font};font-size:12px;font-weight:800;letter-spacing:1px;padding:5px 18px;border-radius:20px;text-transform:uppercase;">⭐ Most Popular Plan</div>
       </td></tr>`
    : '';

  // Platinum VIP footer note
  const vipFooterNote = isPlatinum
    ? `<tr><td style="padding:16px 0 0;text-align:center;">
        <span style="font-family:${BRAND.font};font-size:13px;color:#C4B5FD;line-height:1.5;">
          As a Platinum member you have a direct escalation line.<br/>
          Call <strong style="color:#E9D5FF;">${BRAND.supportPhone}</strong> and press <strong style="color:#E9D5FF;">1</strong> for priority support — anytime, any day.
        </span>
       </td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
  <title>${meta.subject}</title>
  <!--[if mso]>
  <noscript><xml>
    <o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings>
  </xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${BRAND.background};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

<!-- Outer wrapper -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:${BRAND.background};">
  <tr><td align="center" style="padding:0;">

    <!-- Container 600px -->
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;max-width:600px;width:100%;">

      <!-- ═══ HEADER ═══ -->
      <tr><td style="background-color:${meta.headerBg};padding:28px 32px;text-align:center;border-radius:12px 12px 0 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <tr><td align="center">
            <span style="font-family:${BRAND.font};font-size:26px;font-weight:800;color:${BRAND.white};letter-spacing:-0.5px;">MyBuddyMaid</span>
          </td></tr>
          <tr><td align="center" style="padding-top:6px;">
            <span style="font-family:${BRAND.font};font-size:12px;color:rgba(255,255,255,0.7);letter-spacing:1.5px;text-transform:uppercase;">Redefining Home Care in India</span>
          </td></tr>
        </table>
      </td></tr>

      <!-- ═══ ACCENT BORDER ═══ -->
      <tr><td style="height:3px;background-color:${BRAND.accent};font-size:0;line-height:0;">&nbsp;</td></tr>

      <!-- ═══ BODY CARD ═══ -->
      <tr><td style="background-color:${BRAND.white};padding:40px 36px;box-shadow:0 2px 16px rgba(0,0,0,0.06);">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">

          <!-- Badge -->
          <tr><td align="center" style="padding:0 0 20px;">
            <div style="display:inline-block;background:${meta.badgeColor};color:${isPlatinum ? '#FFFFFF' : BRAND.dark};font-family:${BRAND.font};font-size:13px;font-weight:800;letter-spacing:1.2px;padding:6px 22px;border-radius:30px;text-transform:uppercase;">${meta.badgeLabel}</div>
          </td></tr>

          <!-- Greeting -->
          <tr><td style="padding:0 0 24px;font-family:${BRAND.font};font-size:16px;color:#374151;line-height:1.7;">
            ${meta.opening(user_name)}
          </td></tr>

          <!-- ─── Payment Highlight Box ─── -->
          ${ribbonHtml}
          <tr><td style="padding:0 0 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:${highlightBg};border-radius:10px;">
              <tr><td style="padding:24px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <tr><td style="font-family:${BRAND.font};font-size:13px;color:rgba(255,255,255,0.65);letter-spacing:0.5px;text-transform:uppercase;padding-bottom:6px;">Amount Paid</td></tr>
                  <tr><td style="font-family:${BRAND.font};font-size:32px;font-weight:800;color:${BRAND.accent};padding-bottom:16px;">${formatCurrency(amount_paid)}</td></tr>
                  <tr><td>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                      <tr>
                        <td width="50%" style="font-family:${BRAND.font};font-size:13px;color:rgba(255,255,255,0.6);padding:4px 0;">Payment ID</td>
                        <td width="50%" style="font-family:${BRAND.font};font-size:13px;color:${highlightTextColor};text-align:right;padding:4px 0;word-break:break-all;">${razorpay_payment_id}</td>
                      </tr>
                      <tr>
                        <td style="font-family:${BRAND.font};font-size:13px;color:rgba(255,255,255,0.6);padding:4px 0;">Date</td>
                        <td style="font-family:${BRAND.font};font-size:13px;color:${highlightTextColor};text-align:right;padding:4px 0;">${formatDate(purchased_at)}</td>
                      </tr>
                      <tr>
                        <td style="font-family:${BRAND.font};font-size:13px;color:rgba(255,255,255,0.6);padding:4px 0;">Free Replacements</td>
                        <td style="font-family:${BRAND.font};font-size:13px;color:${highlightTextColor};text-align:right;padding:4px 0;">${replacements_total}</td>
                      </tr>
                      <tr>
                        <td style="font-family:${BRAND.font};font-size:13px;color:rgba(255,255,255,0.6);padding:4px 0;">Valid Until</td>
                        <td style="font-family:${BRAND.font};font-size:13px;color:${BRAND.accent};font-weight:700;text-align:right;padding:4px 0;">${formatDate(expires_at)}</td>
                      </tr>
                    </table>
                  </td></tr>
                </table>
              </td></tr>
            </table>
          </td></tr>

          <!-- ─── Benefits ─── -->
          <tr><td style="padding:0 0 8px;font-family:${BRAND.font};font-size:18px;font-weight:700;color:${BRAND.dark};">
            What's Included
          </td></tr>
          <tr><td style="padding:0 0 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              ${benefitsHtml}
            </table>
          </td></tr>

          <!-- ─── Plan-specific extras ─── -->
          ${meta.buildExtras(payload)}

          <!-- ─── CTA ─── -->
          <tr><td align="center" style="padding:28px 0 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr><td align="center" style="border-radius:50px;background:${BRAND.accent};">
                <a href="${BRAND.website}/pricing" target="_blank" style="display:inline-block;padding:14px 32px;font-family:${BRAND.font};font-size:15px;font-weight:700;color:${BRAND.dark};text-decoration:none;border-radius:50px;letter-spacing:0.3px;">View My Plan →</a>
              </td></tr>
            </table>
          </td></tr>

        </table>
      </td></tr>

      <!-- ═══ FOOTER ═══ -->
      <tr><td style="background-color:${BRAND.dark};padding:32px 36px;border-radius:0 0 12px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <tr><td align="center" style="padding:0 0 12px;">
            <span style="font-family:${BRAND.font};font-size:18px;font-weight:700;color:${BRAND.white};">MyBuddyMaid</span>
          </td></tr>
          <tr><td align="center" style="padding:0 0 8px;">
            <span style="font-family:${BRAND.font};font-size:13px;color:rgba(255,255,255,0.55);line-height:1.6;">
              Questions? Reach us at <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.accent};text-decoration:none;">${BRAND.supportEmail}</a>
              &nbsp;or call <a href="tel:${BRAND.supportPhone}" style="color:${BRAND.accent};text-decoration:none;">${BRAND.supportPhone}</a>
            </span>
          </td></tr>
          <tr><td align="center" style="padding:0 0 4px;">
            <a href="${BRAND.website}" target="_blank" style="font-family:${BRAND.font};font-size:13px;color:rgba(255,255,255,0.45);text-decoration:none;">${BRAND.website}</a>
          </td></tr>
          ${vipFooterNote}
          <tr><td align="center" style="padding:16px 0 0;">
            <span style="font-family:${BRAND.font};font-size:11px;color:rgba(255,255,255,0.3);">© ${new Date().getFullYear()} MyBuddyMaid. All rights reserved.</span>
          </td></tr>
        </table>
      </td></tr>

    </table>
    <!-- /Container -->

  </td></tr>
</table>
</body>
</html>`;
}

// ─── Main Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  // ── Preflight ──
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // ── Supabase admin client ──
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let payload: Payload | undefined;

  try {
    // ── Parse body ──
    payload = (await req.json()) as Payload;

    // ── Validate required fields ──
    const required: (keyof Payload)[] = [
      'user_name',
      'user_email',
      'user_id',
      'plan_name',
      'amount_paid',
      'razorpay_payment_id',
      'purchased_at',
      'replacements_total',
      'expires_at',
    ];

    const missing = required.filter(
      (f) => payload![f] === undefined || payload![f] === null || payload![f] === ''
    );

    if (missing.length > 0) {
      return jsonResponse(
        { error: `Missing required fields: ${missing.join(', ')}` },
        400
      );
    }

    const planKey = payload.plan_name.toLowerCase();
    const meta = PLAN_META[planKey];

    if (!meta) {
      return jsonResponse(
        { error: `Unknown plan: ${payload.plan_name}. Expected: silver, gold, diamond, platinum.` },
        400
      );
    }

    // ── Build email ──
    const html = buildEmailHtml({ ...payload, plan_name: planKey }, meta);

    // ── Send via Resend ──
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      throw new Error('RESEND_API_KEY environment variable is not set.');
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: BRAND.from,
        to: [payload.user_email],
        reply_to: BRAND.supportEmail,
        subject: meta.subject,
        html,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      // Log failure
      await supabaseAdmin.from('email_logs').insert({
        user_id: payload.user_id,
        email_type: `package_${planKey}`,
        recipient_email: payload.user_email,
        status: 'failed',
        resend_response: resendData,
        error_message: resendData?.message || resendData?.error || 'Resend API error',
      });

      return jsonResponse(
        { error: 'Failed to send email via Resend', details: resendData },
        502
      );
    }

    // Log success
    await supabaseAdmin.from('email_logs').insert({
      user_id: payload.user_id,
      email_type: `package_${planKey}`,
      recipient_email: payload.user_email,
      status: 'sent',
      resend_response: resendData,
      error_message: null,
    });

    return jsonResponse({ success: true, email_id: resendData.id });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[send-package-email] Unhandled error:', errorMsg);

    // Attempt to log even on unexpected errors
    if (payload?.user_id && payload?.user_email && payload?.plan_name) {
      try {
        await supabaseAdmin.from('email_logs').insert({
          user_id: payload.user_id,
          email_type: `package_${payload.plan_name.toLowerCase()}`,
          recipient_email: payload.user_email,
          status: 'failed',
          resend_response: null,
          error_message: errorMsg,
        });
      } catch {
        // Swallow — we don't want logging to mask the original error
      }
    }

    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
