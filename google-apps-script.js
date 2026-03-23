/**
 * MyBuddyMaid — Google Apps Script
 * ============================================================
 * Routes form submissions to two separate tabs:
 *   • "Bookings"    ← Instant Book form (general service enquiries)
 *   • "Enrollments" ← Package signups (Silver / Gold / Diamond Buddy)
 * ============================================================
 */

const SPREADSHEET_ID = '1ODgmpFNlJNR92BlbZrmy2MJOnC9sGovHYUSILqIVWhg';

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
        "'" + (data.phone   || ''),   // ' prefix → plain text (avoids +91 #ERROR!)
        data.package   || '',
        data.amount    || '',
      ]);

    } else {
      // ── General Booking → "Bookings" tab ────────────────────────
      const sheet = ss.getSheetByName('Bookings');
      sheet.appendRow([
        data.timestamp || new Date().toLocaleString('en-IN'),
        data.name      || '',
        data.email     || '',
        "'" + (data.phone   || ''),
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
    enrollments.appendRow(['Timestamp','Name','Email','Phone','Package','Amount (₹)']);

  Logger.log('✅ Both sheet tabs are ready!');
}

