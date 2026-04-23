/**
 * MyBuddyMaid — Google Apps Script (Production-Grade)
 * ═══════════════════════════════════════════════════════════
 * SHEET COLUMNS (Enrollments tab):
 *   A: Timestamp   B: Name        C: Email
 *   D: Phone       E: Package     F: Amount (₹)
 *   G: Payment ID  H: Payment Method  I: Status
 *
 * SHEET COLUMNS (Bookings tab):
 *   A: Timestamp   B: Name   C: Email
 *   D: Phone       E: City   F: Service   G: Notes
 * ═══════════════════════════════════════════════════════════
 */

const SPREADSHEET_ID = '1ODgmpFNlJNR92BlbZrmy2MJOnC9sGovHYUSILqIVWhg';
const FROM_EMAIL     = 'info@mybuddymaid.in';
const FROM_NAME      = 'MyBuddyMaid Team';
const RESEND_API_KEY = 're_P6zS4ejg_9sUCC78YN1KRD5GwHfSBUwZC';



/* ──────────────────────────────────────────────── *
 *  PLAN CONFIG — amount-based lookup (for webhook)
 * ──────────────────────────────────────────────── */
const PLANS_BY_AMOUNT = {
  2499: { tag: 'Silver Package' },
  3999: { tag: 'Gold Package'   },
  5999: { tag: 'Diamond Package' },
  8999: { tag: 'Platinum Package' },
};

/**
 * Resolve canonical package name from an amount.
 * Only used as fallback when notes.package is absent.
 */
function getPlanTagByAmount(amount) {
  if (PLANS_BY_AMOUNT[amount]) return PLANS_BY_AMOUNT[amount].tag;
  if (amount <= 2499) return 'Silver Package';
  if (amount <= 3999) return 'Gold Package';
  if (amount <= 5999) return 'Diamond Package';
  return 'Platinum Package';
}

/**
 * Normalise any package string to the canonical name.
 * Handles: "Silver Package", "Silver Buddy", "silver", etc.
 */
function normalisePkgName(raw) {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes('platinum')) return 'Platinum Package';
  if (lower.includes('diamond'))  return 'Diamond Package';
  if (lower.includes('gold'))     return 'Gold Package';
  if (lower.includes('silver'))   return 'Silver Package';
  return null;
}

/**
 * Format a phone number — always +91XXXXXXXXXX.
 */
function formatPhone(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 10) return '+91' + digits;
  if (digits.length === 12 && digits.startsWith('91')) return '+' + digits;
  return digits.length > 0 ? '+' + digits : '';
}

/**
 * Format IST timestamp.
 */
function nowIST() {
  return Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd/MM/yyyy, HH:mm:ss');
}

/**
 * Reject fake Razorpay emails.
 */
function resolveEmail(rzpEmail, notesEmail) {
  var FAKE = ['void@razorpay.com', 'null@razorpay.com', ''];
  if (notesEmail && FAKE.indexOf(notesEmail.toLowerCase()) === -1) return notesEmail;
  if (rzpEmail   && FAKE.indexOf(rzpEmail.toLowerCase())   === -1) return rzpEmail;
  return 'N/A';
}

/**
 * Human-readable payment method from Razorpay entity.
 */
function resolvePaymentMethod(payment) {
  if (!payment || !payment.method) return 'Razorpay';
  switch (payment.method) {
    case 'upi':        return 'UPI';
    case 'card':       return (payment.card && payment.card.network) ? payment.card.network + ' Card' : 'Card';
    case 'netbanking': return 'Net Banking';
    case 'wallet':     return payment.wallet || 'Wallet';
    case 'emi':        return 'EMI';
    default:           return 'Razorpay';
  }
}

/**
 * Check for duplicate Payment ID in a sheet column (0-based index).
 */
function isDuplicate(sheet, value, colIndex) {
  if (!value) return false;
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;
  var vals = sheet.getRange(2, colIndex + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === String(value).trim()) return true;
  }
  return false;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}



/* ──────────────────────────────────────────────── *
 *  doPost — Main entry point
 * ──────────────────────────────────────────────── */
