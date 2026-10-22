import { describe, expect, it } from 'vitest';
import { isLite } from './effectsBoot';
import { assessFrames, isJankyWindow } from './visualEffects';

describe('assessFrames', () => {
  it('counts frames that missed their vsync against the typical interval', () => {
    const smooth = Array(90).fill(16.7);
    expect(assessFrames(smooth)).toEqual({ frames: 90, missed: 0 });
    // Measured on a POCO F4 (Snapdragon 870) sitting on Stats: every few frames one doubles.
    const poco = [...Array(70).fill(16.5), ...Array(20).fill(24.8), ...Array(5).fill(33)];
    expect(assessFrames(poco)).toEqual({ frames: 95, missed: 25 });
  });

  it('works at any refresh rate', () => {
    expect(assessFrames([...Array(160).fill(8.3), ...Array(40).fill(16.7)])).toEqual({
      frames: 200,
      missed: 40,
    });
  });

  it('ignores the main thread being busy', () => {
    expect(assessFrames([...Array(60).fill(16.7), 140, 260])).toEqual({ frames: 60, missed: 0 });
    expect(assessFrames([])).toEqual({ frames: 0, missed: 0 });
  });
});

describe('isJankyWindow', () => {
  it('needs enough frames and more than 15% of them missed', () => {
    expect(isJankyWindow({ frames: 95, missed: 25 })).toBe(true);
    expect(isJankyWindow({ frames: 119, missed: 4 })).toBe(false);
    expect(isJankyWindow({ frames: 10, missed: 9 })).toBe(false);
  });
});

describe('isLite', () => {
  it('follows the choice, and the measurement on auto', () => {
    expect(isLite('lite', false)).toBe(true);
    expect(isLite('full', true)).toBe(false);
    expect(isLite('auto', true)).toBe(true);
    expect(isLite(null, true)).toBe(true);
    expect(isLite('auto', false)).toBe(false);
  });
});
