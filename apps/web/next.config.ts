import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@runner/core'],
  async headers() {
    return [
      {
        // The service worker must never be served from an HTTP cache, or
        // clients keep running an old one long after a deploy.
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
