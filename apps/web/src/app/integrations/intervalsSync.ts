import axios from 'axios';
import { atom } from 'jotai';
import { isRunningAtom } from '../atoms';
import { store } from '../store';
import { activityDetailsAtom, refreshActivities } from '../userData';
import type { IntervalsStatus, SyncResult } from '@/lib/intervals/types';

/** undefined = not loaded yet (or unknown, e.g. offline). */
export const intervalsStatusAtom = atom<IntervalsStatus | undefined>(undefined);

export type SyncProgress = {
  running: boolean;
  imported: number;
  /** Still to import after the last pass. */
  remaining: number;
  /** Why the last sync stopped early, in words. */
  message?: string;
};

export const intervalsSyncAtom = atom<SyncProgress>({ running: false, imported: 0, remaining: 0 });

export async function loadIntervalsStatus(): Promise<IntervalsStatus | undefined> {
  try {
    const { data } = await axios.get<IntervalsStatus>('/api/integrations/intervals');
    store.set(intervalsStatusAtom, data);
    return data;
  } catch {
    return undefined;
  }
}

const STOP_MESSAGES: Record<NonNullable<SyncResult['stopped']>, string> = {
  rate_limited: 'intervals.icu asked to slow down — the rest is imported on the next sync.',
  busy: 'A sync is already running.',
  auth: 'intervals.icu no longer accepts the API key — reconnect it.',
  unreachable: 'intervals.icu is unreachable right now.',
  not_connected: 'intervals.icu is not connected.',
};

/** Upper bound on passes per sync (each imports what fits in ~40 s). */
const MAX_PASSES = 40;

let inFlight: Promise<void> | undefined;

/**
 * Imports new runs from intervals.icu: calls the bounded sync endpoint until nothing remains (or
 * it reports why it stopped), refreshing the activity list as runs arrive. Online-only, like the
 * file import — there's nothing to queue. Concurrent calls share one run.
 */
export function runIntervalsSync(): Promise<void> {
  inFlight ??= (async () => {
    store.set(intervalsSyncAtom, { running: true, imported: 0, remaining: 0 });
    let imported = 0;
    let message: string | undefined;
    let remaining = 0;
    try {
      for (let pass = 0; pass < MAX_PASSES; pass++) {
        const { data } = await axios.post<SyncResult>('/api/integrations/intervals/sync');
        imported += data.imported;
        remaining = data.remaining;
        store.set(intervalsSyncAtom, { running: true, imported, remaining });
        if (data.imported > 0) void refreshActivities();
        // Details fetched before their route was filled in are dropped, so they're fetched again.
        if (data.routes > 0) store.set(activityDetailsAtom, {});
        if (data.stopped) {
          message = STOP_MESSAGES[data.stopped];
          break;
        }
        if (data.remaining === 0) break;
      }
    } catch (error) {
      message =
        axios.isAxiosError(error) && !error.response
          ? 'You are offline.'
          : 'Sync failed — try again later.';
    } finally {
      store.set(intervalsSyncAtom, { running: false, imported, remaining, message });
      await Promise.all([refreshActivities(), loadIntervalsStatus()]);
      inFlight = undefined;
    }
  })();
  return inFlight;
}

/**
 * Background sync on app start: at most once an hour (sooner while GPS routes are still to be
 * fetched), never mid-run, only when connected.
 */
const AUTO_SYNC_INTERVAL_MS = 60 * 60_000;

export async function maybeAutoSync(): Promise<void> {
  const status = await loadIntervalsStatus();
  if (!status?.connected || status.status === 'needs_reconnect') return;
  if (store.get(isRunningAtom) || !navigator.onLine) return;
  const last = status.lastSyncedAt ? Date.parse(status.lastSyncedAt) : 0;
  // Routes still to fetch (stored before routes were kept) don't wait for the hourly sync.
  if (Date.now() - last < AUTO_SYNC_INTERVAL_MS && !(status.routesPending > 0)) return;
  await runIntervalsSync();
}