function doPost(e) {
  try {
    var ss   = SpreadsheetApp.openById(SPREADSHEET_ID);
    var raw  = e.postData ? e.postData.contents : '{}';
    var data = JSON.parse(raw);

    if (data.event === 'payment.captured') return handleRazorpayWebhook(ss, data);
    if (data.type  === 'enrollment')       return handleFrontendEnrollment(ss, data);
    return handleBooking(ss, data);

  } catch (err) {
    Logger.log('doPost error: ' + err.message);
    return jsonResponse({ status: 'error', message: err.message });
  }
}

/* ── Handler 1: Razorpay backend webhook ── */
function handleRazorpayWebhook(ss, data) {
  var payment       = data.payload.payment.entity;
  var amount        = Math.round(payment.amount / 100);
  var paymentId     = payment.id || '';
  var paymentMethod = resolvePaymentMethod(payment);

  var notesName  = payment.notes && payment.notes.name  ? payment.notes.name  : '';
  var notesEmail = payment.notes && payment.notes.email ? payment.notes.email : '';
  var notesPkg   = payment.notes && payment.notes.package ? payment.notes.package : '';

  var name  = notesName || 'Customer';
  var email = resolveEmail(payment.email, notesEmail);
  var phone = formatPhone(payment.contact);

  // Resolve package — always use name first, fall back to amount
  var pkgName = normalisePkgName(notesPkg) || getPlanTagByAmount(amount);

  Logger.log('[WEBHOOK] paymentId=' + paymentId + ' | amount=' + amount + ' | notesPkg="' + notesPkg + '" | resolved="' + pkgName + '"');

  var sheet = ss.getSheetByName('Enrollments');
  if (!sheet) return jsonResponse({ status: 'error', message: 'Enrollments sheet not found' });

  if (isDuplicate(sheet, paymentId, 6)) {
    Logger.log('[WEBHOOK] Duplicate skipped: ' + paymentId);
    return jsonResponse({ status: 'duplicate' });
  }

  var ts = nowIST();
  sheet.appendRow([ts, name, email, phone, pkgName, amount, paymentId, paymentMethod, 'Verified']);
  Logger.log('[WEBHOOK] Row written: ' + pkgName + ', ' + amount);



  try {
    sendEnrollmentEmail({ name: name, email: email, phone: phone, package: pkgName, amount: amount, utr: paymentId });
  } catch (mailErr) {
    Logger.log('[WEBHOOK] Email failed: ' + mailErr.message);
  }

  return jsonResponse({ status: 'ok' });
}

/* ── Handler 2: Frontend enrollment POST ── */
function handleFrontendEnrollment(ss, data) {
  var paymentId     = data.utr || '';
  var name          = data.name  || 'Customer';
  var email         = resolveEmail(data.email, '');
  var phone         = formatPhone(data.phone);
  var amount        = parseInt(data.amount, 10) || 0;
  var paymentMethod = data.payment_method || 'Razorpay';

  // Always resolve from package name — never from amount
  var pkgName = normalisePkgName(data.package) || getPlanTagByAmount(amount);

  Logger.log('[FRONTEND] paymentId=' + paymentId + ' | pkg="' + data.package + '" | resolved="' + pkgName + '" | amount=' + amount);

  var sheet = ss.getSheetByName('Enrollments');
  if (!sheet) return jsonResponse({ status: 'error', message: 'Enrollments sheet not found' });

  if (paymentId && isDuplicate(sheet, paymentId, 6)) {
    Logger.log('[FRONTEND] Duplicate skipped: ' + paymentId);
    return jsonResponse({ status: 'duplicate' });
  }

  var ts = data.timestamp || nowIST();
  sheet.appendRow([ts, name, email, phone, pkgName, amount, paymentId, paymentMethod, 'Verified']);
  Logger.log('[FRONTEND] Row written: ' + pkgName + ', ' + amount);



  if (email && email !== 'N/A') {
    try {
      sendEnrollmentEmail({ name: name, email: email, phone: phone, package: pkgName, amount: amount, utr: paymentId });
    } catch (mailErr) {
      Logger.log('[FRONTEND] Email failed: ' + mailErr.message);
    }
  }

  return jsonResponse({ status: 'success' });
}

