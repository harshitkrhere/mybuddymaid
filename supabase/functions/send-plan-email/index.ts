// Supabase Edge Function: send-plan-email
// Sends a branded confirmation email via Resend after a plan purchase.

const ALLOWED_ORIGIN = 'https://mybuddymaid.in';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLAN_CONFIG = {
  silver:   { emoji: '🥈', label: 'Silver Package',   color: '#475569', bg: '#1e293b', badge: 'SILVER MEMBER',   validity: '90 Days',  contacts: '1 Verified Profile',       replacements: '3 Free Replacements' },
  gold:     { emoji: '🥇', label: 'Gold Package',     color: '#b45309', bg: '#1c1007', badge: 'GOLD MEMBER',     validity: '180 Days', contacts: '3 Verified Profiles',      replacements: '5 Free Replacements' },
  diamond:  { emoji: '💎', label: 'Diamond Package',   color: '#0f766e', bg: '#042f2e', badge: 'DIAMOND MEMBER',  validity: '365 Days', contacts: '5 Verified Profiles',      replacements: '10 Free Replacements' },
  platinum: { emoji: '👑', label: 'Platinum Package',  color: '#7c3aed', bg: '#1e0a3c', badge: 'PLATINUM VIP',    validity: '456 Days', contacts: 'Up to 15 Replacements',    replacements: '15 Free Replacements' },
};

const PLAN_FEATURES = {
  silver: [
    '90-Day Free Replacement Guarantee',
    'Access to Standard Verified Buddy Pool',
    'Aadhaar & Basic Background Verification',
    '1 Curated Buddy Profile Shared',
    'Refund Policy Applicable (T&C Apply)',
  ],
  gold: [
    '180-Day Free Replacement Guarantee',
    'Access to Premium Verified Buddy Pool',
    'Enhanced Reference & Background Checks',
    '3 Curated Buddy Profiles Shared',
    'Dedicated Account Manager Assigned',
  ],
  diamond: [
    '365-Day Free Replacement Guarantee',
    'Access to Elite Verified Buddy Pool',
    'Comprehensive Police & Background Check',
    '5 Curated Buddy Profiles Shared',
    'Priority 24hr Deployment',
  ],
  platinum: [
    '456-Day Free Replacement Guarantee',
    'Up to 15 Complimentary Replacements',
    'VIP Concierge Verified Buddy Pool',
    'Full Police + Medical Background Screening',
    '24×7 Priority Concierge Account Manager',
    'Same-Day Emergency Deployment',
  ],
};

