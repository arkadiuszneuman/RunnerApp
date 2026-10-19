/*
 * Self-hosted Tesseract.js assets for reading workouts off watch photos (src/app/watch/ocr.ts):
 * the worker script, the LSTM-only WebAssembly cores and the Polish + English models, copied out of
 * node_modules into public/tesseract/<versions>/ (gitignored) instead of loading them from a CDN,
 * so text recognition works offline once the service worker has cached them. The versioned
 * directory keeps them immutable, which is what lets sw.js cache them cache-first.
 *
 * Run as a script before `next dev`/`next build`; next.config.ts imports tesseractAssetsPath()
 * to tell the app where they are.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(webRoot, 'package.json'));

const tesseractDir = dirname(require.resolve('tesseract.js/package.json'));
const coreDir = dirname(
  createRequire(join(tesseractDir, 'package.json')).resolve('tesseract.js-core/package.json')
);
const engDir = dirname(require.resolve('@tesseract.js-data/eng/package.json'));
const polDir = dirname(require.resolve('@tesseract.js-data/pol/package.json'));

const version = (dir) => JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;

/** Public URL path of the assets, e.g. /tesseract/7.0.0-7.0.0-1.0.0-1.0.0. */
export function tesseractAssetsPath() {
  return `/tesseract/${version(tesseractDir)}-${version(coreDir)}-${version(engDir)}-${version(polDir)}`;
}

const FILES = [
  [tesseractDir, 'dist/worker.min.js'],
  // ocr.ts runs the LSTM engine only; the worker picks one of these by WebAssembly support.
  [coreDir, 'tesseract-core-lstm.wasm.js'],
  [coreDir, 'tesseract-core-simd-lstm.wasm.js'],
  [coreDir, 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  [polDir, '4.0.0_best_int/pol.traineddata.gz'],
  [engDir, '4.0.0_best_int/eng.traineddata.gz'],
];

function copyAssets() {
  const publicRoot = join(webRoot, 'public', 'tesseract');
  const target = join(webRoot, 'public', tesseractAssetsPath());
  if (FILES.every(([, file]) => existsSync(join(target, file.split('/').pop())))) return;
  rmSync(publicRoot, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  for (const [dir, file] of FILES)
    copyFileSync(join(dir, file), join(target, file.split('/').pop()));
  console.log(`Copied Tesseract assets to public${tesseractAssetsPath()}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) copyAssets();