/* ── Handler 3: General booking (no payment) ── */
function handleBooking(ss, data) {
  var sheet = ss.getSheetByName('Bookings');
  if (!sheet) return jsonResponse({ status: 'error', message: 'Bookings sheet not found' });

  var name    = data.name    || 'Customer';
  var email   = resolveEmail(data.email, '');
  var phone   = formatPhone(data.phone);
  var city    = data.city    || '';
  var service = data.service || '';
  var notes   = data.notes   || '';
  var ts      = data.timestamp || nowIST();

  sheet.appendRow([ts, name, email, phone, city, service, notes]);
  Logger.log('[BOOKING] Row written: ' + name + ', ' + service);



  return jsonResponse({ status: 'success' });
}


/* ══════════════════════════════════════════════════
 *  EMAIL SYSTEM
 *  ─────────────────────────────────────────────────
 *  RULE: Plan is resolved ONLY from package name.
 *        Amount is NEVER used to pick the plan.
 *        Each plan has its own fully self-contained
 *        config — no shared templates.
 * ══════════════════════════════════════════════════ */

/**
 * Returns the full self-contained email config for a given package name.
 * Input can be anything — "Silver Package", "Silver Buddy", "silver", etc.
 */
function getEmailConfig(rawPkgName) {

  // ── Step 1: Resolve to canonical key ──
  var key = 'Silver Package'; // safe default
  if (rawPkgName) {
    var lower = rawPkgName.toLowerCase();
    if      (lower.indexOf('platinum') !== -1) key = 'Platinum Package';
    else if (lower.indexOf('diamond')  !== -1) key = 'Diamond Package';
    else if (lower.indexOf('gold')     !== -1) key = 'Gold Package';
    else if (lower.indexOf('silver')   !== -1) key = 'Silver Package';
  }
  Logger.log('[EMAIL-CONFIG] Input="' + rawPkgName + '" → Key="' + key + '"');

  // ── Step 2: Self-contained config per plan ──
  var configs = {

    'Silver Package': {
      key:         'Silver Package',
      emoji:       '🥈',
      accentColor: '#475569',
      headerBg:    '#1e293b',
      badgeLabel:  'SILVER MEMBER',
      subject:     '🥈 Your Silver Package is Confirmed — MyBuddyMaid',
      validity:    '90 Days',
      contacts:    '1 Verified Buddy Profile',
      heroLine:    'Your home help journey starts here.',
      teamMsg:     'Our placement team will reach out <strong>within 30 minutes</strong> during business hours with your first verified buddy profile.',
      callTime:    '30 minutes',
      features: [
        '90-Day Free Replacement Guarantee',
        'Access to Standard Verified Buddy Pool',
        'Aadhaar & Basic Background Verification',
        '1 Curated Buddy Profile Shared',
        'Refund Policy Applicable (T&C Apply)',
      ],
      nextSteps: [
        'Our team calls you on <strong>{phone}</strong> within 30 minutes',
        'We share your matched buddy\'s verified profile',
        'You conduct a brief interview at your convenience',
        'Your buddy is deployed once you approve',
      ],
    },

    'Gold Package': {
      key:         'Gold Package',
      emoji:       '🥇',
      accentColor: '#b45309',
      headerBg:    '#1c1007',
      badgeLabel:  'GOLD MEMBER',
      subject:     '🥇 Your Gold Package is Confirmed — MyBuddyMaid',
      validity:    '180 Days',
      contacts:    '3 Verified Buddy Profiles',
      heroLine:    'Premium home help, delivered with care.',
      teamMsg:     'Your dedicated account manager will contact you <strong>within 30 minutes</strong> with 3 hand-picked, verified buddy profiles tailored to your household.',
      callTime:    '30 minutes',
      features: [
        '180-Day Free Replacement Guarantee',
        'Access to Premium Verified Buddy Pool',
        'Enhanced Reference & Background Checks',
        '3 Curated Buddy Profiles Shared',
        'Dedicated Account Manager Assigned',
        'Full Refund Policy Applicable (T&C Apply)',
      ],
      nextSteps: [
        'Your dedicated account manager calls on <strong>{phone}</strong> within 30 minutes',
        'We share 3 thoroughly vetted and matched buddy profiles',
        'You interview candidates at your schedule',
        'We handle all onboarding documentation',
      ],
    },

    'Diamond Package': {
      key:         'Diamond Package',
      emoji:       '💎',
      accentColor: '#0f766e',
      headerBg:    '#042f2e',
      badgeLabel:  'DIAMOND MEMBER',
      subject:     '💎 Your Diamond Package is Confirmed — MyBuddyMaid',
      validity:    '365 Days',
      contacts:    '5 Verified Buddy Profiles',
      heroLine:    'Elite home help — a full year of peace of mind.',
      teamMsg:     'Your premium account manager will call you <strong>within 30 minutes</strong> with 5 elite, thoroughly screened buddy profiles for priority deployment.',
      callTime:    '30 minutes',
      features: [
        '365-Day Free Replacement Guarantee',
        'Access to Elite Verified Buddy Pool',
        'Comprehensive Police & Background Check',
        '5 Curated Buddy Profiles Shared',
        '24×7 Dedicated Account Manager',
        'Priority Deployment within 24 Hours',
        'Full Refund + Insurance Cover (T&C Apply)',
      ],
      nextSteps: [
        'Your premium account manager calls on <strong>{phone}</strong> within 30 minutes',
        'We share 5 elite, police-verified buddy profiles',
        'You interview and select your preferred candidate',
        'Priority deployment completed within 24 hours',
      ],
    },

    'Platinum Package': {
      key:         'Platinum Package',
      emoji:       '👑',
      accentColor: '#7c3aed',
      headerBg:    '#1e0a3c',
      badgeLabel:  'PLATINUM VIP',
      subject:     '👑 Your Platinum Package is Confirmed — MyBuddyMaid',
      validity:    '456 Days',
      contacts:    'Up to 15 Free Replacements',
      heroLine:    'VIP concierge service — the pinnacle of home help.',
      teamMsg:     'Your personal VIP concierge manager will call you <strong>within 15 minutes</strong> with our top-tier buddy profiles, ready for same-day deployment.',
      callTime:    '15 minutes',
      features: [
        '456-Day Free Replacement Guarantee',
        'Up to 15 Complimentary Replacements',
        'VIP Concierge Verified Buddy Pool',
        'Full Police + Medical Background Screening',
        '24×7 Priority Concierge Account Manager',
        'Same-Day Emergency Deployment',
        'Full Refund + Insurance + Extended Cover',
      ],
      nextSteps: [
        'Your VIP concierge manager calls on <strong>{phone}</strong> within 15 minutes',
        'We present curated, top-tier buddy profiles for your review',
        'You choose your preferred candidate — no-pressure process',
        'Same-day deployment arranged at your convenience',
      ],
    },

  };

  return configs[key];
}

