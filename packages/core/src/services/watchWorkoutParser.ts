import { Timespan } from './Timespan';
import { MultiplyStage, Stage } from './stagesCalculator';
import {
  COOLDOWN_BPM,
  COOLDOWN_DURATION,
  REGENERATION_BPM,
  REGENERATION_DURATION,
  WARMUP_BPM,
  WARMUP_DURATION,
} from './trainingDefaults';

const TIME = String.raw`\d{1,2}(?::\d{2}){1,2}`;
const BLOCK_REGEX = new RegExp(
  String.raw`^(?:(\d+)\s*x\s*)?(${TIME})\s*@\s*(\d+)(?:\s+(${TIME}))?$`
);
const STEADY_REGEX = new RegExp(String.raw`^(?:(\d+)\s+(${TIME})|(${TIME})\s+(\d+))$`);

const MIN_BPM = 40;
const MAX_BPM = 240;

export interface WatchWorkout {
  name?: string;
  stages: MultiplyStage[];
}

/**
 * Parses a workout written the way a Garmin watch shows it:
 *
 *   "143bpm 31:00"        — one steady stage: 31:00 at 143 bpm
 *   "21:00@169bpm 41:00"  — a 21:00 block at 169 bpm inside a 41:00 workout; the rest is split
 *                           evenly into a warmup before it and a cooldown after it
 *   "21:00@169"           — the same block with the default 10:00 warmup and cooldown
 *   "4x4:00@184 [total]"  — intervals shaped like parseProgram's (sprint + regeneration),
 *                           warmup/cooldown fitted to the total when one is given
 *
 * Case, spacing and the "bpm" suffix don't matter, durations are M:SS or H:MM:SS, and any
 * words before the first number are the workout's name ("Próg 21:00@169bpm 41:00").
 */
