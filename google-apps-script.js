/**
 * MyBuddyMaid — Google Apps Script (Production-Grade Fix)
 * ═══════════════════════════════════════════════════════════
 * SHEET COLUMNS (Enrollments tab):
 *   A: Timestamp        B: Name           C: Email
 *   D: Phone            E: Package        F: Amount (₹)
 *   G: Payment ID       H: Payment Method I: Status
 *
 * SHEET COLUMNS (Bookings tab):
 *   A: Timestamp        B: Name           C: Email
 *   D: Phone            E: City           F: Service       G: Notes
 * ═══════════════════════════════════════════════════════════
 */

const SPREADSHEET_ID = '1ODgmpFNlJNR92BlbZrmy2MJOnC9sGovHYUSILqIVWhg';
const FROM_EMAIL     = 'info@mybuddymaid.in';
const FROM_NAME      = 'MyBuddyMaid Team';
const RESEND_API_KEY = 're_P6zS4ejg_9sUCC78YN1KRD5GwHfSBUwZC';

/* ──────────────────────────────────────────────── *
 *  PLAN CONFIG — single source of truth
 *  Keys match the EXACT package names sent by frontend
 * ──────────────────────────────────────────────── */
const PLANS_BY_NAME = {
  'Silver Package':   { emoji: '🥈', color: '#64748b', tag: 'Silver Package', amount: 2499, validity: '90 Days',  contacts: '1 Verified Profile' },
  'Gold Package':     { emoji: '🥇', color: '#d97706', tag: 'Gold Package',   amount: 3999, validity: '180 Days', contacts: '3 Verified Profiles' },
  'Diamond Package':  { emoji: '💎', color: '#0d9488', tag: 'Diamond Package', amount: 5999, validity: '365 Days', contacts: '5 Verified Profiles' },
  'Platinum Package': { emoji: '👑', color: '#7c3aed', tag: 'Platinum Package', amount: 8999, validity: '456 Days', contacts: '15 Replacements Included' },
};

const PLANS_BY_AMOUNT = {
  2499: { emoji: '🥈', color: '#64748b', tag: 'Silver Package', validity: '90 Days',  contacts: '1 Verified Profile' },
  3999: { emoji: '🥇', color: '#d97706', tag: 'Gold Package',   validity: '180 Days', contacts: '3 Verified Profiles' },
  5999: { emoji: '💎', color: '#0d9488', tag: 'Diamond Package', validity: '365 Days', contacts: '5 Verified Profiles' },
  8999: { emoji: '👑', color: '#7c3aed', tag: 'Platinum Package', validity: '456 Days', contacts: '15 Replacements Included' },
};

const PLAN_FEATURES = {
  'Silver Package':   ['90-Day Replacement Guarantee','Access to Standard Buddy Pool','Basic Background Verification','1 Verified Buddy Profile Shared','Refund Available (T&C Apply)'],
  'Gold Package':     ['180-Day Replacement Guarantee','Access to Premium Buddy Pool','Enhanced Reference Checks','3 Verified Buddy Profiles Shared','Dedicated Account Manager','Full Refund Available (T&C Apply)'],
  'Diamond Package':  ['365-Day Replacement Guarantee','Access to Elite Verified Buddy Pool','Comprehensive Background Check','5 Verified Buddy Profiles Shared','24×7 Dedicated Account Manager','Priority Deployment within 24 Hours','Full Refund + Insurance Cover'],
  'Platinum Package': ['456-Day Replacement Guarantee','Up to 15 Free Replacements','VIP Concierge Verified Pool','Full Police + Medical Background Check','24×7 Priority Account Manager','Same-Day Emergency Deployment','Full Refund + Insurance + Extended Cover'],
};

/**
 * Resolve plan info by package name string.
 * Handles both "Silver Package" and legacy "Silver Buddy" naming.
 */
function getPlanByName(pkgName) {
  if (!pkgName) return PLANS_BY_AMOUNT[2499];
  // Direct match
  if (PLANS_BY_NAME[pkgName]) return PLANS_BY_NAME[pkgName];
  // Legacy "Silver Buddy" → normalize
  const lower = pkgName.toLowerCase();
  if (lower.includes('silver'))   return PLANS_BY_NAME['Silver Package'];
  if (lower.includes('gold'))     return PLANS_BY_NAME['Gold Package'];
  if (lower.includes('diamond'))  return PLANS_BY_NAME['Diamond Package'];
  if (lower.includes('platinum')) return PLANS_BY_NAME['Platinum Package'];
  return PLANS_BY_AMOUNT[2499];
}

