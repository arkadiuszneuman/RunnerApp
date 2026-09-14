import { expect, describe, it } from 'vitest'
import { Timespan } from './Timespan';

describe('Timespan', () => {
  describe('totalMilliseconds', () => {
    it('should return correct total milliseconds', () => {
      const span = new Timespan(3661001); // 1h 1m 1s 1ms
      expect(span.totalMilliseconds).toBe(3661001);
    });

    it('should handle zero value', () => {
      const span = new Timespan();
      expect(span.totalMilliseconds).toBe(0);
    });

    it('should handle large values', () => {
      const span = Timespan.fromHours(24); // 1 day
      expect(span.totalMilliseconds).toBe(86400000);
    });

    it('should preserve milliseconds precision', () => {
      const span = new Timespan(1234);
      expect(span.totalMilliseconds).toBe(1234);
    });
  });

  describe('toString', () => {
    it('should format zero timespan correctly', () => {
      const span = new Timespan();
      expect(span.toString()).toBe('00:00:00');
    });

    it('should pad single digits with zeros', () => {
      const span = new Timespan(3661001); // 1h 1m 1s 1ms
      expect(span.toString()).toBe('01:01:01');
    });

    it('should handle large values', () => {
      const span = Timespan.fromHours(23);
      expect(span.toString()).toBe('23:00:00');
    });
  });

  describe('parse', () => {
    it('should parse minutes and seconds', () => {
      let result = Timespan.parse("12:32")
      expect(result.toString()).toBe('00:12:32');

      result = Timespan.parse("02:03")
      expect(result.toString()).toBe('00:02:03');
    });

    it('should parse hours, minutes and seconds', () => {
      let result = Timespan.parse("15:12:32")
      expect(result.toString()).toBe('15:12:32');

      result = Timespan.parse("01:02:03")
      expect(result.toString()).toBe('01:02:03');
    });
  })
  describe('toString with mm:ss format', () => {
    it('should format zero timespan correctly', () => {
      const span = new Timespan();
      expect(span.toString('mm:ss')).toBe('00:00');
    });

    it('should convert hours to minutes', () => {
      const span = new Timespan(3661001); // 1h 1m 1s 1ms
      expect(span.toString('mm:ss')).toBe('61:01');
    });

    it('should handle large values', () => {
      const span = Timespan.fromHours(2); // 2h
      expect(span.toString('mm:ss')).toBe('120:00');
    });

    it('should pad single digits with zeros', () => {
      const span = new Timespan(61000); // 1m 1s
      expect(span.toString('mm:ss')).toBe('01:01');
    });

    it('should handle seconds only', () => {
      const span = Timespan.fromSeconds(45);
      expect(span.toString('mm:ss')).toBe('00:45');
    });
  });

  describe('reviveDeep', () => {
    it('revives a Timespan-shaped object', () => {
      const revived = Timespan.reviveDeep({ totalMilliseconds: 61000 });
      expect(revived).toBeInstanceOf(Timespan);
      expect((revived as Timespan).totalMilliseconds).toBe(61000);
    });

    it('revives Timespans nested inside plain objects and arrays', () => {
      const input = {
        stages: [
          { type: 'simple', duration: { totalMilliseconds: 30000 } },
          { type: 'sprint', duration: { totalMilliseconds: 15000 }, tempo: { totalMilliseconds: 300000 } },
        ],
      };
      const revived = Timespan.reviveDeep(input) as typeof input;
      expect(revived.stages[0].duration).toBeInstanceOf(Timespan);
      expect((revived.stages[0].duration as unknown as Timespan).totalMilliseconds).toBe(30000);
      expect(revived.stages[1].tempo).toBeInstanceOf(Timespan);
    });

    it('leaves plain values (numbers, strings, multi-key objects) untouched', () => {
      const input = { t: 12, hr: 140, si: 0, meta: { a: 1, b: 2 } };
      expect(Timespan.reviveDeep(input)).toEqual(input);
    });

    it('matches JSON.parse(text, Timespan.reviver) on the same structure', () => {
      const original = { duration: new Timespan(45000), label: 'stage' };
      const json = JSON.stringify(original);
      const viaReviver = JSON.parse(json, Timespan.reviver);
      const viaDeep = Timespan.reviveDeep(JSON.parse(json));
      expect(viaDeep).toEqual(viaReviver);
    });
  });

});
