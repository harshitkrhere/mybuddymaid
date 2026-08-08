import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Rewrite SPA routes to the embedded Vite build.
  // The SPA handles its own client-side routing.
  async rewrites() {
    return [
      // SPA app routes — all rewrite to the embedded SPA index.html
      { source: '/home', destination: '/_spa/index.html' },
      { source: '/home/:path*', destination: '/_spa/index.html' },
      { source: '/auth/:path*', destination: '/_spa/index.html' },
      { source: '/splash', destination: '/_spa/index.html' },
      { source: '/bookings', destination: '/_spa/index.html' },
      { source: '/bookings/:path*', destination: '/_spa/index.html' },
      { source: '/profile', destination: '/_spa/index.html' },
      { source: '/profile/:path*', destination: '/_spa/index.html' },
      { source: '/services/:path*', destination: '/_spa/index.html' },
    ];
  },
};

export default nextConfig;
