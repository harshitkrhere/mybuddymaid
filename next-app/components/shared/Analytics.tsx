// components/shared/Analytics.tsx — GA4 + Umami, loaded after interactive. AdSense is
// NOT loaded here (only on blog pages via <AdSense />, ASSUMPTIONS.md #7).
import Script from 'next/script';

export const GA_ID = 'G-R24QC81J4P';
const UMAMI_ID = '90b0b752-39a0-4d32-a614-8dcc9d242af8';

export function Analytics() {
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}',{send_page_view:true});`}
      </Script>
      <Script src="https://cloud.umami.is/script.js" data-website-id={UMAMI_ID} strategy="afterInteractive" />
    </>
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
