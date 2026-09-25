import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import useFitPriority from './useFitPriority';

/**
 * A fake container whose `scrollHeight` tracks the hook's own `visibleCount` at read time —
 * jsdom does no real layout, so the hook's shrink loop needs something to measure. `unitHeight`
 * is the cost of each optional section; `clientHeight` is the fixed space actually available.
 */
function fakeContainer(clientHeight: number, baseHeight: number, unitHeight: number) {
  const el = document.createElement('div');
  let visibleCountNow = 0;
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true });
  Object.defineProperty(el, 'scrollHeight', {
    configurable: true,
    get: () => baseHeight + visibleCountNow * unitHeight,
  });
  return { el, setVisibleCountNow: (n: number) => (visibleCountNow = n) };
}

describe('useFitPriority', () => {
  it('converges to the largest visibleCount that fits, in one synchronous pass', () => {
    // base 50px (mandatory content) + up to 3 units of 20px each; only 70px available fits
    // base + exactly 1 unit (70), not base + 2 (90).
    const { el, setVisibleCountNow } = fakeContainer(70, 50, 20);

    const { result } = renderHook(
      (props: { count: number }) => {
        const r = useFitPriority(props.count);
        if (r.containerRef.current !== el) r.containerRef.current = el;
        setVisibleCountNow(r.visibleCount);
        return r;
      },
      { initialProps: { count: 3 } }
    );

    expect(result.current.visibleCount).toBe(1);
  });

  it('does not get stuck mid-shrink — this is the regression the hook used to have: a second', () => {
    // writer resetting `visibleCount` to the same value the shrink loop had already reached
    // made React skip re-running the layout effect, freezing it overflowing. Firing `deps`
    // again mid-test reproduces that "another reset lands during/after the shrink loop" shape;
    // it must still converge, not freeze at whatever count the first pass happened to reach.
    const { el, setVisibleCountNow } = fakeContainer(30, 50, 20);

    const { result, rerender } = renderHook(
      (props: { count: number; salt: number }) => {
        const r = useFitPriority(props.count, [props.salt]);
        if (r.containerRef.current !== el) r.containerRef.current = el;
        setVisibleCountNow(r.visibleCount);
        return r;
      },
      { initialProps: { count: 3, salt: 0 } }
    );

    // Nothing (base 50 alone) fits in a 30px container — must shrink every optional section away.
    expect(result.current.visibleCount).toBe(0);

    rerender({ count: 3, salt: 1 });
    expect(result.current.visibleCount).toBe(0);
  });

  it('grows back when more space becomes available on a later generation', () => {
    let clientHeight = 70;
    const el = document.createElement('div');
    let visibleCountNow = 0;
    Object.defineProperty(el, 'clientHeight', {
      get: () => clientHeight,
      configurable: true,
    });
    Object.defineProperty(el, 'scrollHeight', {
      get: () => 50 + visibleCountNow * 20,
      configurable: true,
    });

    const { result, rerender } = renderHook(
      (props: { salt: number }) => {
        const r = useFitPriority(3, [props.salt]);
        if (r.containerRef.current !== el) r.containerRef.current = el;
        visibleCountNow = r.visibleCount;
        return r;
      },
      { initialProps: { salt: 0 } }
    );

    expect(result.current.visibleCount).toBe(1);

    clientHeight = 130; // now everything fits (50 + 3*20 = 110)
    rerender({ salt: 1 });
    expect(result.current.visibleCount).toBe(3);
  });
});
