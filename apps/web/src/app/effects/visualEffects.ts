import { useEffect } from 'react';
import { atom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';
import { store } from '../store';
import { EFFECTS_CHOICE_KEY as CHOICE_KEY, isLite, SLOW_GPU_KEY } from './effectsBoot';

/**
 * Lighter visual effects for devices whose GPU can't keep up. Every glass surface (theme.ts's
 * `glass`: cards, the nav) blurs what's behind it, and behind it is the animated aurora — so the
 * GPU re-blurs every card on every frame, even on a page where nothing moves. A fast phone
 * doesn't notice; a 2021 Snapdragon 870 drops a fifth of its frames on Stats. `lite` drops the
 * blur (globals.css, `html[data-effects='lite']`) and makes the floating bars more opaque instead.
 *
 * Per device, in localStorage: the user's choice (Settings) and whether this device was measured
 * slow. The attribute is set before first paint by EFFECTS_BOOT_SCRIPT (effectsBoot.ts, inlined by layout.tsx) and then by
 * every write here — never from React state, which starts at the defaults until storage loads.
 */
export type EffectsChoice = 'auto' | 'full' | 'lite';

const safeStorage = {
  getItem: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};

const choiceStorageAtom = atomWithStorage<EffectsChoice>(
  CHOICE_KEY,
  'auto',
  createJSONStorage<EffectsChoice>(() => safeStorage)
);
const slowGpuStorageAtom = atomWithStorage<boolean>(
  SLOW_GPU_KEY,
  false,
  createJSONStorage<boolean>(() => safeStorage)
);

// Straight from storage: the atoms only hold it once something has subscribed to them.
const read = (key: string): unknown => {
  try {
    return JSON.parse(safeStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
};

/** Sets `data-effects` on <html> from what's stored. Mirrors EFFECTS_BOOT_SCRIPT. */
function applyEffects(): void {
  const root = document.documentElement;
  if (isLite(read(CHOICE_KEY), read(SLOW_GPU_KEY))) root.dataset.effects = 'lite';
  else delete root.dataset.effects;
}

export const effectsChoiceAtom = atom(
  (get) => get(choiceStorageAtom),
  (_get, set, choice: EffectsChoice) => {
    set(choiceStorageAtom, choice);
    applyEffects();
  }
);

export const slowGpuAtom = atom(
  (get) => get(slowGpuStorageAtom),
  (_get, set, slow: boolean) => {
    set(slowGpuStorageAtom, slow);
    applyEffects();
  }
);

/** Frame intervals longer than this are the main thread being busy, not the GPU falling behind. */
const BUSY_MAIN_THREAD_MS = 100;
/** An interval this much longer than the typical one is a frame that missed its vsync. */
const MISSED_FRAME_FACTOR = 1.4;

/** How many of a window's frames missed their vsync, out of those that tell (see above). */
export function assessFrames(intervals: readonly number[]): { frames: number; missed: number } {
  const kept = intervals.filter((ms) => ms > 0 && ms < BUSY_MAIN_THREAD_MS);
  if (kept.length === 0) return { frames: 0, missed: 0 };
  const typical = [...kept].sort((a, b) => a - b)[kept.length >> 1];
  return {
    frames: kept.length,
    missed: kept.filter((ms) => ms > typical * MISSED_FRAME_FACTOR).length,
  };
}

const MIN_WINDOW_FRAMES = 30;
/** A window with more missed frames than this is janky — a fast phone stays near 0. */
const JANKY_WINDOW_SHARE = 0.15;
/** Janky windows in one session before the device counts as slow (one could be a fluke). */
const JANKY_WINDOWS = 2;

export const isJankyWindow = ({ frames, missed }: { frames: number; missed: number }) =>
  frames >= MIN_WINDOW_FRAMES && missed / frames > JANKY_WINDOW_SHARE;

/** Wait for the route to have rendered, then watch it sit there for this long. */
const SETTLE_MS = 1000;
const SAMPLE_MS = 1500;

let jankyWindows = 0;

/**
 * While effects are on `auto` and the device isn't known to be slow, samples the frame rate for a
 * moment after every route change (which is when it shows: a page full of cards just appeared)
 * and switches this device to lite effects once it keeps missing frames.
 */
export function useSlowGpuDetection(pathname: string): void {
  useEffect(() => {
    if (typeof requestAnimationFrame === 'undefined') return;
    const choice = read(CHOICE_KEY) ?? 'auto';
    if (choice !== 'auto' || read(SLOW_GPU_KEY) === true) return;
    // Reduced motion stops the aurora, and with it most of the cost.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    const times: number[] = [];
    const finish = () => {
      if (document.visibilityState !== 'visible') return;
      const sampled = assessFrames(times.slice(1).map((t, i) => t - times[i]));
      if (isJankyWindow(sampled) && ++jankyWindows >= JANKY_WINDOWS) store.set(slowGpuAtom, true);
    };
    const timer = setTimeout(() => {
      const start = performance.now();
      const sample = (t: number) => {
        times.push(t);
        if (t - start < SAMPLE_MS) frame = requestAnimationFrame(sample);
        else finish();
      };
      frame = requestAnimationFrame(sample);
    }, SETTLE_MS);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [pathname]);
}
