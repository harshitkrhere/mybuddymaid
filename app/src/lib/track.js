// app/src/lib/track.js — GA4 events from the booking app.
//
// The shim in index.html defines window.gtag before gtag.js loads, so an event fired here is
// queued and flushed once the library arrives; if the shim is absent (tests, a blocked
// script) the call is a no-op. Every event carries source 'app' so the report can tell the
// booking app's clicks from the site's. Never pass a name, an e-mail or a phone number.
export function track(event, params = {}) {
  try {
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
    window.gtag('event', event, { source: 'app', page_path: window.location.pathname, ...params });
  } catch {
    // analytics must never break the app
  }
}