/**
 * Resolve plan info by amount paid (paise already divided to rupees).
 */
function getPlanByAmount(amount) {
  if (PLANS_BY_AMOUNT[amount]) return PLANS_BY_AMOUNT[amount];
  // Threshold fallback
  if (amount <= 2499) return PLANS_BY_AMOUNT[2499];
  if (amount <= 3999) return PLANS_BY_AMOUNT[3999];
  if (amount <= 5999) return PLANS_BY_AMOUNT[5999];
  return PLANS_BY_AMOUNT[8999];
}

/**
 * Format a phone number cleanly — always store as text with +91 prefix if Indian.
 */
function formatPhone(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 10) return '+91' + digits;
  if (digits.length === 12 && digits.startsWith('91')) return '+' + digits;
  return '+' + digits; // keep as-is with + prefix
}

/**
 * Format IST timestamp cleanly.
 */
function nowIST() {
  return Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd/MM/yyyy, HH:mm:ss');
}

/* ──────────────────────────────────────────────── *
 *  doPost — Main webhook handler
 * ──────────────────────────────────────────────── */
function doPost(e) {
  try {
    const ss   = SpreadsheetApp.openById(SPREADSHEET_ID);
    const raw  = e.postData ? e.postData.contents : '{}';
    const data = JSON.parse(raw);

    // ── 1. Razorpay SERVER Webhook (payment.captured) ──
    if (data.event === 'payment.captured') {
      return handleRazorpayWebhook(ss, data);
    }

    // ── 2. Frontend Enrollment (after Razorpay success handler fires) ──
    if (data.type === 'enrollment') {
      return handleFrontendEnrollment(ss, data);
    }

    // ── 3. General Booking (no payment) ──
    return handleBooking(ss, data);

  } catch (err) {
    Logger.log('doPost error: ' + err.message + '\n' + err.stack);
    return jsonResponse({ status: 'error', message: err.message });
  }
}

/* ── Handler 1: Razorpay backend webhook ── */
function handleRazorpayWebhook(ss, data) {
  const payment     = data.payload.payment.entity;
  const amount      = Math.round(payment.amount / 100); // paise → rupees
  const paymentId   = payment.id || '';
  const paymentMethod = resolvePaymentMethod(payment);

  // Prefer name/email from notes (filled by frontend) over Razorpay defaults
  const name  = (payment.notes && payment.notes.name)  || payment.contact || 'Customer';
  const email = resolveEmail(payment.email, payment.notes && payment.notes.email);
  const phone = formatPhone(payment.contact);

  // Resolve package: try notes.package first, then notes.type/amount
  const pkgRaw = (payment.notes && payment.notes.package) || '';
  const plan   = pkgRaw ? getPlanByName(pkgRaw) : getPlanByAmount(amount);
  const pkgName = plan.tag;

  const sheet = ss.getSheetByName('Enrollments');
  if (!sheet) return jsonResponse({ status: 'error', message: 'Enrollments sheet not found' });

  // Deduplication by Payment ID
  if (isDuplicate(sheet, paymentId, 6)) {
    return jsonResponse({ status: 'duplicate', message: 'Already recorded' });
  }

  const ts = nowIST();
  sheet.appendRow([ts, name, email, phone, pkgName, amount, paymentId, paymentMethod, 'Verified']);

  // Send confirmation email
  try {
    sendEnrollmentEmail({ name, email, phone, package: pkgName, amount, utr: paymentId });
  } catch (mailErr) {
    Logger.log('Email failed (webhook): ' + mailErr.message);
  }

  return jsonResponse({ status: 'ok' });
}

