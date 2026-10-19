// @vitest-environment node
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { createWorker, OEM, PSM, type Worker } from 'tesseract.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RgbaImage } from './prepareWatchImage';
import { readWatchWorkout } from './readWatchWorkout';

// The real OCR pipeline (prepareWatchImage → Tesseract → extractWatchWorkout) on photos of the
// watch's workout screen, with the same Polish + English models the app self-hosts.
const require = createRequire(import.meta.url);
const modelDir = (lang: string) =>
  join(dirname(require.resolve(`@tesseract.js-data/${lang}/package.json`)), '4.0.0_best_int');

let worker: Worker;
let langPath: string;

beforeAll(async () => {
  // Tesseract loads every language from one directory, like the app's public/tesseract/<versions>.
  langPath = mkdtempSync(join(tmpdir(), 'tesseract-'));
  for (const lang of ['pol', 'eng']) {
    copyFileSync(
      join(modelDir(lang), `${lang}.traineddata.gz`),
      join(langPath, `${lang}.traineddata.gz`)
    );
  }
  worker = await createWorker(['pol', 'eng'], OEM.LSTM_ONLY, { langPath, cacheMethod: 'none' });
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
}, 60_000);

afterAll(async () => {
  await worker?.terminate();
  rmSync(langPath, { recursive: true, force: true });
});

async function loadFixture(name: string): Promise<RgbaImage> {
  const { data, info } = await sharp(join(__dirname, '__fixtures__', name))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data) };
}

async function recognize(image: RgbaImage): Promise<string> {
  const png = await sharp(Buffer.from(image.data), {
    raw: { width: image.width, height: image.height, channels: 4 },
  })
    .png()
    .toBuffer();
  const { data } = await worker.recognize(png);
  return data.text;
}

describe('readWatchWorkout on watch photos', () => {
  it('reads a steady workout', async () => {
    const { workout } = await readWatchWorkout(await loadFixture('steady-baza.jpg'), recognize);
    expect(workout).toEqual({ name: 'Baza', text: '143bpm 31:00' });
  }, 60_000);

  it('reads a threshold workout under its chart', async () => {
    const { workout } = await readWatchWorkout(await loadFixture('threshold-prog.jpg'), recognize);
    expect(workout).toEqual({ name: 'Próg', text: '21:00@169bpm 41:00' });
  }, 60_000);
});
