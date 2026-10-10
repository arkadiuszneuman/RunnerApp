import { describe, expect, it } from 'vitest';
import { SizeBatcher } from './batch';

function collect<T>(items: T[], maxBytes: number, maxItems = Infinity): T[][] {
  const batches: T[][] = [];
  const batcher = new SizeBatcher<T>(maxBytes, maxItems, (b) => batches.push(b));
  items.forEach((item) => batcher.add(item));
  batcher.flush();
  return batches;
}

describe('SizeBatcher', () => {
  it('keeps every batch under the byte limit, in order', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ i, pad: 'x'.repeat(40) }));
    const batches = collect(items, 120);
    expect(batches.flat()).toEqual(items);
    for (const batch of batches) expect(JSON.stringify(batch).length).toBeLessThanOrEqual(120);
    expect(batches.length).toBeGreaterThan(1);
  });

  it('caps the item count', () => {
    expect(collect([1, 2, 3, 4, 5], 1_000, 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('sends an oversized item on its own, and nothing for no items', () => {
    expect(collect(['a'.repeat(50), 'b'], 20)).toEqual([['a'.repeat(50)], ['b']]);
    expect(collect([], 20)).toEqual([]);
  });
});
