/**
 * MyBuddyMaid — Google Apps Script
 * ============================================================
 * Routes form submissions to two separate tabs:
 *   • "Bookings"    ← Instant Book form (general service enquiries)
 *   • "Enrollments" ← Package signups (Silver / Gold / Diamond Buddy)
 *
 * Auto-sends a branded HTML confirmation email after each enrollment.
 * ============================================================
 */

const SPREADSHEET_ID = '1ODgmpFNlJNR92BlbZrmy2MJOnC9sGovHYUSILqIVWhg';
const FROM_EMAIL     = 'info@mybuddymaid.in';
const FROM_NAME      = 'MyBuddyMaid Team';

// ← Paste your Resend API key here after verifying mybuddymaid.in at resend.com
const RESEND_API_KEY = 're_P6zS4ejg_9sUCC78YN1KRD5GwHfSBUwZC';

function doPost(e) {
  try {
    const ss   = SpreadsheetApp.openById(SPREADSHEET_ID);
    const data = JSON.parse(e.postData.contents);

    if (data.type === 'enrollment') {
      // ── Package Enrollment → "Enrollments" tab ──────────────────
      const sheet = ss.getSheetByName('Enrollments');
      sheet.appendRow([
        data.timestamp || new Date().toLocaleString('en-IN'),
        data.name      || '',
        data.email     || '',
        "'" + (data.phone || ''),   // ' prefix → plain text
        data.package   || '',
        data.amount    || '',
        data.utr       || '',       // Razorpay Payment ID
      ]);

      // ── Send automated confirmation email ──
      if (data.email) {
        sendEnrollmentEmail(data);
      }

    } else {
      // ── General Booking → "Bookings" tab ────────────────────────
      const sheet = ss.getSheetByName('Bookings');
      sheet.appendRow([
        data.timestamp || new Date().toLocaleString('en-IN'),
        data.name      || '',
        data.email     || '',
        "'" + (data.phone || ''),
        data.city      || '',
        data.service   || '',
        data.notes     || '',
      ]);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


// ── Email Templates ────────────────────────────────────────────────────────

function sendEnrollmentEmail(data) {
  const name    = data.name    || 'Valued Customer';
  const email   = data.email;
  const amount  = parseInt(data.amount) || 0;
  const pkg     = data.package || 'Buddy Package';
  const phone   = data.phone   || '';
  const payId   = data.utr     || 'N/A';

  // Pick package-specific details
  let planEmoji, planColor, planTag, validity, contacts, features, teamMsg;

  if (amount <= 1499) {
    planEmoji   = '🥈';
    planColor   = '#64748b';
    planTag     = 'Silver Buddy';
    validity    = '90 Days';
    contacts    = '1 Verified Profile';
    features    = [
      '✅ 90-Day Replacement Guarantee',
      '✅ Access to Standard Buddy Pool',
      '✅ Basic Background Verification',
      '✅ 1 Verified Buddy Profile Shared',
      '✅ Unlimited Platform Lead Access',
      '✅ Refund Available (T&C Apply)',
    ];
    teamMsg = 'Our team will reach out within <strong>30 minutes</strong> during business hours with your first buddy profile.';

  } else if (amount <= 2499) {
    planEmoji   = '🥇';
    planColor   = '#d97706';
    planTag     = 'Gold Buddy';
    validity    = '180 Days';
    contacts    = '3 Verified Profiles';
    features    = [
      '✅ 180-Day Replacement Guarantee',
      '✅ Access to Premium Buddy Pool',
      '✅ Enhanced Reference Checks',
      '✅ 3 Verified Buddy Profiles Shared',
      '✅ Dedicated Account Manager',
      '✅ Unlimited Platform Lead Access',
      '✅ Full Refund Available (T&C Apply)',
    ];
    teamMsg = 'Your dedicated account manager will contact you within <strong>30 minutes</strong> with 3 carefully matched buddy profiles.';

  } else {
    planEmoji   = '💎';
    planColor   = '#0d9488';
    planTag     = 'Diamond Buddy';
    validity    = '365 Days';
    contacts    = '5 Verified Profiles';
    features    = [
      '✅ 365-Day Replacement Guarantee',
      '✅ Access to Elite Verified Buddy Pool',
      '✅ Comprehensive Background Check',
      '✅ 5 Verified Buddy Profiles Shared',
      '✅ 24×7 Dedicated Account Manager',
      '✅ Priority Deployment within 24 Hours',
      '✅ Full Refund + Insurance Cover',
    ];
    teamMsg = 'Your premium account manager will call you within <strong>30 minutes</strong> with 5 elite verified buddy profiles for priority deployment.';
  }

  const featuresHtml = features
    .map(f => `<li style="padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#334155;">${f}</li>`)
    .join('');

  const amountFormatted = '₹' + amount.toLocaleString('en-IN');

  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:32px 32px 28px;text-align:center;">
          <h1 style="margin:0 0 4px;color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">MyBuddyMaid</h1>
          <p style="margin:0;color:#94a3b8;font-size:13px;">Your Trusted Home Help Partner</p>
        </td>
      </tr>

      <!-- Success Banner -->
      <tr>
        <td style="background:linear-gradient(135deg,${planColor}15 0%,${planColor}08 100%);padding:28px 32px;text-align:center;border-bottom:3px solid ${planColor};">
          <div style="font-size:48px;margin-bottom:12px;">${planEmoji}</div>
          <h2 style="margin:0 0 8px;color:#0f172a;font-size:22px;font-weight:700;">Payment Confirmed!</h2>
          <p style="margin:0;color:#64748b;font-size:15px;">Welcome to <strong style="color:${planColor};">${planTag}</strong> — You're all set! 🎉</p>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:28px 32px;">

          <p style="margin:0 0 20px;color:#334155;font-size:15px;line-height:1.6;">
            Hi <strong>${name}</strong>, 👋<br><br>
            Thank you for enrolling with MyBuddyMaid! Your payment has been successfully received and verified.
            ${teamMsg}
          </p>

          <!-- Order Summary -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;overflow:hidden;margin-bottom:24px;">
            <tr><td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;">
              <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:600;">Order Summary</p>
            </td></tr>
            <tr><td style="padding:16px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color:#64748b;font-size:14px;padding:4px 0;">Plan</td>
                  <td style="color:#0f172a;font-weight:600;font-size:14px;text-align:right;">${planEmoji} ${planTag}</td>
                </tr>
                <tr>
                  <td style="color:#64748b;font-size:14px;padding:4px 0;">Amount Paid</td>
                  <td style="color:${planColor};font-weight:700;font-size:16px;text-align:right;">${amountFormatted}</td>
                </tr>
                <tr>
                  <td style="color:#64748b;font-size:14px;padding:4px 0;">Validity</td>
                  <td style="color:#0f172a;font-weight:600;font-size:14px;text-align:right;">${validity}</td>
                </tr>
                <tr>
                  <td style="color:#64748b;font-size:14px;padding:4px 0;">Profiles Shared</td>
                  <td style="color:#0f172a;font-weight:600;font-size:14px;text-align:right;">${contacts}</td>
                </tr>
                <tr>
                  <td style="color:#64748b;font-size:14px;padding:4px 0;">Payment ID</td>
                  <td style="color:#64748b;font-size:12px;text-align:right;word-break:break-all;">${payId}</td>
                </tr>
              </table>
            </td></tr>
          </table>

          <!-- Features -->
          <p style="margin:0 0 10px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;">What's Included in Your Plan</p>
          <ul style="margin:0 0 24px;padding:0;list-style:none;border-top:1px solid #f1f5f9;">
            ${featuresHtml}
          </ul>

          <!-- What Happens Next -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:12px;margin-bottom:24px;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0 0 8px;color:#065f46;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">📋 What Happens Next?</p>
              <ol style="margin:0;padding-left:20px;color:#047857;font-size:14px;line-height:1.8;">
                <li>Our team will call you on <strong>${phone}</strong> within 30 minutes</li>
                <li>We'll share verified buddy profiles matching your requirements</li>
                <li>You interview and choose your preferred buddy</li>
                <li>We handle all documentation and background verification</li>
              </ol>
            </td></tr>
          </table>

          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding:8px 0 24px;">
              <a href="https://mybuddymaid.in" style="display:inline-block;background:linear-gradient(135deg,#0f172a,#334155);color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;">
                Visit MyBuddyMaid.in →
              </a>
            </td></tr>
          </table>

          <p style="margin:0;color:#94a3b8;font-size:13px;text-align:center;line-height:1.6;">
            Questions? Reply to this email or WhatsApp us.<br>
            <strong style="color:#334155;">info@mybuddymaid.in</strong>
          </p>

        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">
            © 2025 MyBuddyMaid. All rights reserved.<br>
            By using our service you agreed to our <a href="https://mybuddymaid.in" style="color:#0d9488;">Terms &amp; Conditions</a>.
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>

</body>
</html>`;

  // ── Generate PDF Invoice ──
  const invoiceHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 40px; }
    .header { border-bottom: 2px solid ${planColor}; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { margin: 0; color: #0f172a; font-size: 28px; }
    .header p { margin: 5px 0 0; color: #64748b; }
    .title { font-size: 24px; color: ${planColor}; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px; }
    .details { width: 100%; margin-bottom: 40px; border-collapse: collapse; }
    .details td { padding: 8px 0; border-bottom: 1px solid #eeeeee; }
    .details td:nth-child(1) { color: #64748b; width: 40%; }
    .details td:nth-child(2) { color: #0f172a; font-weight: bold; }
    .total { font-size: 20px; font-weight: bold; color: ${planColor}; margin-top: 20px; border-top: 2px solid #eeeeee; padding-top: 20px; text-align: right; }
    .footer { margin-top: 60px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #eeeeee; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>MyBuddyMaid</h1>
    <p>Your Trusted Home Help Partner</p>
    <p>info@mybuddymaid.in | www.mybuddymaid.in</p>
  </div>
  
  <div class="title">INVOICE / RECEIPT</div>
  
  <table class="details">
    <tr><td>Date</td><td>${new Date().toLocaleDateString('en-IN')}</td></tr>
    <tr><td>Receipt No.</td><td>MBM-${Math.floor(Math.random() * 100000) + 10000}</td></tr>
    <tr><td>Payment ID (UTR)</td><td>${payId}</td></tr>
    <tr><td>Customer Name</td><td>${name}</td></tr>
    <tr><td>Email Address</td><td>${email}</td></tr>
    <tr><td>WhatsApp Number</td><td>${phone}</td></tr>
    <tr><td>Package Name</td><td>${planTag} (${validity})</td></tr>
  </table>
  
  <div class="total">
    Total Amount Paid: ${amountFormatted}
  </div>
  
  <div class="footer">
    This is a computer-generated invoice and does not require a physical signature.<br>
    Non-refundable platform fee included as per Terms &amp; Conditions.
  </div>
</body>
</html>`;

  // Convert HTML to PDF using Google Apps Script's built-in Blob conversion
  const blob = Utilities.newBlob(invoiceHtml, MimeType.HTML, 'invoice.html').getAs(MimeType.PDF);
  const pdfBase64 = Utilities.base64Encode(blob.getBytes());

  const subject = `${planEmoji} Your ${planTag} Enrollment is Confirmed — MyBuddyMaid`;

  // ── Send via Resend API (supports custom domain / Titan email) ──
  const payload = {
    from:     FROM_NAME + ' <' + FROM_EMAIL + '>',
    to:       [email],
    subject:  subject,
    html:     htmlBody,
    reply_to: FROM_EMAIL,
    attachments: [
      {
        filename: `MyBuddyMaid_Invoice_${planTag.replace(/\s+/g, '_')}.pdf`,
        content: pdfBase64
      }
    ]
  };

  UrlFetchApp.fetch('https://api.resend.com/emails', {
    method:      'post',
    contentType: 'application/json',
    headers:     { 'Authorization': 'Bearer ' + RESEND_API_KEY },
    payload:     JSON.stringify(payload),
    muteHttpExceptions: true,
  });
}



// Run once manually to create both sheet tabs with correct headers
function setupSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Bookings tab
  let bookings = ss.getSheetByName('Bookings');
  if (!bookings) bookings = ss.insertSheet('Bookings');
  if (bookings.getLastRow() === 0)
    bookings.appendRow(['Timestamp','Name','Email','Phone','City','Service','Notes']);

  // Enrollments tab
  let enrollments = ss.getSheetByName('Enrollments');
  if (!enrollments) enrollments = ss.insertSheet('Enrollments');
  if (enrollments.getLastRow() === 0)
    enrollments.appendRow(['Timestamp','Name','Email','Phone','Package','Amount (₹)','Payment ID']);

  Logger.log('✅ Both sheet tabs are ready!');
}
