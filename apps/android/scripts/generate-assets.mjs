import sharp from 'sharp';
import { mkdirSync } from 'fs';

const GLYPH_PATH =
  'M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2m-3.17 12 .57-2.5 2.1 2v5c0 .55.45 1 1 1s1-.45 1-1v-5.64c0-.55-.22-1.07-.62-1.45l-1.48-1.41.6-3c1.07 1.24 2.62 2.13 4.36 2.41.6.09 1.14-.39 1.14-1 0-.49-.36-.9-.85-.98-1.52-.25-2.78-1.15-3.45-2.33l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L7.21 7.76c-.74.32-1.22 1.04-1.22 1.85v2.37c0 .55.45 1 1 1s1-.45 1-1v-2.4l1.8-.7-1.6 8.1-3.92-.8c-.54-.11-1.07.24-1.18.78V17c-.11.54.24 1.07.78 1.18l4.11.82c1.06.21 2.1-.46 2.34-1.52';

const GRADIENT = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#c6ff3d"/>
  <stop offset="1" stop-color="#38e1ff"/>
</linearGradient>`;

const out = process.argv[2];
mkdirSync(out, { recursive: true });

async function render(svg, file, size) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`${out}/${file}`);
  console.log('wrote', file);
}

// icon-background.png — full-bleed brand gradient, no glyph (adaptive icon background layer).
await render(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs>${GRADIENT}</defs><rect width="1024" height="1024" fill="url(#g)"/></svg>`,
  'icon-background.png',
  1024
);

// icon-foreground.png — glyph only, transparent bg, scaled to ~50% and centered so Android's
// adaptive-icon mask (which crops roughly the outer third) never clips it.
await render(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
     <g transform="translate(284 284) scale(19)"><path fill="#0b1200" d="${GLYPH_PATH}"/></g>
   </svg>`,
  'icon-foreground.png',
  1024
);

// icon-only.png — flattened legacy icon (rounded-square gradient + glyph), mirrors icon.svg.
await render(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
     <defs>${GRADIENT}</defs>
     <rect x="32" y="32" width="960" height="960" rx="240" fill="url(#g)"/>
     <g transform="translate(212 212) scale(25)"><path fill="#0b1200" d="${GLYPH_PATH}"/></g>
   </svg>`,
  'icon-only.png',
  1024
);

// splash(-dark).png — the app is always dark-mode (theme.ts), so both variants are identical:
// the app's actual dark background with the rounded-square brand mark centered, small. These
// feed @capacitor/assets' legacy per-density splash.png generation (drawable-*dpi); unused now
// that styles.xml's AppTheme.NoActionBarLaunch uses windowSplashScreenBackground/…AnimatedIcon
// instead (the legacy android:background approach they produce is ignored on Android 12+), but
// kept in case that ever needs regenerating too.
const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732">
  <defs>${GRADIENT}</defs>
  <rect width="2732" height="2732" fill="#05070c"/>
  <rect x="1116" y="1116" width="500" height="500" rx="118" fill="url(#g)"/>
  <g transform="translate(1324 1324) scale(12.2)"><path fill="#0b1200" d="${GLYPH_PATH}"/></g>
</svg>`;
await render(splashSvg, 'splash.png', 2732);
await render(splashSvg, 'splash-dark.png', 2732);

// splash_icon.png — windowSplashScreenAnimatedIcon's actual source (android/app/src/main/res/
// drawable/splash_icon.png): the rounded-square mark on its own gradient square, like icon-only
// but on a transparent canvas so it reads cleanly floating on windowSplashScreenBackground's
// solid dark fill instead of a bare dark glyph nearly invisible against a dark screen.
await render(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
     <defs>${GRADIENT}</defs>
     <rect x="32" y="32" width="960" height="960" rx="240" fill="url(#g)"/>
     <g transform="translate(212 212) scale(25)"><path fill="#0b1200" d="${GLYPH_PATH}"/></g>
   </svg>`,
  'splash_icon.png',
  480
);
