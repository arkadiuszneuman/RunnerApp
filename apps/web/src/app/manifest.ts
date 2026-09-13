import type { MetadataRoute } from 'next';

// Colors mirror tokens.bg in theme.ts (not imported: that module builds the MUI theme).
const BACKGROUND = '#05070c';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Runner',
    short_name: 'Runner',
    description: 'Heart-rate guided treadmill training',
    start_url: '/',
    scope: '/',
    // No orientation lock: a phone or tablet on a treadmill console is as
    // likely to sit in landscape as in portrait.
    display: 'standalone',
    background_color: BACKGROUND,
    theme_color: BACKGROUND,
    categories: ['health', 'fitness', 'sports'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Start a run',
        short_name: 'Run',
        url: '/running',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      { name: 'Programs', url: '/programs' },
      { name: 'History', url: '/runs' },
    ],
  };
}
