'use client';

import { useEffect } from 'react';
import Script from 'next/script';

interface LandingPageContentProps {
  bodyHtml: string;
}

/**
 * Renders the existing static landing page HTML directly (no iframe).
 * The HTML is passed as a prop from the server component.
 * CSS is loaded via <link>, JS via next/script.
 */
export default function LandingPageContent({ bodyHtml }: LandingPageContentProps) {
  useEffect(() => {
    // Re-run any inline event handlers/observers that the landing page JS expects
    // The script.js will handle DOMContentLoaded on its own
    window.dispatchEvent(new Event('DOMContentLoaded'));
  }, []);

  return (
    <>
      {/* Landing page CSS */}
      <link rel="stylesheet" href="/styles.css" />

      {/* Landing page body content */}
      <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />

      {/* Landing page JS — loads after content is rendered */}
      <Script src="/script.js" strategy="lazyOnload" />
    </>
  );
}
