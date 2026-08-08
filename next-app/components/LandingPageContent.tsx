'use client';

import { useEffect } from 'react';
import Script from 'next/script';

interface LandingPageContentProps {
  bodyHtml: string;
}

/**
 * Renders the existing static landing page HTML directly.
 * No iframe — uses dangerouslySetInnerHTML for 100% visual fidelity.
 */
export default function LandingPageContent({ bodyHtml }: LandingPageContentProps) {
  useEffect(() => {
    // Trigger DOMContentLoaded for the landing page script.js
    const event = new Event('DOMContentLoaded', { bubbles: true });
    document.dispatchEvent(event);
  }, []);

  return (
    <>
      <link rel="stylesheet" href="/styles.css" />
      <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      <Script src="/script.js" strategy="lazyOnload" />
    </>
  );
}