/* ── Main email sender ── */
function sendEnrollmentEmail(data) {
  var name  = String(data.name    || '').trim() || 'Valued Customer';
  var email = String(data.email   || '').trim();
  var phone = String(data.phone   || '').trim();
  var payId = String(data.utr     || '').trim() || 'N/A';
  var amount = parseInt(data.amount, 10) || 0;
  var rawPkg = String(data['package'] || '').trim();

  Logger.log('[EMAIL] START | pkg="' + rawPkg + '" | email="' + email + '" | amount=' + amount + ' | payId=' + payId);

  // Guard: skip if no real email
  if (!email || email === 'N/A' || email === '') {
    Logger.log('[EMAIL] SKIP — no valid email. payId=' + payId);
    return;
  }

  // Resolve plan config — name-driven ONLY
  var cfg = getEmailConfig(rawPkg);
  if (!cfg) {
    Logger.log('[EMAIL] ERROR — plan config not found for: "' + rawPkg + '"');
    return;
  }

  Logger.log('[EMAIL] Plan resolved to: ' + cfg.key);

  var amtStr = amount > 0 ? ('₹' + amount.toLocaleString('en-IN')) : '(amount not recorded)';

  // Build features HTML
  var featHtml = '';
  for (var i = 0; i < cfg.features.length; i++) {
    featHtml += '<tr><td style="padding:11px 18px;font-size:14px;color:#1e293b;border-bottom:1px solid #f1f5f9;line-height:1.5;">'
      + '<span style="color:' + cfg.accentColor + ';font-weight:800;margin-right:10px;">✓</span>'
      + cfg.features[i] + '</td></tr>';
  }

  // Build next-steps HTML
  var stepsHtml = '';
  for (var j = 0; j < cfg.nextSteps.length; j++) {
    var step = cfg.nextSteps[j].replace('{phone}', phone || 'your registered number');
    stepsHtml += '<li style="margin-bottom:10px;line-height:1.6;">' + step + '</li>';
  }

  // ── HTML Email body ──
  var htmlBody = '<!DOCTYPE html>'
    + '<html lang="en"><head>'
    + '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>' + cfg.subject + '</title></head>'
    + '<body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,\'Segoe UI\',Roboto,Arial,sans-serif;">'

    + '<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:48px 16px;">'
    + '<tr><td align="center">'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.08);">'

    // Header
    + '<tr><td style="background:' + cfg.headerBg + ';padding:28px 36px 24px;text-align:center;">'
    + '<p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:3px;color:' + cfg.accentColor + ';text-transform:uppercase;">' + cfg.badgeLabel + '</p>'
    + '<h1 style="margin:0;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">MyBuddyMaid</h1>'
    + '<p style="margin:8px 0 0;font-size:12px;color:rgba(255,255,255,0.45);letter-spacing:1px;">YOUR TRUSTED HOME HELP PARTNER</p>'
    + '</td></tr>'

    // Confirmation banner
    + '<tr><td style="padding:36px 36px 28px;text-align:center;border-bottom:3px solid ' + cfg.accentColor + ';">'
    + '<div style="display:inline-block;width:68px;height:68px;border-radius:50%;line-height:68px;font-size:36px;margin-bottom:16px;">' + cfg.emoji + '</div>'
    + '<h2 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0f172a;">Payment Confirmed</h2>'
    + '<p style="margin:0 0 6px;font-size:15px;color:#334155;font-weight:600;">Welcome to <span style="color:' + cfg.accentColor + ';">' + cfg.key + '</span> ' + cfg.emoji + '</p>'
    + '<p style="margin:0;font-size:13px;color:#64748b;font-style:italic;">' + cfg.heroLine + '</p>'
    + '</td></tr>'

    // Greeting
    + '<tr><td style="padding:28px 36px 0;">'
    + '<p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.7;">Dear <strong style="color:#0f172a;">' + name + '</strong>,</p>'
    + '<p style="margin:0 0 18px;font-size:15px;color:#334155;line-height:1.75;">Thank you for choosing MyBuddyMaid. Your payment of <strong style="color:' + cfg.accentColor + ';font-size:17px;"> ' + amtStr + '</strong> has been successfully received and verified.</p>'
    + '<p style="margin:0 0 28px;font-size:15px;color:#334155;line-height:1.75;">' + cfg.teamMsg + '</p>'
    + '</td></tr>'

    // Order summary
    + '<tr><td style="padding:0 36px 28px;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">'
    + '<tr><td style="padding:14px 20px;background:' + cfg.headerBg + ';">'
    + '<p style="margin:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.6);">Order Summary</p>'
    + '</td></tr>'
    + '<tr><td style="padding:20px;">'
    + '<table width="100%" cellpadding="0" cellspacing="0">'
    + '<tr><td style="padding:8px 0;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;">Package</td><td style="padding:8px 0;font-size:13px;font-weight:700;color:#0f172a;text-align:right;border-bottom:1px solid #f1f5f9;">' + cfg.emoji + ' ' + cfg.key + '</td></tr>'
    + '<tr><td style="padding:8px 0;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;">Amount Paid</td><td style="padding:8px 0;font-size:17px;font-weight:800;color:' + cfg.accentColor + ';text-align:right;border-bottom:1px solid #f1f5f9;">' + amtStr + '</td></tr>'
    + '<tr><td style="padding:8px 0;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;">Validity Period</td><td style="padding:8px 0;font-size:13px;font-weight:600;color:#0f172a;text-align:right;border-bottom:1px solid #f1f5f9;">' + cfg.validity + '</td></tr>'
    + '<tr><td style="padding:8px 0;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;">Profiles / Replacements</td><td style="padding:8px 0;font-size:13px;font-weight:600;color:#0f172a;text-align:right;border-bottom:1px solid #f1f5f9;">' + cfg.contacts + '</td></tr>'
    + '<tr><td style="padding:8px 0;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;">WhatsApp</td><td style="padding:8px 0;font-size:13px;font-weight:600;color:#0f172a;text-align:right;border-bottom:1px solid #f1f5f9;">' + (phone || '—') + '</td></tr>'
    + '<tr><td style="padding:8px 0;font-size:12px;color:#94a3b8;">Payment ID</td><td style="padding:8px 0;font-size:11px;color:#94a3b8;text-align:right;word-break:break-all;">' + payId + '</td></tr>'
    + '</table></td></tr></table>'
    + '</td></tr>'

    // Features
    + '<tr><td style="padding:0 36px 28px;">'
    + '<p style="margin:0 0 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;">What Your ' + cfg.key + ' Includes</p>'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">'
    + featHtml
    + '</table></td></tr>'

    // Next steps
    + '<tr><td style="padding:0 36px 28px;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;">'
    + '<tr><td style="padding:20px 24px;">'
    + '<p style="margin:0 0 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#15803d;">What Happens Next</p>'
    + '<ol style="margin:0;padding-left:20px;color:#166534;font-size:14px;">' + stepsHtml + '</ol>'
    + '</td></tr></table></td></tr>'

    // CTA
    + '<tr><td style="padding:0 36px 32px;text-align:center;">'
    + '<a href="https://mybuddymaid.in" style="display:inline-block;background:' + cfg.headerBg + ';color:#ffffff;text-decoration:none;padding:16px 44px;border-radius:10px;font-size:14px;font-weight:700;letter-spacing:0.5px;border:2px solid ' + cfg.accentColor + ';">Visit MyBuddyMaid.in &rarr;</a>'
    + '<p style="margin:20px 0 0;font-size:13px;color:#94a3b8;line-height:1.7;">Have a question? Simply reply to this email or WhatsApp us.<br><strong style="color:#475569;">info@mybuddymaid.in</strong></p>'
    + '</td></tr>'

    // Footer
    + '<tr><td style="background:#f8fafc;padding:20px 36px;text-align:center;border-top:1px solid #e2e8f0;">'
    + '<p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.8;">&copy; 2026 MyBuddyMaid &bull; India\'s Trusted Home Help Network<br>'
    + 'By using our service you agree to our <a href="https://mybuddymaid.in" style="color:' + cfg.accentColor + ';text-decoration:none;">Terms &amp; Conditions</a>.</p>'
    + '</td></tr>'

    + '</table></td></tr></table></body></html>';

  // ── PDF Invoice ──
  var receiptNo = 'MBM-' + (Math.floor(Math.random() * 900000) + 100000);
  var dateStr   = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy');

  var invoiceHtml = '<!DOCTYPE html><html><head><style>'
    + '* { box-sizing:border-box; } body { font-family:-apple-system,\'Segoe UI\',Roboto,Arial,sans-serif; color:#1e293b; margin:0; padding:48px; }'
    + '.header { border-bottom:4px solid ' + cfg.accentColor + '; padding-bottom:28px; margin-bottom:36px; display:flex; justify-content:space-between; align-items:flex-start; }'
    + '.brand h1 { margin:0; font-size:28px; font-weight:900; color:' + cfg.headerBg + '; } .brand p { margin:5px 0 0; font-size:12px; color:#64748b; }'
    + '.badge { display:inline-block; background:' + cfg.accentColor + '; color:#fff; font-size:10px; font-weight:700; letter-spacing:2px; padding:5px 12px; border-radius:20px; text-transform:uppercase; }'
    + '.title { font-size:11px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:' + cfg.accentColor + '; margin-bottom:28px; }'
    + 'table.d { width:100%; border-collapse:collapse; margin-bottom:36px; } table.d td { padding:12px 0; border-bottom:1px solid #f1f5f9; font-size:14px; }'
    + 'table.d td:first-child { color:#64748b; width:45%; } table.d td:last-child { font-weight:700; color:#0f172a; }'
    + '.total-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:20px 24px; margin-bottom:32px; overflow:hidden; }'
    + '.total-label { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#64748b; display:block; margin-bottom:6px; }'
    + '.total-amount { font-size:28px; font-weight:900; color:' + cfg.accentColor + '; }'
    + '.footer { font-size:11px; color:#94a3b8; text-align:center; border-top:1px solid #f1f5f9; padding-top:24px; line-height:1.8; margin-top:40px; }'
    + '</style></head><body>'
    + '<div class="header"><div class="brand"><h1>MyBuddyMaid</h1><p>Your Trusted Home Help Partner</p><p>info@mybuddymaid.in &bull; www.mybuddymaid.in</p></div>'
    + '<div class="badge">' + cfg.badgeLabel + '</div></div>'
    + '<div class="title">Tax Invoice &amp; Receipt</div>'
    + '<table class="d">'
    + '<tr><td>Receipt Number</td><td>' + receiptNo + '</td></tr>'
    + '<tr><td>Date of Payment</td><td>' + dateStr + '</td></tr>'
    + '<tr><td>Razorpay Payment ID</td><td>' + payId + '</td></tr>'
    + '<tr><td>Customer Name</td><td>' + name + '</td></tr>'
    + '<tr><td>Email Address</td><td>' + email + '</td></tr>'
    + '<tr><td>WhatsApp Number</td><td>' + (phone || '—') + '</td></tr>'
    + '<tr><td>Package Enrolled</td><td>' + cfg.emoji + ' ' + cfg.key + ' &bull; ' + cfg.validity + '</td></tr>'
    + '<tr><td>Profiles / Replacements</td><td>' + cfg.contacts + '</td></tr>'
    + '</table>'
    + '<div class="total-box"><span class="total-label">Total Amount Paid</span><span class="total-amount">' + amtStr + '</span></div>'
    + '<div class="footer">This is a computer-generated invoice and does not require a physical signature.<br>'
    + 'The platform fee is a one-time placement fee as per MyBuddyMaid Terms &amp; Conditions.<br>'
    + '&copy; 2026 MyBuddyMaid &bull; All Rights Reserved</div>'
    + '</body></html>';

  // Convert to PDF
  var pdfBase64  = '';
  var tmpFileId  = null;
  try {
    var tmpBlob = Utilities.newBlob(invoiceHtml, 'text/html', 'invoice.html');
    var tmpFile = Drive.Files.create(
      { name: 'MBM_Invoice_Temp', mimeType: 'application/vnd.google-apps.document' },
      tmpBlob, { convert: true }
    );
    tmpFileId  = tmpFile.id;
    pdfBase64  = Utilities.base64Encode(DriveApp.getFileById(tmpFileId).getAs('application/pdf').getBytes());
    Logger.log('[EMAIL] PDF generated OK.');
  } catch (pdfErr) {
    Logger.log('[EMAIL] PDF failed (non-fatal): ' + pdfErr.message);
  } finally {
    if (tmpFileId) { try { DriveApp.getFileById(tmpFileId).setTrashed(true); } catch (_) {} }
  }

  // Send via Resend
  var payload = {
    from:     FROM_NAME + ' <' + FROM_EMAIL + '>',
    to:       [email],
    subject:  cfg.subject,
    html:     htmlBody,
    reply_to: FROM_EMAIL,
  };
  if (pdfBase64) {
    payload.attachments = [{
      filename: 'MyBuddyMaid_Invoice_' + cfg.key.replace(/\s+/g, '_') + '_' + receiptNo + '.pdf',
      content:  pdfBase64,
    }];
  }

  try {
    Logger.log('[EMAIL] Sending | to=' + email + ' | subject=' + cfg.subject);
    var resp = UrlFetchApp.fetch('https://api.resend.com/emails', {
      method: 'post', contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY },
      payload: JSON.stringify(payload), muteHttpExceptions: true,
    });
    var code = resp.getResponseCode();
    if (code >= 400) {
      Logger.log('[EMAIL] SEND FAILED — HTTP ' + code + ' | ' + resp.getContentText());
    } else {
      Logger.log('[EMAIL] ✅ Sent successfully | plan=' + cfg.key + ' | to=' + email + ' | HTTP ' + code);
    }
  } catch (sendErr) {
    Logger.log('[EMAIL] EXCEPTION: ' + sendErr.message);
  }
}

