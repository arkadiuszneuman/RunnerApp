import { describe, expect, it } from 'vitest';
import { digitsToTimespan, formatDigits, timespanToDigits } from './durationInput';
import { Timespan } from '../services/Timespan';

describe('formatDigits (mm:ss)', () => {
  it('right-aligns digits into a calculator-style buffer', () => {
    expect(formatDigits('4', 2)).toBe('00:04');
    expect(formatDigits('43', 2)).toBe('00:43');
    expect(formatDigits('430', 2)).toBe('04:30');
    expect(formatDigits('4300', 2)).toBe('43:00');
  });

  it('drops the oldest digit once the buffer is full', () => {
    expect(formatDigits('43005', 2)).toBe('30:05');
  });

  it('ignores non-digit characters', () => {
    expect(formatDigits('4a3b0', 2)).toBe('04:30');
  });
});

describe('formatDigits (h:mm:ss)', () => {
  it('right-aligns into a 6-digit buffer', () => {
    expect(formatDigits('5', 3)).toBe('00:00:05');
    expect(formatDigits('123456', 3)).toBe('12:34:56');
  });
});

describe('digitsToTimespan', () => {
  it('parses mm:ss digits', () => {
    expect(digitsToTimespan('430', 2).equals(Timespan.fromMinutes(4).add(Timespan.fromSeconds(30)))).toBe(true);
  });

  it('parses h:mm:ss digits', () => {
    const expected = Timespan.fromHours(1).add(Timespan.fromMinutes(2)).add(Timespan.fromSeconds(3));
    expect(digitsToTimespan('10203', 3).equals(expected)).toBe(true);
  });
});

describe('timespanToDigits round-trips through formatDigits', () => {
  it('mm:ss', () => {
    const t = Timespan.fromMinutes(7).add(Timespan.fromSeconds(15));
    expect(formatDigits(timespanToDigits(t, 2), 2)).toBe('07:15');
  });

  it('h:mm:ss', () => {
    const t = Timespan.fromHours(2).add(Timespan.fromMinutes(5)).add(Timespan.fromSeconds(9));
    expect(formatDigits(timespanToDigits(t, 3), 3)).toBe('02:05:09');
  });
});
