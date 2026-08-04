import { Timespan } from '../services/Timespan';

/** `fields`: 2 → mm:ss (e.g. tempo, capped well under an hour); 3 → h:mm:ss (e.g. segment duration). */
export type DurationFields = 2 | 3;

function digitCount(fields: DurationFields): number {
  return fields * 2;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Right-aligns the raw digit-entry string into a fixed-width buffer, like a
 * calculator/ATM: new digits push in from the right, and once the buffer is
 * full, the oldest digit falls off the left. `formatDigits('4', 2)` → '00:04',
 * `formatDigits('430', 2)` → '04:30', `formatDigits('43005', 2)` → '30:05'.
 */
export function formatDigits(digits: string, fields: DurationFields): string {
  const n = digitCount(fields);
  const clean = digits.replace(/\D/g, '').slice(-n).padStart(n, '0');
  const parts: string[] = [];
  for (let i = 0; i < fields; i++) {
    parts.push(clean.slice(i * 2, i * 2 + 2));
  }
  return parts.join(':');
}

export function digitsToTimespan(digits: string, fields: DurationFields): Timespan {
  const n = digitCount(fields);
  const clean = digits.replace(/\D/g, '').slice(-n).padStart(n, '0');

  if (fields === 3) {
    const hours = Number(clean.slice(0, 2));
    const minutes = Number(clean.slice(2, 4));
    const seconds = Number(clean.slice(4, 6));
    return Timespan.fromHours(hours).add(Timespan.fromMinutes(minutes)).add(Timespan.fromSeconds(seconds));
  }

  const minutes = Number(clean.slice(0, 2));
  const seconds = Number(clean.slice(2, 4));
  return Timespan.fromMinutes(minutes).add(Timespan.fromSeconds(seconds));
}

/** Inverse of digitsToTimespan — used to seed the digit buffer from an existing value (e.g. editing a saved stage). */
export function timespanToDigits(timespan: Timespan, fields: DurationFields): string {
  if (fields === 3) {
    return `${pad2(timespan.hours)}${pad2(timespan.minutes)}${pad2(timespan.seconds)}`;
  }
  return `${pad2(timespan.minutes)}${pad2(timespan.seconds)}`;
}