/* ──────────────────────────────────────────────── *
 *  SETUP — Run once to create sheet tabs & headers
 * ──────────────────────────────────────────────── */
function setupSheets() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  var bookings = ss.getSheetByName('Bookings') || ss.insertSheet('Bookings');
  if (bookings.getLastRow() === 0) {
    bookings.appendRow(['Timestamp', 'Name', 'Email', 'Phone', 'City', 'Service', 'Notes']);
    bookings.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#0F0F0F').setFontColor('#ffffff');
    bookings.setFrozenRows(1);
  }

  var enrollments = ss.getSheetByName('Enrollments') || ss.insertSheet('Enrollments');
  if (enrollments.getLastRow() === 0) {
    enrollments.appendRow(['Timestamp', 'Name', 'Email', 'Phone', 'Package', 'Amount (₹)', 'Payment ID', 'Payment Method', 'Status']);
    enrollments.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#0F0F0F').setFontColor('#ffffff');
    enrollments.setFrozenRows(1);
  }

  bookings.autoResizeColumns(1, 7);
  enrollments.autoResizeColumns(1, 9);
  Logger.log('✅ Sheets ready.');
}

/* ──────────────────────────────────────────────── *
 *  FIX EXISTING DATA — Run once to repair old rows
 * ──────────────────────────────────────────────── */
