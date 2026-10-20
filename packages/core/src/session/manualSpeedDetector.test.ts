import { describe, expect, it } from 'vitest';
import { ManualSpeedDetector } from './manualSpeedDetector';

/** Feeds readings 600ms apart (the STATUS poll cadence) from `start`; returns each verdict. */
function feed(detector: ManualSpeedDetector, start: number, speeds: number[]): boolean[] {
  return speeds.map((speed, i) => detector.reading(speed, start + i * 600));
}

function settledAt(speed: number): ManualSpeedDetector {
  const detector = new ManualSpeedDetector();
  detector.command(speed, 0);
  feed(detector, 0, [speed, speed, speed]);
  expect(detector.isSettled).toBe(true);
  return detector;
}

describe('ManualSpeedDetector', () => {
  it('catches a single 0.1 press once the belt holds the new speed', () => {
    const detector = settledAt(8);
    expect(feed(detector, 10_000, [8.1, 8.1])).toEqual([false, true]);
  });

  it('catches a held button while the speed keeps changing', () => {
    const detector = settledAt(8);
    expect(feed(detector, 10_000, [7.9, 7.8])).toEqual([false, true]);
  });

  it('catches a big jump at once', () => {
    const detector = settledAt(8);
    expect(detector.reading(9, 10_000)).toBe(true);
  });

  it('ignores a single odd reading', () => {
    const detector = settledAt(8);
    expect(feed(detector, 10_000, [7.9, 8, 8, 8.1, 8])).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it('lets the belt ramp toward a new target', () => {
    const detector = settledAt(6);
    detector.command(8, 10_000);
    expect(feed(detector, 10_000, [6, 6, 6.4, 6.8, 7.2, 7.6, 8, 8]).some(Boolean)).toBe(false);
    expect(detector.isSettled).toBe(true);
  });

  it('lets the belt finish a ramp toward a target the app has already replaced', () => {
    const detector = settledAt(8);
    detector.command(8.2, 10_000);
    expect(detector.reading(8.1, 10_600)).toBe(false);
    // The app turns back to 8.0 while the belt is still heading for 8.2, and only takes the
    // new command a couple of readings later.
    detector.command(8, 11_000);
    expect(feed(detector, 11_200, [8.2, 8.2, 8.1, 8, 8]).some(Boolean)).toBe(false);
  });

  it('does not take passing through the target on the way to an older one as settled', () => {
    const detector = settledAt(8.2);
    detector.command(7.8, 10_000);
    detector.command(8.2, 10_500);
    detector.command(8, 11_000);
    // Still heading down for 7.8, it passes 8.0 without stopping there.
    expect(feed(detector, 11_000, [8.1, 8, 7.9, 7.9, 8, 8]).some(Boolean)).toBe(false);
  });

  it('waits for a command the belt hasn’t started on yet', () => {
    const detector = settledAt(8);
    detector.command(9, 10_000);
    expect(feed(detector, 10_000, [8, 8, 8, 8, 8, 8, 8, 8]).some(Boolean)).toBe(false);
    expect(detector.isSettled).toBe(false);
  });

  it('starts over on reset', () => {
    const detector = settledAt(8);
    detector.reset();
    expect(detector.reading(12, 10_000)).toBe(false);
    expect(detector.isSettled).toBe(false);
  });
});
