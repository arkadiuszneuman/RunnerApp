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
});
