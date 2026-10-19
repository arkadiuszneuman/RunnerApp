import type { NextConfig } from "next";
import { tesseractAssetsPath } from './scripts/tesseract-assets.mjs';

const nextConfig: NextConfig = {
  env: {
    // Where scripts/tesseract-assets.mjs put the self-hosted OCR assets (see app/watch/ocr.ts).
    NEXT_PUBLIC_TESSERACT_ASSETS: tesseractAssetsPath(),
  },
  transpilePackages: ['@runner/core'],
  cacheComponents: true,
  async headers() {
    return [
      {
        // Baseline hardening for every response: block framing (clickjacking),
        // MIME-sniffing, and leaking the full referrer URL cross-origin.
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
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
