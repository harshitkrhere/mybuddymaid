import type { NextConfig } from 'next';

const ONE_YEAR = 'public, max-age=31536000, immutable';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

const nextConfig: NextConfig = {
  // Legacy-URL redirects (3,800+) and host canonicalisation live in proxy.ts
  // (prebuilt lookup map) — see docs/seo/redirects.csv. No trailing slashes.
  trailingSlash: false,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async rewrites() {
    return [
      // Booking SPA (Vite build embedded at public/_spa, built with base=/_spa/ and
      // BrowserRouter basename=/app). It handles its own client-side routing.
      { source: '/app', destination: '/_spa/index.html' },
      { source: '/app/:path*', destination: '/_spa/index.html' },
    ];
  },
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      { source: '/_spa/assets/:path*', headers: [{ key: 'Cache-Control', value: ONE_YEAR }] },
      { source: '/app/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/app', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/_spa/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/:path*.(png|jpg|jpeg|webp|avif|svg|ico|woff2)', headers: [{ key: 'Cache-Control', value: ONE_YEAR }] },
    ];
  },
};

export default nextConfig;
