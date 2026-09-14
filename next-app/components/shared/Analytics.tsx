// components/shared/Analytics.tsx — analytics that never competes with first paint.
//
// A tiny inline script does four things:
//   1. defines the dataLayer/gtag queue shim, so events fired before GA4 loads are kept
//      and flushed once it does — no click attribution is lost;
//   2. delegates clicks on [data-mbm-track] into GA4 events carrying
//      city / zone / locality / service / pincode / source, so every lead maps to its page
//      and no SEO page needs a React client boundary;
//   3. remembers how the visitor arrived — utm_* parameters, an ad click id, an external
//      referrer — in sessionStorage (this visit) and localStorage (first touch), so the
//      lead form and, once the schema allows it, the booking can carry attribution. No
//      cookie is set and nothing leaves the browser until a form is sent;
//   4. loads gtag.js and Umami on the first user interaction, or after a short timeout.
//
// Trade-off (documented in docs/seo/ASSUMPTIONS.md #24): gtag.js is ~190KB and cost
// roughly 560ms of main-thread blocking when loaded eagerly. Deferring it keeps the page
// responsive during the window INP measures. Clicks are queued and still recorded; the
// only loss is a page_view for a visitor who leaves within a few seconds without
// interacting at all.
// AdSense is not loaded anywhere. Its loader ran on blog posts and in the SPA shell with no ad
// unit on any page, so it was removed (FIN-PF01; ASSUMPTIONS.md #7 and #29 record the change).
//
// The booking app (app/index.html) carries the same shim, listener and attribution capture
// with source 'app'; lib/__tests__/cta-tracking.test.ts pins the two to the same keys.
import Script from 'next/script';

// The owner's own GA4 property, created 2026-09-15. The previous id (G-R24QC81J4P) came
// with the legacy site and belonged to a property nobody at the company could open, so the
// clicks recorded under it were never readable. app/index.html carries the same id.
export const GA_ID = 'G-9T870SQ5F3';
const UMAMI_ID = '90b0b752-39a0-4d32-a614-8dcc9d242af8';
const IDLE_MS = 4000;

/** Storage keys and query parameters shared with app/index.html. */
export const ATTRIBUTION_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'msclkid'];
export const ATTR_SESSION_KEY = 'mbm_attr';
export const ATTR_FIRST_KEY = 'mbm_first_attr';

const BOOTSTRAP = `
(function(){
  window.dataLayer=window.dataLayer||[];
  window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};
  document.addEventListener('click',function(e){
    var el=e.target&&e.target.closest?e.target.closest('[data-mbm-track]'):null;
    if(!el)return;
    var d=el.dataset;
    window.gtag('event',d.mbmTrack,{
      city:d.mbmCity,zone:d.mbmZone,locality:d.mbmLocality,
      service:d.mbmService,pincode:d.mbmPincode,source:'site',page_path:location.pathname
    });
  },{passive:true,capture:true});

  try{
    var q=new URLSearchParams(location.search),a={},has=false;
    ${JSON.stringify(ATTRIBUTION_KEYS)}.forEach(function(k){var v=q.get(k);if(v){a[k]=v.slice(0,120);has=true;}});
    var ref=document.referrer;
    if(ref&&ref.indexOf(location.origin)!==0){a.referrer=ref.slice(0,200);has=true;}
    if(has){
      a.landing=location.pathname;a.at=new Date().toISOString();
      sessionStorage.setItem('${ATTR_SESSION_KEY}',JSON.stringify(a));
      if(!localStorage.getItem('${ATTR_FIRST_KEY}'))localStorage.setItem('${ATTR_FIRST_KEY}',JSON.stringify(a));
    }
  }catch(e){}

  var loaded=false;
  function load(){
    if(loaded)return; loaded=true;
    var g=document.createElement('script');
    g.async=true; g.src='https://www.googletagmanager.com/gtag/js?id=${GA_ID}';
    g.onload=function(){ window.gtag('js',new Date()); window.gtag('config','${GA_ID}',{send_page_view:true}); };
    document.head.appendChild(g);
    var u=document.createElement('script');
    u.async=true; u.defer=true; u.src='https://cloud.umami.is/script.js';
    u.setAttribute('data-website-id','${UMAMI_ID}');
    document.head.appendChild(u);
  }
  ['pointerdown','keydown','touchstart','scroll'].forEach(function(evt){
    window.addEventListener(evt,load,{once:true,passive:true});
  });
  setTimeout(load,${IDLE_MS});
  window.addEventListener('pagehide',load,{once:true});
})();
`;

export function Analytics() {
  return (
    <Script id="mbm-analytics" strategy="afterInteractive">
      {BOOTSTRAP}
    </Script>
  );
}
