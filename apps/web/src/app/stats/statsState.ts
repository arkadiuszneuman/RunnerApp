'use client';

import { useMemo } from 'react';
import {
  buildStatsActivities,
  DEFAULT_STATS_FILTER,
  type ActivityMetrics,
  type StatsActivity,
  type StatsFilter,
  type StatsRunInput,
  type StatsWatchInput,
} from '@runner/core';
import { useAtomValue } from 'jotai';
import { atomWithStorage, createJSONStorage, selectAtom } from 'jotai/utils';
import type { ActivityListItem } from '@/lib/activities/types';
import { activitiesAtom, runsAtom, runStartMs, type RunListItem } from '../userData';

/**
 * Filters (one per page — History defaults to all time, Stats to the last 12 months) — per device,
 * in localStorage: view settings, not account data.
 */
// Blocked storage (private mode, SSR) just means the filter isn't remembered.
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
const safeLocalStorage = () => safeStorage;
export const statsFilterAtom = atomWithStorage(
  'runner.statsFilter',
  DEFAULT_STATS_FILTER,
  createJSONStorage<StatsFilter>(safeLocalStorage)
);
export const HISTORY_DEFAULT_FILTER: StatsFilter = { ...DEFAULT_STATS_FILTER, range: 'all' };
export const historyFilterAtom = atomWithStorage(
  'runner.historyFilter',
  HISTORY_DEFAULT_FILTER,
  createJSONStorage<StatsFilter>(safeLocalStorage)
);
/**
 * A filter atom minus `granularity` — only how the date pickers pick, not what's shown. Pages
 * compute from this, so switching Year/Month/Day doesn't recompute every list and chart.
 */
const withoutGranularity = (filterAtom: typeof statsFilterAtom) =>
  selectAtom(
    filterAtom,
    (filter): StatsFilter => {
      const rest = { ...filter };
      delete rest.granularity;
      return rest;
    },
    (a, b) => JSON.stringify(a) === JSON.stringify(b)
  );
export const statsQueryAtom = withoutGranularity(statsFilterAtom);
export const historyQueryAtom = withoutGranularity(historyFilterAtom);

/** Device time-zone offset (minutes east of UTC) at an instant. */
export const deviceOffsetMin = (ms: number) => -new Date(ms).getTimezoneOffset();

/** An instant in the local-ms encoding the statistics use (see StatsActivity.localMs). */
export const toLocalNow = (ms: number) => ms + deviceOffsetMin(ms) * 60_000;

/** "Now" in that encoding. */
export const nowLocalMs = () => toLocalNow(Date.now());

/** A run list item from a response cached before metrics existed: the basics from its summary. */
function metricsOf(run: RunListItem): ActivityMetrics {
  if (run.metrics) return run.metrics;
  const s = run.summary;
  return {
    distanceM: s.distanceKm * 1000,
    movingS: s.durationSeconds,
    elapsedS: s.durationSeconds,
    ...(s.avgHr > 0 && { avgHr: s.avgHr, maxHr: s.maxHr }),
    bestEfforts: {},
  };
}

export function toRunInput(run: RunListItem): StatsRunInput {
  const startMs = runStartMs(run);
  return {
    id: run.id,
    startMs,
    tzOffsetMin: deviceOffsetMin(startMs),
    programName: run.programName,
    controller: run.controller,
    metrics: metricsOf(run),
    pctInTarget: run.summary.hrTarget?.pctInTarget,
  };
}

export function toWatchInput(a: ActivityListItem): StatsWatchInput {
  const startMs = Date.parse(a.startTime);
  return {
    id: a.id,
    startMs,
    tzOffsetMin: a.tzOffsetMin ?? deviceOffsetMin(startMs),
    sport: a.sport,
    name: a.name ?? undefined,
    linkedRunId: a.linkedRunId,
    metrics: a.metrics,
  };
}

/** Every run (app, watch, merged pairs) as StatsActivity; undefined while runs are loading. */
export function useStatsActivities(keepEmpty = false): StatsActivity[] | undefined {
  const runs = useAtomValue(runsAtom);
  const activities = useAtomValue(activitiesAtom);
  return useMemo(
    () =>
      runs === undefined
        ? undefined
        : buildStatsActivities(runs.map(toRunInput), (activities ?? []).map(toWatchInput), {
            keepEmpty,
          }),
    [runs, activities, keepEmpty]
  );
}

/** Calendar years (local) that have runs, newest first — quick picks in the date filter. */
/** The local date (YYYY-MM-DD) of the earliest activity, if any. */
export function firstDayOf(list: readonly StatsActivity[] | undefined): string | undefined {
  if (!list?.length) return undefined;
  return new Date(Math.min(...list.map((a) => a.localMs))).toISOString().slice(0, 10);
}

export function yearsOf(list: readonly StatsActivity[] | undefined): number[] {
  return [...new Set((list ?? []).map((a) => new Date(a.localMs).getUTCFullYear()))].sort(
    (a, b) => b - a
  );
}