function fixExistingEnrollments() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Enrollments');
  if (!sheet) { Logger.log('No Enrollments sheet.'); return; }

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) { Logger.log('No data rows.'); return; }

  // Ensure header has 9 cols
  var hdr = sheet.getRange(1, 1, 1, 9).getValues()[0];
  if (!hdr[7]) sheet.getRange(1, 8).setValue('Payment Method');
  if (!hdr[8]) sheet.getRange(1, 9).setValue('Status');

  var data  = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
  var fixed = 0;

  for (var i = 0; i < data.length; i++) {
    var row    = data[i];
    var rowNum = i + 2;
    var changed = false;

    // Fix phone
    var rawPhone   = String(row[3] || '').replace(/^'/, '');
    if (rawPhone && !rawPhone.startsWith('+')) {
      sheet.getRange(rowNum, 4).setValue(formatPhone(rawPhone));
      changed = true;
    }

    // Fix package name
    var pkg = String(row[4] || '');
    var normPkg = normalisePkgName(pkg);
    if (normPkg && normPkg !== pkg) {
      sheet.getRange(rowNum, 5).setValue(normPkg);
      changed = true;
    }

    // Fix amount (strip ₹ if stored as string)
    var amt = row[5];
    if (typeof amt === 'string' && amt.indexOf('₹') !== -1) {
      sheet.getRange(rowNum, 6).setValue(parseInt(amt.replace(/[^\d]/g, ''), 10));
      changed = true;
    }

    // Fix fake email
    var em = String(row[2] || '').toLowerCase();
    if (em === 'void@razorpay.com' || em === 'null@razorpay.com') {
      sheet.getRange(rowNum, 3).setValue('N/A');
      changed = true;
    }

    // Add missing Payment Method
    if (!row[7]) { sheet.getRange(rowNum, 8).setValue('Razorpay'); changed = true; }

    // Add missing Status
    if (!row[8]) { sheet.getRange(rowNum, 9).setValue('Verified'); changed = true; }

    if (changed) fixed++;
  }

  sheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#0F0F0F').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 9);

  Logger.log('✅ fixExistingEnrollments complete — fixed ' + fixed + ' rows.');
}
