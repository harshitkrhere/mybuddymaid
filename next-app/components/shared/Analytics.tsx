// components/shared/Analytics.tsx — analytics that never competes with first paint.
//
// A tiny inline script does three things:
//   1. defines the dataLayer/gtag queue shim, so events fired before GA4 loads are kept
//      and flushed once it does — no click attribution is lost;
//   2. delegates clicks on [data-mbm-track] into GA4 events carrying
//      city / zone / locality / service / pincode, so every lead maps to its page and no
//      SEO page needs a React client boundary;
//   3. loads gtag.js and Umami on the first user interaction, or after a short timeout.
//
// Trade-off (documented in docs/seo/ASSUMPTIONS.md #18): gtag.js is ~190KB and cost
// roughly 560ms of main-thread blocking when loaded eagerly. Deferring it keeps the page
// responsive during the window INP measures. Clicks are queued and still recorded; the
// only loss is a page_view for a visitor who leaves within a few seconds without
// interacting at all.
// AdSense is NOT loaded here — only on blog pages (see ASSUMPTIONS.md #7).
import Script from 'next/script';

export const GA_ID = 'G-R24QC81J4P';
const UMAMI_ID = '90b0b752-39a0-4d32-a614-8dcc9d242af8';
const IDLE_MS = 4000;

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
      service:d.mbmService,pincode:d.mbmPincode,page_path:location.pathname
    });
  },{passive:true,capture:true});

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

export function AdSense() {
  return (
    <Script
      async
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4135055194908677"
      crossOrigin="anonymous"
      strategy="lazyOnload"
    />
  );
}
