'use client';

import { useEffect, useRef } from 'react';

/**
 * Renders the existing static landing page inside an iframe.
 * This ensures 100% visual fidelity with the original design — 
 * no JSX conversion issues, no CSS conflicts with the Next.js shell.
 */
export default function LandingPageContent() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleResize = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc?.body) {
          iframe.style.height = doc.body.scrollHeight + 'px';
        }
      } catch {
        // Cross-origin fallback
        iframe.style.height = '5000px';
      }
    };

    iframe.addEventListener('load', handleResize);
    window.addEventListener('resize', handleResize);

    return () => {
      iframe.removeEventListener('load', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <iframe
      ref={iframeRef}
      src="/_landing/index.html"
      title="MyBuddyMaid — Trusted Home Help"
      style={{
        width: '100%',
        border: 'none',
        overflow: 'hidden',
        minHeight: '100vh',
      }}
      scrolling="no"
    />
  );
}