/* ── Handler 2: Frontend enrollment POST ── */
function handleFrontendEnrollment(ss, data) {
  const paymentId     = data.utr || '';
  const name          = data.name  || 'Customer';
  const email         = resolveEmail(data.email, '');
  const phone         = formatPhone(data.phone);
  const pkgRaw        = data.package || '';
  const amount        = parseInt(data.amount, 10) || 0;
  const paymentMethod = data.payment_method || 'Razorpay';

  // Resolve plan from package name (most reliable source)
  const plan    = pkgRaw ? getPlanByName(pkgRaw) : getPlanByAmount(amount);
  const pkgName = plan.tag;

  const sheet = ss.getSheetByName('Enrollments');
  if (!sheet) return jsonResponse({ status: 'error', message: 'Enrollments sheet not found' });

  // Deduplication by Payment ID
  if (paymentId && isDuplicate(sheet, paymentId, 6)) {
    return jsonResponse({ status: 'duplicate', message: 'Already recorded' });
  }

  const ts = data.timestamp || nowIST();
  sheet.appendRow([ts, name, email, phone, pkgName, amount, paymentId, paymentMethod, 'Verified']);

  if (email && email !== 'N/A') {
    try {
      sendEnrollmentEmail({ name, email, phone, package: pkgName, amount, utr: paymentId });
    } catch (mailErr) {
      Logger.log('Email failed (frontend): ' + mailErr.message);
    }
  }

  return jsonResponse({ status: 'success' });
}

/* ── Handler 3: General booking (no payment) ── */
function handleBooking(ss, data) {
  const sheet = ss.getSheetByName('Bookings');
  if (!sheet) return jsonResponse({ status: 'error', message: 'Bookings sheet not found' });

  const ts    = data.timestamp || nowIST();
  const name  = data.name    || 'Customer';
  const email = resolveEmail(data.email, '');
  const phone = formatPhone(data.phone);
  const city  = data.city    || '';
  const svc   = data.service || '';
  const notes = data.notes   || '';

  sheet.appendRow([ts, name, email, phone, city, svc, notes]);
  return jsonResponse({ status: 'success' });
}

/* ──────────────────────────────────────────────── *
 *  Helpers
 * ──────────────────────────────────────────────── */

/** Return false email addresses from Razorpay and pick the real one. */
function resolveEmail(rzpEmail, notesEmail) {
  const FAKE_EMAILS = ['void@razorpay.com', 'null@razorpay.com', ''];
  if (notesEmail && !FAKE_EMAILS.includes(notesEmail.toLowerCase())) return notesEmail;
  if (rzpEmail   && !FAKE_EMAILS.includes(rzpEmail.toLowerCase()))   return rzpEmail;
  return 'N/A';
}

/** Determine human-readable payment method from Razorpay payment entity. */
function resolvePaymentMethod(payment) {
  if (!payment || !payment.method) return 'Razorpay';
  switch (payment.method) {
    case 'upi':    return 'UPI';
    case 'card':   return payment.card && payment.card.network ? payment.card.network + ' Card' : 'Card';
    case 'netbanking': return 'Net Banking';
    case 'wallet': return payment.wallet ? payment.wallet : 'Wallet';
    case 'emi':    return 'EMI';
    default:       return 'Razorpay';
  }
}

