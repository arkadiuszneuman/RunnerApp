import { describe, expect, it } from 'vitest';
import { gooFrames } from './gooeyMorph';

const W = 100;
const slot = (i: number) => ({ left: i * W, width: W });

describe('gooFrames', () => {
  it('starts as one blob on the old option and ends as one blob on the new', () => {
    const frames = gooFrames(slot(0), slot(2), W);
    const first = frames[0];
    const last = frames[frames.length - 1];
    expect(first.drop).toEqual({ center: 50, sx: 1, sy: 1 });
    expect(last.offset).toBe(1);
    expect(last.drop.center).toBe(250);
    expect(last.drop.sx).toBeCloseTo(1);
    expect(last.drop.sy).toBeCloseTo(1);
    expect(last.anchor.sx).toBe(0);
    expect(last.catcher.sx).toBe(0);
  });

  it('keeps the flying drop thinner than at rest and never longer than maxStretch', () => {
    const frames = gooFrames(slot(3), slot(0), W, { maxStretch: 1.3 });
    expect(Math.max(...frames.map((f) => f.drop.sx))).toBeLessThanOrEqual(1.3 + 1e-9);
    expect(Math.min(...frames.map((f) => f.drop.sy))).toBeLessThan(0.75);
  });

  it('leaves part of the goo stuck to the old option for a while', () => {
    const frames = gooFrames(slot(0), slot(1), W);
    const early = frames.find((f) => f.offset >= 0.2)!;
    expect(early.anchor.sx).toBeGreaterThan(0.5);
    expect(Math.abs(early.anchor.center - 50)).toBeLessThan(W / 2);
  });

  it('has the new option reach out towards the incoming drop', () => {
    const frames = gooFrames(slot(0), slot(2), W);
    const reaching = frames.filter((f) => f.catcher.sx > 0.1);
    expect(reaching.length).toBeGreaterThan(0);
    // Leaning back towards where the drop comes from.
    expect(Math.min(...reaching.map((f) => f.catcher.center))).toBeLessThan(250);
  });

  it('draws the drop back before a slingshot flight', () => {
    const frames = gooFrames(slot(1), slot(3), W, { pullBackPx: 5, pullShare: 0.25 });
    const pulled = frames.find((f) => f.offset >= 0.2)!;
    expect(pulled.drop.center).toBeLessThan(150);
    expect(pulled.anchor.sx).toBe(0);
  });
});
