import { useEffect, useState } from 'react';

/**
 * Delays mounting expensive content (a chart.js chart) by `index` animation
 * frames after the caller first renders, so several charts that would
 * otherwise all mount in the same commit on the run detail page don't all
 * block the main thread in one long task — each gets its own frame, letting
 * input and paint interleave between them. Pass 0 for content that should
 * mount immediately (e.g. the first chart above the fold).
 */
export function useDeferredMount(index: number): boolean {
  const [ready, setReady] = useState(index <= 0);

  useEffect(() => {
    if (ready) return;
    let raf = 0;
    let count = 0;
    const step = () => {
      count += 1;
      if (count >= index) setReady(true);
      else raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ready;
}