/** Check if a value already exists in column index (0-based) of the sheet. */
function isDuplicate(sheet, value, colIndex) {
  if (!value) return false;
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false; // Only header row exists
  const colValues = sheet.getRange(2, colIndex + 1, lastRow - 1, 1).getValues();
  return colValues.some(row => String(row[0]).trim() === String(value).trim());
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ──────────────────────────────────────────────── *
 *  Email — Modern branded confirmation
 * ──────────────────────────────────────────────── */
function sendEnrollmentEmail(data) {
  const name   = data.name    || 'Valued Customer';
  const email  = data.email;
  const amount = parseInt(data.amount, 10) || 0;
  const pkg    = data.package || 'Silver Package';
  const phone  = data.phone   || '';
  const payId  = data.utr     || 'N/A';

  if (!email || email === 'N/A') return;

  const plan     = getPlanByName(pkg);
  const features = PLAN_FEATURES[plan.tag] || PLAN_FEATURES['Silver Package'];
  const { emoji, color, tag, validity, contacts } = plan;

  const amtFormatted = '₹' + amount.toLocaleString('en-IN');

  const teamMsg = {
    'Silver Package':   'Our team will reach out within <strong>30 minutes</strong> during business hours with your first buddy profile.',
    'Gold Package':     'Your dedicated account manager will contact you within <strong>30 minutes</strong> with 3 carefully matched buddy profiles.',
    'Diamond Package':  'Your premium account manager will call you within <strong>30 minutes</strong> with 5 elite verified buddy profiles for priority deployment.',
    'Platinum Package': 'Your VIP concierge manager will personally call you within <strong>15 minutes</strong> with our top-tier buddy profiles for immediate same-day deployment.',
  }[tag] || 'Our team will reach out within <strong>30 minutes</strong>.';

  const featuresHtml = features
    .map(f => `<tr><td style="padding:10px 16px;font-size:14px;color:#334155;border-bottom:1px solid #f1f5f9;">
      <span style="color:${color};font-weight:700;margin-right:8px;">✓</span>${f}</td></tr>`)
    .join('');

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">

  <!-- Header -->
  <tr><td style="background:#0F0F0F;padding:32px;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">MyBuddyMaid</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.5);font-size:12px;letter-spacing:0.5px;">YOUR TRUSTED HOME HELP PARTNER</p>
  </td></tr>

  <!-- Status Banner -->
  <tr><td style="padding:28px 32px;text-align:center;border-bottom:3px solid ${color};">
    <div style="font-size:42px;margin-bottom:8px;">${emoji}</div>
    <h2 style="margin:0 0 6px;color:#0f172a;font-size:20px;font-weight:700;">Payment Confirmed</h2>
    <p style="margin:0;color:#64748b;font-size:14px;">Welcome to <strong style="color:${color};">${tag}</strong> — you're all set! 🎉</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:28px 32px;">
    <p style="margin:0 0 20px;color:#334155;font-size:15px;line-height:1.65;">
      Hi <strong>${name}</strong>, 👋<br><br>
      Thank you for enrolling with MyBuddyMaid! Your payment of <strong style="color:${color};">${amtFormatted}</strong> has been successfully received and verified. ${teamMsg}
    </p>

    <!-- Order Summary -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;overflow:hidden;margin-bottom:24px;">
      <tr><td style="padding:14px 16px;background:#f1f5f9;border-bottom:1px solid #e2e8f0;">
        <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;font-weight:700;">Order Summary</p>
      </td></tr>
      <tr><td style="padding:16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
          <tr><td style="color:#64748b;padding:6px 0;">Plan</td><td style="color:#0f172a;font-weight:600;text-align:right;">${emoji} ${tag}</td></tr>
          <tr><td style="color:#64748b;padding:6px 0;">Amount Paid</td><td style="color:${color};font-weight:700;text-align:right;font-size:16px;">${amtFormatted}</td></tr>
          <tr><td style="color:#64748b;padding:6px 0;">Validity</td><td style="color:#0f172a;font-weight:600;text-align:right;">${validity}</td></tr>
          <tr><td style="color:#64748b;padding:6px 0;">Profiles</td><td style="color:#0f172a;font-weight:600;text-align:right;">${contacts}</td></tr>
          <tr><td style="color:#64748b;padding:6px 0;">Payment ID</td><td style="color:#94a3b8;font-size:12px;text-align:right;word-break:break-all;">${payId}</td></tr>
          <tr><td style="color:#64748b;padding:6px 0;">WhatsApp</td><td style="color:#0f172a;font-weight:600;text-align:right;">${phone}</td></tr>
        </table>
      </td></tr>
    </table>

    <!-- Features -->
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;">Your Plan Includes</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px;">
      ${featuresHtml}
    </table>

    <!-- Next Steps -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;margin-bottom:24px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 10px;color:#065f46;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">📋 What Happens Next?</p>
        <ol style="margin:0;padding-left:18px;color:#047857;font-size:14px;line-height:2;">
          <li>Our team will call you on <strong>${phone}</strong> within 30 minutes</li>
          <li>We'll share verified buddy profiles matching your requirements</li>
          <li>You interview and choose your preferred buddy</li>
          <li>We handle all documentation and background verification</li>
        </ol>
      </td></tr>
    </table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding:8px 0 20px;">
        <a href="https://mybuddymaid.in" style="display:inline-block;background:#0F0F0F;color:#34D399;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:14px;font-weight:700;letter-spacing:0.02em;">
          Visit MyBuddyMaid.in →
        </a>
      </td></tr>
    </table>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;line-height:1.6;">
      Questions? Reply to this email or WhatsApp us.<br>
      <strong style="color:#475569;">info@mybuddymaid.in</strong>
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
    <p style="margin:0;color:#94a3b8;font-size:11px;">
      © 2026 MyBuddyMaid. All rights reserved.<br>
      By using our service you agreed to our <a href="https://mybuddymaid.in" style="color:${color};">Terms &amp; Conditions</a>.
    </p>
  </td></tr>

</table>
</td></tr>
</table>

</body>
</html>`;

  // ── Generate PDF Invoice ──
  const invoiceHtml = `<!DOCTYPE html>
<html><head><style>
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1e293b; margin: 40px; }
  .header { border-bottom: 3px solid ${color}; padding-bottom: 24px; margin-bottom: 32px; }
  .header h1 { margin: 0; color: #0F0F0F; font-size: 28px; font-weight: 800; }
  .header p { margin: 4px 0 0; color: #64748b; font-size: 13px; }
  .invoice-title { font-size: 20px; color: ${color}; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; }
  .details { width: 100%; margin-bottom: 40px; border-collapse: collapse; }
  .details td { padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
  .details td:first-child { color: #64748b; width: 40%; }
  .details td:last-child { color: #0f172a; font-weight: 600; }
  .total { font-size: 22px; font-weight: 800; color: ${color}; margin-top: 24px; border-top: 3px solid #f1f5f9; padding-top: 24px; text-align: right; }
  .footer { margin-top: 60px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 20px; }
</style></head>
<body>
  <div class="header">
    <h1>MyBuddyMaid</h1>
    <p>Your Trusted Home Help Partner</p>
    <p>info@mybuddymaid.in | www.mybuddymaid.in</p>
  </div>
  <div class="invoice-title">Invoice / Receipt</div>
  <table class="details">
    <tr><td>Date</td><td>${Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy')}</td></tr>
    <tr><td>Receipt No.</td><td>MBM-${Math.floor(Math.random() * 900000) + 100000}</td></tr>
    <tr><td>Payment ID</td><td>${payId}</td></tr>
    <tr><td>Customer Name</td><td>${name}</td></tr>
    <tr><td>Email Address</td><td>${email}</td></tr>
    <tr><td>WhatsApp Number</td><td>${phone}</td></tr>
    <tr><td>Package</td><td>${tag} (${validity})</td></tr>
  </table>
  <div class="total">Total Amount Paid: ${amtFormatted}</div>
  <div class="footer">
    This is a computer-generated invoice and does not require a physical signature.<br>
    Non-refundable platform fee included as per Terms &amp; Conditions.<br>
    © 2026 MyBuddyMaid
  </div>
</body></html>`;

  // Convert HTML → PDF via temp Google Doc
  let pdfBase64 = '';
  let tempFileId = null;
  try {
    const tempBlob = Utilities.newBlob(invoiceHtml, 'text/html', 'invoice.html');
    const tempFile = Drive.Files.create(
      { name: 'TempInvoice_MBM', mimeType: 'application/vnd.google-apps.document' },
      tempBlob,
      { convert: true }
    );
    tempFileId = tempFile.id;
    const pdfBlob = DriveApp.getFileById(tempFileId).getAs('application/pdf');
    pdfBase64 = Utilities.base64Encode(pdfBlob.getBytes());
  } catch (pdfErr) {
    Logger.log('PDF generation failed: ' + pdfErr.message);
  } finally {
    if (tempFileId) {
      try { DriveApp.getFileById(tempFileId).setTrashed(true); } catch (_) {}
    }
  }

  // ── Send via Resend API ──
  const subject = `${emoji} Your ${tag} Enrollment is Confirmed — MyBuddyMaid`;

  const payload = {
    from:     `${FROM_NAME} <${FROM_EMAIL}>`,
    to:       [email],
    subject:  subject,
    html:     htmlBody,
    reply_to: FROM_EMAIL,
  };

  if (pdfBase64) {
    payload.attachments = [{
      filename: `MyBuddyMaid_Invoice_${tag.replace(/\s+/g, '_')}.pdf`,
      content: pdfBase64,
    }];
  }

  try {
    const response = UrlFetchApp.fetch('https://api.resend.com/emails', {
      method:      'post',
      contentType: 'application/json',
      headers:     { 'Authorization': 'Bearer ' + RESEND_API_KEY },
      payload:     JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    if (response.getResponseCode() >= 400) {
      Logger.log('Resend error: ' + response.getContentText());
    }
  } catch (mailErr) {
    Logger.log('Email send failed: ' + mailErr.message);
  }
}

/* ──────────────────────────────────────────────── *
 *  SETUP — Run once to create/verify sheet headers
 * ──────────────────────────────────────────────── */
function setupSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Bookings tab
  let bookings = ss.getSheetByName('Bookings');
  if (!bookings) bookings = ss.insertSheet('Bookings');
  if (bookings.getLastRow() === 0) {
    bookings.appendRow(['Timestamp', 'Name', 'Email', 'Phone', 'City', 'Service', 'Notes']);
    bookings.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#0F0F0F').setFontColor('#ffffff');
    bookings.setFrozenRows(1);
  }

  // Enrollments tab
  let enrollments = ss.getSheetByName('Enrollments');
  if (!enrollments) enrollments = ss.insertSheet('Enrollments');
  if (enrollments.getLastRow() === 0) {
    enrollments.appendRow(['Timestamp', 'Name', 'Email', 'Phone', 'Package', 'Amount (₹)', 'Payment ID', 'Payment Method', 'Status']);
    enrollments.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#0F0F0F').setFontColor('#ffffff');
    enrollments.setFrozenRows(1);
  }

  // Auto-fit columns
  bookings.autoResizeColumns(1, 7);
  enrollments.autoResizeColumns(1, 9);

  Logger.log('✅ Both sheet tabs are ready with correct headers!');
}

/* ──────────────────────────────────────────────── *
 *  FIX EXISTING DATA — Run once to repair old rows
 *  Call fixExistingEnrollments() from the Apps Script editor
 * ──────────────────────────────────────────────── */
function fixExistingEnrollments() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Enrollments');
  if (!sheet) { Logger.log('No Enrollments sheet found'); return; }

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) { Logger.log('No data to fix'); return; }

  // Ensure header has 9 columns
  const header = sheet.getRange(1, 1, 1, 9).getValues()[0];
  if (!header[7]) sheet.getRange(1, 8).setValue('Payment Method');
  if (!header[8]) sheet.getRange(1, 9).setValue('Status');

  // Read all data rows
  const data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
  let fixed = 0;

  data.forEach((row, i) => {
    const rowNum = i + 2;
    let changed  = false;

    // Fix phone: if it doesn't start with +, reformat
    const phone = String(row[3] || '');
    const cleanPhone = phone.replace(/^'/, ''); // strip leading apostrophe
    if (cleanPhone && !cleanPhone.startsWith('+')) {
      const formatted = formatPhone(cleanPhone);
      sheet.getRange(rowNum, 4).setValue(formatted);
      changed = true;
    } else if (phone.startsWith("'")) {
      // Has apostrophe prefix — strip it and store cleanly
      sheet.getRange(rowNum, 4).setValue(cleanPhone.startsWith('+') ? cleanPhone : formatPhone(cleanPhone));
      changed = true;
    }

    // Fix package name: "Silver Buddy" → "Silver Package" etc.
    const pkg = String(row[4] || '');
    if (pkg.endsWith('Buddy') || pkg.endsWith('buddy')) {
      const normalized = pkg
        .replace(/Silver Buddy/i, 'Silver Package')
        .replace(/Gold Buddy/i, 'Gold Package')
        .replace(/Diamond Buddy/i, 'Diamond Package')
        .replace(/Platinum Buddy/i, 'Platinum Package');
      sheet.getRange(rowNum, 5).setValue(normalized);
      changed = true;
    }

    // Fix amount: if stored as string with ₹, parse to number
    const amt = row[5];
    if (typeof amt === 'string' && amt.includes('₹')) {
      sheet.getRange(rowNum, 6).setValue(parseInt(amt.replace(/[^\d]/g, ''), 10));
      changed = true;
    }

    // Fix email: replace void@razorpay.com with 'N/A'
    const email = String(row[2] || '');
    if (email.toLowerCase() === 'void@razorpay.com' || email.toLowerCase() === 'null@razorpay.com') {
      sheet.getRange(rowNum, 3).setValue('N/A');
      changed = true;
    }

    // Add missing Payment Method (col 8 = index 7)
    if (!row[7]) {
      sheet.getRange(rowNum, 8).setValue('Razorpay');
      changed = true;
    }

    // Add missing Status (col 9 = index 8)
    if (!row[8]) {
      sheet.getRange(rowNum, 9).setValue('Verified');
      changed = true;
    }

    if (changed) fixed++;
  });

  // Style header
  sheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#0F0F0F').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 9);

  Logger.log('✅ Fixed ' + fixed + ' rows in Enrollments sheet. All done!');
}
