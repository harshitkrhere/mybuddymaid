/**
 * MyBuddyMaid — Google Apps Script
 * ============================================================
 * This script receives booking form submissions from the website
 * and saves them as rows in your Google Sheet.
 *
 * HOW TO SET UP (takes ~5 minutes):
 * 1. Open Google Sheets → create a new blank sheet
 * 2. Name the sheet tab: "Bookings"
 * 3. In Row 1, add these headers in columns A–G:
 *    Timestamp | Name | Email | Phone | City | Service | Notes
 * 4. Go to Extensions → Apps Script
 * 5. Delete everything in the editor and paste this entire file
 * 6. Replace 'YOUR_SPREADSHEET_ID_HERE' below with your Sheet ID
 *    (The Sheet ID is in the URL: docs.google.com/spreadsheets/d/THIS_PART_HERE/edit)
 * 7. Click Save (floppy disk icon)
 * 8. Click Deploy → New deployment
 *    - Type: Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 9. Click Deploy → Copy the Web App URL
 * 10. Paste that URL in script.js where it says:
 *     const SHEETS_URL = 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
 * ============================================================
 */

const SPREADSHEET_ID = '1ODgmpFNlJNR92BlbZrmy2MJOnC9sGovHYUSILqIVWhg';

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Bookings');
    const data  = JSON.parse(e.postData.contents);

    sheet.appendRow([
      data.timestamp || new Date().toLocaleString('en-IN'),
      data.name    || '',
      data.email   || '',
      "'" + (data.phone || ''),   // Prefix with ' to force plain text (prevents +91 #ERROR!)
      data.city    || '',
      data.service || '',
      data.notes   || '',
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Test function — run this inside Apps Script to verify the sheet connection
function testConnection() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Bookings');
  sheet.appendRow([
    new Date().toLocaleString('en-IN'),
    'Test User',
    'test@mybuddymaid.com',
    '+91 00000 00000',
    'Delhi NCR',
    'Part-Time Buddy',
    'This is a test row — you can delete it.',
  ]);
  Logger.log('✅ Test row added successfully!');
}

