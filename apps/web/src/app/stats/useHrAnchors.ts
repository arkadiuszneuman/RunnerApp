import { useMemo } from 'react';
import type { HrAnchors, StatsActivity } from '@runner/core';
import { useAtomValue } from 'jotai';
import { athleteProfileAtom } from '../userData';

/** Used for resting HR when the profile doesn't say. */
const DEFAULT_RESTING_HR = 60;

/**
 * Heart-rate anchors for zones, load and HR-based fitness: the profile's values, falling back to
 * the highest heart rate seen in the last year and a typical resting rate. `estimated` says
 * whether any fallback was used, so the page can suggest filling in the profile.
 */
export function useHrAnchors(
  all: readonly StatsActivity[] | undefined,
  nowMs: number
): (HrAnchors & { estimated: boolean }) | undefined {
  const profile = useAtomValue(athleteProfileAtom);
  return useMemo(() => {
    const yearAgo = nowMs - 365 * 86_400_000;
    const observedMax = Math.max(
      0,
      ...(all ?? []).filter((a) => a.startMs > yearAgo).map((a) => a.maxHr ?? 0)
    );
    const maxHr = profile?.maxHr ?? (observedMax >= 150 ? observedMax : undefined);
    if (!maxHr) return undefined;
    const restingHr = profile?.restingHr ?? DEFAULT_RESTING_HR;
    return { maxHr, restingHr, estimated: !profile?.maxHr || !profile?.restingHr };
  }, [all, profile, nowMs]);
}