export function parseWatchWorkout(text: string): WatchWorkout {
  const trimmed = text.trim();
  const firstDigit = trimmed.search(/\d/);
  if (firstDigit < 0) throw formatError(text);

  const name =
    trimmed
      .slice(0, firstDigit)
      .replace(/[\s\p{P}]+$/u, '')
      .trim() || undefined;
  const body = trimmed
    .slice(firstDigit)
    .toLowerCase()
    .replace(/×/g, 'x')
    .replace(/\s*bpm\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const block = body.match(BLOCK_REGEX);
  if (block) {
    const times = block[1] ? parseInt(block[1], 10) : 1;
    if (times < 1) throw new Error('Number of intervals must be at least 1');
    const work = parseDuration(block[2]);
    const bpm = parseBpm(block[3]);
    const total = block[4] ? parseDuration(block[4]) : undefined;
    return { name, stages: blockWorkout(times, work, bpm, total) };
  }

  const steady = body.match(STEADY_REGEX);
  if (steady) {
    const bpm = parseBpm(steady[1] ?? steady[4]);
    const duration = parseDuration(steady[2] ?? steady[3]);
    return { name, stages: [{ times: 1, stages: [hrStage('simple', duration, bpm)] }] };
  }

  throw formatError(text);
}

function blockWorkout(
  times: number,
  work: Timespan,
  bpm: number,
  total?: Timespan
): MultiplyStage[] {
  const intervals: MultiplyStage =
    times === 1
      ? { times: 1, stages: [hrStage('simple', work, bpm)] }
      : {
          times,
          stages: [
            hrStage('sprint', work, bpm),
            hrStage('regeneration', REGENERATION_DURATION, REGENERATION_BPM),
          ],
        };

  let warmup = WARMUP_DURATION;
  let cooldown = COOLDOWN_DURATION;
  if (total) {
    // calculateStages drops a repeated block's last stage, so N intervals have N - 1 recoveries.
    const coreSeconds =
      times * work.totalSeconds + (times - 1) * REGENERATION_DURATION.totalSeconds;
    const restSeconds = total.totalSeconds - coreSeconds;
    if (restSeconds < 0) {
      throw new Error(
        `The total ${formatDuration(total)} is shorter than the workout itself (${formatDuration(Timespan.fromSeconds(coreSeconds))})`
      );
    }
    const warmupSeconds = Math.ceil(restSeconds / 2);
    warmup = Timespan.fromSeconds(warmupSeconds);
    cooldown = Timespan.fromSeconds(restSeconds - warmupSeconds);
  }

  return [
    ...(warmup.totalSeconds > 0
      ? [{ times: 1, stages: [hrStage('simple', warmup, WARMUP_BPM)] }]
      : []),
    intervals,
    ...(cooldown.totalSeconds > 0
      ? [{ times: 1, stages: [hrStage('simple', cooldown, COOLDOWN_BPM)] }]
      : []),
  ];
}

function hrStage(type: Stage['type'], duration: Timespan, bmp: number): Stage {
  return { type, duration, speedType: 'bmp', bmp };
}

function parseDuration(text: string): Timespan {
  const parts = text.split(':');
  if (parts.slice(1).some((part) => Number(part) >= 60)) {
    throw new Error(`"${text}" isn't a valid duration`);
  }
  const duration = Timespan.parse(text);
  if (duration.totalSeconds <= 0) throw new Error('A duration must be longer than 0:00');
  return duration;
}

function parseBpm(text: string): number {
  const bpm = parseInt(text, 10);
  if (bpm < MIN_BPM || bpm > MAX_BPM) {
    throw new Error(`${bpm} bpm is outside ${MIN_BPM}–${MAX_BPM}`);
  }
  return bpm;
}

function formatDuration(duration: Timespan): string {
  return duration.toString(duration.totalSeconds >= 3600 ? 'hh:mm:ss' : 'mm:ss');
}

function formatError(text: string): Error {
  return new Error(
    `Couldn't read "${text.trim()}". Write it as on the watch, e.g. 21:00@169bpm 41:00, 143bpm 31:00 or 4x4:00@184`
  );
}

export interface ExtractedWatchWorkout {
  name?: string;
  /** One line in parseWatchWorkout's notation, without the name. */
  text: string;
}

const OCR_BLOCK =
  /(?:(\d{1,2})\s*[x×]\s*)?(?<!\d)(\d{1,2}:\d{2}(?::\d{2})?)\s*@\s*(\d{2,3})(?!\d)(?:\s*bpm)?/;
const OCR_HR = /(?<!\d)(\d{2,3})\s*bpm/;
const OCR_TIME = /(?<![\d:])\d{1,2}:\d{2}(?::\d{2})?(?![\d:])/g;

/**
 * Pulls the workout out of what OCR read off a photo of the watch's workout screen, e.g.
 * "JUTRO\nBaza\n143bpm\n31:00" → { name: 'Baza', text: '143bpm 31:00' }. Fixes the usual
 * misreads around numbers (O→0, l→1, 31.00→31:00, bprn→bpm, ©→@) and skips the all-caps day
 * header above the name. Null when no workout is recognisable.
 */
export function extractWatchWorkout(ocrText: string): ExtractedWatchWorkout | null {
  const lines = ocrText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const normalized = lines.map(normalizeNumbers);
  const firstNumeric = normalized.findIndex((line) => /\d:\d{2}|\dbpm|@/.test(line));
  if (firstNumeric < 0) return null;

  let joined = normalized.slice(firstNumeric).join(' ');
  let text: string;

  const block = joined.match(OCR_BLOCK);
  if (block) {
    joined = joined.replace(block[0], ' ');
    const times = block[1] && parseInt(block[1], 10) > 1 ? `${parseInt(block[1], 10)}x` : '';
    const total = lastMatch(joined, OCR_TIME);
    text = `${times}${block[2]}@${block[3]}bpm${total ? ` ${total}` : ''}`;
  } else {
    const hr = joined.match(OCR_HR);
    if (!hr) return null;
    joined = joined.replace(hr[0], ' ');
    const duration = lastMatch(joined, OCR_TIME);
    if (!duration) return null;
    text = `${hr[1]}bpm ${duration}`;
  }

  return { name: workoutName(lines.slice(0, firstNumeric)), text };
}

function lastMatch(text: string, regex: RegExp): string | undefined {
  const matches = text.match(regex);
  return matches ? matches[matches.length - 1] : undefined;
}

function normalizeNumbers(line: string): string {
  // Letters OCR confuses with digits, when they touch a digit — repeated, so "OO" after a
  // colon becomes "00" one character at a time.
  let fixed = line;
  for (let previous = ''; previous !== fixed;) {
    previous = fixed;
    fixed = fixed
      .replace(/[Oo](?=[\d:.])|(?<=[\d:.])[Oo]/g, '0')
      .replace(/[lI|](?=[\d:.])|(?<=[\d:.])[lI|]/g, '1')
      .replace(/S(?=\d)|(?<=\d)S/g, '5');
  }
  return (
    fixed
      // A misread colon between minutes and seconds.
      .replace(/(\d)\s?[.;,](\d{2})(?!\d)/g, '$1:$2')
      .replace(/(\d)\s*[©®](?=\s*\d)/g, '$1@')
      .replace(/(\d)\s*(?:bprn|bpn|hpm|bprm|opm)\b/gi, '$1bpm')
  );
}

/** The workout's name: the nearest line above the numbers that isn't the ALL-CAPS day header. */
function workoutName(lines: string[]): string | undefined {
  for (const line of [...lines].reverse()) {
    const words = line.match(/[\p{L}\d]{2,}/gu)?.filter((word) => /\p{L}/u.test(word));
    if (!words?.some((word) => /\p{L}{3,}/u.test(word))) continue;
    if (words.every((word) => word === word.toUpperCase())) continue;
    const name = words.join(' ');
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return undefined;
}
