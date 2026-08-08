import Script from 'next/script';

export function Analytics() {
  return (
    <>
      {/* Google Analytics 4 */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-R24QC81J4P"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          gtag('config', 'G-R24QC81J4P');
        `}
      </Script>

      {/* Umami Analytics */}
      <Script
        src="https://cloud.umami.is/script.js"
        data-website-id="90b0b752-39a0-4d32-a614-8dcc9d242af8"
        strategy="afterInteractive"
      />

      {/* Google AdSense */}
      <Script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4135055194908677"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
    </>
  );
}
