import { createWorker, OEM, PSM } from 'tesseract.js';
import type { RgbaImage } from './prepareWatchImage';
import { readWatchWorkout, type WatchPhotoReading } from './readWatchWorkout';

/** Longest side the photo is scaled down to: plenty for the screen's big text, and fast. */
const MAX_SIDE = 1200;

export type OcrStage = 'loading' | 'reading';

/**
 * Reads the workout off a photo of the watch, entirely on the device: Tesseract runs in a
 * (classic) worker on the self-hosted assets from scripts/tesseract-assets.mjs. Loaded on demand
 * (`await import('./ocr')`) — tesseract.js isn't needed anywhere else.
 */
export async function recognizeWatchPhoto(
  file: Blob,
  onProgress?: (stage: OcrStage, progress: number) => void
): Promise<WatchPhotoReading> {
  const photo = await loadPhoto(file);
  const base = new URL(process.env.NEXT_PUBLIC_TESSERACT_ASSETS!, window.location.href).href;

  onProgress?.('loading', 0);
  // Polish for the workout names ("Próg"), English alongside it for "@" and "bpm".
  const worker = await createWorker(['pol', 'eng'], OEM.LSTM_ONLY, {
    workerPath: `${base}/worker.min.js`,
    workerBlobURL: false,
    corePath: base,
    langPath: base,
    // The service worker caches the assets; tesseract's own IndexedDB copy would be a second one.
    cacheMethod: 'none',
    logger: ({ status, progress }) => {
      onProgress?.(status === 'recognizing text' ? 'reading' : 'loading', progress);
    },
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    return await readWatchWorkout(photo, async (image) => {
      canvas.width = image.width;
      canvas.height = image.height;
      context.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
      const { data } = await worker.recognize(canvas);
      return data.text;
    });
  } finally {
    await worker.terminate();
  }
}

async function loadPhoto(file: Blob): Promise<RgbaImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
