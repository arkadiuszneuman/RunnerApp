import { describe, expect, it } from 'vitest';
import { parseProgram } from './programTextParser';
import { Timespan } from './Timespan';
import {
  COOLDOWN_BPM,
  COOLDOWN_DURATION,
  REGENERATION_BPM,
  REGENERATION_DURATION,
  WARMUP_BPM,
  WARMUP_DURATION,
} from './trainingDefaults';

describe('parseProgram', () => {
  it('parses a standard 4x4:00@184 program', () => {
    const result = parseProgram('4x4:00@184');

    expect(result).toHaveLength(3);

    // Warmup
    expect(result[0]).toEqual({
      times: 1,
      stages: [
        { type: 'simple', duration: WARMUP_DURATION, speedType: 'bmp', bmp: WARMUP_BPM },
      ],
    });

    // Intervals
    expect(result[1]).toEqual({
      times: 4,
      stages: [
        { type: 'sprint', duration: Timespan.fromMinutes(4), speedType: 'bmp', bmp: 184 },
        { type: 'regeneration', duration: REGENERATION_DURATION, speedType: 'bmp', bmp: REGENERATION_BPM },
      ],
    });

    // Cooldown
    expect(result[2]).toEqual({
      times: 1,
      stages: [
        { type: 'simple', duration: COOLDOWN_DURATION, speedType: 'bmp', bmp: COOLDOWN_BPM },
      ],
    });
  });

  it('parses different repetition counts and BPMs', () => {
    const result = parseProgram('8x3:30@175');

    expect(result[1].times).toBe(8);
    expect(result[1].stages[0]).toMatchObject({
      duration: Timespan.fromMinutes(3).add(Timespan.fromSeconds(30)),
      bmp: 175,
    });
  });

  it('regeneration duration is always fixed at 2 minutes', () => {
    const result = parseProgram('5x1:00@190');
    const regeneration = result[1].stages[1];

    expect(regeneration.duration).toEqual(Timespan.fromMinutes(2));
  });

  it('trims whitespace around the input', () => {
    expect(() => parseProgram('  4x4:00@184  ')).not.toThrow();
  });

  it('throws on empty input', () => {
    expect(() => parseProgram('')).toThrow(/Invalid format/);
  });

  it('throws on missing BPM', () => {
    expect(() => parseProgram('4x4:00')).toThrow(/Invalid format/);
  });

  it('throws on missing repetitions', () => {
    expect(() => parseProgram('4:00@184')).toThrow(/Invalid format/);
  });

  it('throws on invalid duration format', () => {
    expect(() => parseProgram('4x4@184')).toThrow(/Invalid format/);
  });

  it('throws on completely wrong text', () => {
    expect(() => parseProgram('not a program')).toThrow(/Invalid format/);
  });
});
