'use client';

import { DependencyList, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Greedily fits as many priority-ordered optional sections as possible into a container's
 * available height, so the run screen never scrolls vertically. Give it the number of optional
 * sections (ordered highest-priority first) and a ref to attach to the flex container that holds
 * them (that container needs a bounded height from its flex parent — `flex: 1; min-height: 0` —
 * plus `overflow: hidden`, so its `scrollHeight` can legitimately exceed its `clientHeight`).
 * Each section then renders conditionally on `visibleCount > itsPriorityIndex` (0 = shown first).
 *
 * Strategy: whenever the container resizes (or `deps` changes — see below), optimistically show
 * everything again, then repeatedly measure and drop the lowest-priority (highest-index) visible
 * section until it fits. Resetting to "show everything" on every resize (rather than only ever
 * shrinking) is what lets sections reappear when the viewport grows or rotates.
 *
 * All writes to `visibleCount` happen in the one layout effect below, gated by a `generation`
 * counter that only the resize observer and `deps` bump. Resize/deps and the shrink loop used to
 * be two independent effects each calling `setVisibleCount` directly — the resize observer's
 * first notification (always async, arriving shortly after mount) could land in the middle of the
 * shrink loop's own cascade of updates and reset `visibleCount` back to `optionalCount` right as
 * the loop had already stepped it down to the same value from a previous pass, so React saw no
 * net change and never re-ran the layout effect again — silently freezing mid-shrink with content
 * still overflowing. Routing every reset through `generation` (checked once per effect run, before
 * the shrink check) removes that race: there is exactly one writer.
 *
 * `deps` re-triggers that same "show everything, then shrink" pass for content changes that don't
 * resize the container itself (which is bounded by its flex parent, so growing content inside it
 * doesn't fire the resize observer) — e.g. a longer "up next" stage name wrapping to a second line.
 */
export default function useFitPriority(
  optionalCount: number,
  deps: DependencyList = []
): { containerRef: React.RefObject<HTMLDivElement | null>; visibleCount: number } {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(optionalCount);
  const [generation, setGeneration] = useState(0);
  const lastGenerationRef = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // ResizeObserver's first callback fires (asynchronously) on observe() with the current
    // size, so this also drives the initial fit — no separate mount-time measurement needed.
    const observer = new ResizeObserver(() => setGeneration((g) => g + 1));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setGeneration((g) => g + 1), deps);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (lastGenerationRef.current !== generation) {
      // A resize or a `deps` change: start optimistic again. The shrink check below runs on the
      // next effect pass, once this reset has actually rendered.
      lastGenerationRef.current = generation;
      setVisibleCount(optionalCount);
      return;
    }
    if (visibleCount > 0 && el.scrollHeight > el.clientHeight + 1) {
      setVisibleCount((v) => v - 1);
    }
  }, [visibleCount, generation, optionalCount]);

  return { containerRef, visibleCount };
}
