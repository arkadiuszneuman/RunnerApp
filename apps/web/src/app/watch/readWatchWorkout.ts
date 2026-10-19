import { extractWatchWorkout, parseWatchWorkout, type ExtractedWatchWorkout } from '@runner/core';
import { prepareWatchImage, type PrepareOptions, type RgbaImage } from './prepareWatchImage';

/**
 * Thresholds the photo is read with, in turn. A misread digit can still look like a valid
 * workout ("41:00@169bpm 47:00"), so a reading only counts once two of them agree. The looser
 * threshold goes first: it keeps the name's accents ("Próg"), which the others tend to lose.
 */
const ATTEMPTS: PrepareOptions[] = [
  { bright: 100, saturation: 130 },
  {},
  { bright: 130, saturation: 90 },
  { bright: 150, saturation: 80 },
];

export interface WatchPhotoReading {
  workout: ExtractedWatchWorkout | null;
  /** Everything OCR read, attempt by attempt — shown nowhere, but handy when debugging a photo. */
  rawTexts: string[];
}

/**
 * Reads the workout off a photo of the watch with the given OCR engine (Tesseract in the browser,
 * see ocr.ts, or in Node for the fixture tests). Without two attempts agreeing, the first valid
 * reading wins; with none, the workout is null and the user types it in.
 */
export async function readWatchWorkout(
  photo: RgbaImage,
  recognize: (image: RgbaImage) => Promise<string>
): Promise<WatchPhotoReading> {
  const rawTexts: string[] = [];
  const readings: ExtractedWatchWorkout[] = [];
  for (const options of ATTEMPTS) {
    const rawText = await recognize(prepareWatchImage(photo, options));
    rawTexts.push(rawText);
    const workout = extractWatchWorkout(rawText);
    if (!workout || !isValid(workout.text)) continue;

    const agreeing = readings.filter((reading) => reading.text === workout.text);
    if (agreeing.length > 0) {
      const name = [...agreeing, workout].find((reading) => reading.name)?.name;
      return { workout: { name, text: workout.text }, rawTexts };
    }
    readings.push(workout);
  }
  return { workout: readings[0] ?? null, rawTexts };
}

function isValid(text: string): boolean {
  try {
    parseWatchWorkout(text);
    return true;
  } catch {
    return false;
  }
}