function buildEmailHtml(data) {
  const cfg = PLAN_CONFIG[data.plan_name] || PLAN_CONFIG.silver;
  const features = PLAN_FEATURES[data.plan_name] || PLAN_FEATURES.silver;
  const amount = `₹${(data.amount_paid / 100).toLocaleString('en-IN')}`;
  const name = data.user_name || 'Valued Customer';
  const paymentId = data.payment_id || 'N/A';

  const featuresHtml = features.map(f =>
    `<tr><td style="padding:11px 18px;font-size:14px;color:#1e293b;border-bottom:1px solid #f1f5f9;line-height:1.5;">
      <span style="color:${cfg.color};font-weight:800;margin-right:10px;">✓</span>${f}
    </td></tr>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:48px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.08);">

<!-- Header -->
<tr><td style="background:${cfg.bg};padding:28px 36px 24px;text-align:center;">
  <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:3px;color:${cfg.color};text-transform:uppercase;">${cfg.badge}</p>
  <h1 style="margin:0;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">MyBuddyMaid</h1>
  <p style="margin:8px 0 0;font-size:12px;color:rgba(255,255,255,0.45);letter-spacing:1px;">YOUR TRUSTED HOME HELP PARTNER</p>
</td></tr>

<!-- Confirmation -->
<tr><td style="padding:36px 36px 28px;text-align:center;border-bottom:3px solid ${cfg.color};">
  <div style="font-size:48px;margin-bottom:16px;">${cfg.emoji}</div>
  <h2 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0f172a;">Payment Confirmed!</h2>
  <p style="margin:0 0 6px;font-size:15px;color:#334155;font-weight:600;">Welcome to <span style="color:${cfg.color};">${cfg.label}</span></p>
  <p style="margin:0;font-size:13px;color:#64748b;font-style:italic;">Your home help journey starts here.</p>
</td></tr>

<!-- Greeting -->
<tr><td style="padding:28px 36px 0;">
  <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.7;">Dear <strong style="color:#0f172a;">${name}</strong>,</p>
  <p style="margin:0 0 18px;font-size:15px;color:#334155;line-height:1.75;">Thank you for choosing MyBuddyMaid! Your payment of <strong style="color:${cfg.color};font-size:17px;">${amount}</strong> has been successfully received and verified.</p>
  <p style="margin:0 0 28px;font-size:15px;color:#334155;line-height:1.75;">Our placement team will reach out <strong>within 30 minutes</strong> during business hours (8 AM – 9 PM IST) with your verified buddy profiles.</p>
</td></tr>

<!-- Order Summary -->
<tr><td style="padding:0 36px 28px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
    <tr><td style="padding:14px 20px;background:${cfg.bg};">
      <p style="margin:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.6);">Order Summary</p>
    </td></tr>
    <tr><td style="padding:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:8px 0;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;">Package</td><td style="padding:8px 0;font-size:13px;font-weight:700;color:#0f172a;text-align:right;border-bottom:1px solid #f1f5f9;">${cfg.emoji} ${cfg.label}</td></tr>
        <tr><td style="padding:8px 0;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;">Amount Paid</td><td style="padding:8px 0;font-size:17px;font-weight:800;color:${cfg.color};text-align:right;border-bottom:1px solid #f1f5f9;">${amount}</td></tr>
        <tr><td style="padding:8px 0;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;">Validity</td><td style="padding:8px 0;font-size:13px;font-weight:600;color:#0f172a;text-align:right;border-bottom:1px solid #f1f5f9;">${cfg.validity}</td></tr>
        <tr><td style="padding:8px 0;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;">Profiles / Replacements</td><td style="padding:8px 0;font-size:13px;font-weight:600;color:#0f172a;text-align:right;border-bottom:1px solid #f1f5f9;">${cfg.contacts}</td></tr>
        <tr><td style="padding:8px 0;font-size:12px;color:#94a3b8;">Payment ID</td><td style="padding:8px 0;font-size:11px;color:#94a3b8;text-align:right;word-break:break-all;">${paymentId}</td></tr>
      </table>
    </td></tr>
  </table>
</td></tr>

<!-- Features -->
<tr><td style="padding:0 36px 28px;">
  <p style="margin:0 0 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;">What Your ${cfg.label} Includes</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    ${featuresHtml}
  </table>
</td></tr>

<!-- Next Steps -->
<tr><td style="padding:0 36px 28px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;">
    <tr><td style="padding:20px 24px;">
      <p style="margin:0 0 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#15803d;">What Happens Next</p>
      <ol style="margin:0;padding-left:20px;color:#166534;font-size:14px;line-height:2;">
        <li>Our team contacts you within 30 minutes</li>
        <li>We share verified buddy profiles matching your needs</li>
        <li>You interview and select your preferred candidate</li>
        <li>Your buddy is deployed — with replacement guarantee!</li>
      </ol>
    </td></tr>
  </table>
</td></tr>

<!-- CTA -->
<tr><td style="padding:0 36px 32px;text-align:center;">
  <a href="https://mybuddymaid.in/home" style="display:inline-block;background:${cfg.bg};color:#ffffff;text-decoration:none;padding:16px 44px;border-radius:10px;font-size:14px;font-weight:700;letter-spacing:0.5px;border:2px solid ${cfg.color};">Go to Dashboard →</a>
  <p style="margin:20px 0 0;font-size:13px;color:#94a3b8;line-height:1.7;">Have a question? Reply to this email or WhatsApp us.<br><strong style="color:#475569;">info@mybuddymaid.in</strong></p>
</td></tr>

<!-- Footer -->
<tr><td style="background:#f8fafc;padding:20px 36px;text-align:center;border-top:1px solid #e2e8f0;">
  <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.8;">© 2026 MyBuddyMaid · India's Trusted Home Help Network<br>
  <a href="https://mybuddymaid.in" style="color:${cfg.color};text-decoration:none;">mybuddymaid.in</a></p>
</td></tr>

</table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const data = await req.json();
    const { user_email, user_name, plan_name, amount_paid, payment_id } = data;

    if (!user_email || !plan_name) {
      throw new Error('Missing required fields: user_email, plan_name');
    }

    const cfg = PLAN_CONFIG[plan_name];
    if (!cfg) throw new Error('Invalid plan name: ' + plan_name);

    const emailHtml = buildEmailHtml(data);

    // Send via Resend API
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `MyBuddyMaid <info@mybuddymaid.in>`,
        to: [user_email],
        subject: `${cfg.emoji} Your ${cfg.label} is Confirmed — MyBuddyMaid`,
        html: emailHtml,
        reply_to: 'info@mybuddymaid.in',
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error('Resend error:', resendData);
      throw new Error(resendData.message || 'Failed to send email');
    }

    return new Response(JSON.stringify({ success: true, id: resendData.id }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Edge function error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
