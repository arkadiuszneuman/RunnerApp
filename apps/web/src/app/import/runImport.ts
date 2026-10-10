import type { ImportedActivity } from '@runner/core';
import axios from 'axios';
import { SizeBatcher } from './batch';
import type { ImportWorkerMessage } from './protocol';

export type ImportProgress = {
  /** FIT files decoded so far. */
  files: number;
  /** Runs found in them. */
  found: number;
  /** Files that held something other than a run (rides, walks, settings…). */
  skipped: number;
  /** Files or entries that couldn't be read. */
  failed: number;
  inserted: number;
  updated: number;
  duplicates: number;
  done: boolean;
  /** Set when the import stopped early (offline, server error, cancelled). */
  error?: string;
};

/** Upload batches: comfortably under Vercel's 4.5 MB request limit. */
const MAX_BATCH_BYTES = 2_000_000;
const MAX_BATCH_ITEMS = 100;

type ImportResponse = { inserted: number; updated: number; duplicates: number };

/**
 * Imports watch activities from user-picked files (FIT, gzipped FIT, zips of them, or Garmin's
 * whole data export): a worker unpacks and decodes them (importWorker.ts) while this uploads the
 * runs it finds to POST /api/activities in size-bounded batches, one request at a time.
 * Online-only by design — unlike other writes this doesn't go through the offline outbox: it's an
 * explicit, watched action whose payload can be far bigger than anything worth persisting in
 * IndexedDB, and re-running it is harmless (the server recognises what it already has).
 */
export function runImport(
  files: File[],
  onProgress: (progress: ImportProgress) => void
): { done: Promise<ImportProgress>; cancel: () => void } {
  const progress: ImportProgress = {
    files: 0,
    found: 0,
    skipped: 0,
    failed: 0,
    inserted: 0,
    updated: 0,
    duplicates: 0,
    done: false,
  };
  const emit = () => onProgress({ ...progress });

  let resolveDone: (progress: ImportProgress) => void = () => {};
  const done = new Promise<ImportProgress>((resolve) => (resolveDone = resolve));
  const worker = new Worker(new URL('./importWorker.ts', import.meta.url), { type: 'module' });
  let uploads: Promise<void> = Promise.resolve();

  /** Ends the import — early (with `error`) or once everything is uploaded. */
  const complete = (error?: string) => {
    if (progress.done) return;
    worker.terminate();
    progress.error ??= error;
    progress.done = true;
    emit();
    resolveDone({ ...progress });
  };

  const upload = async (batch: ImportedActivity[]) => {
    if (progress.done) return;
    try {
      const { data } = await axios.post<ImportResponse>('/api/activities', { activities: batch });
      progress.inserted += data.inserted;
      progress.updated += data.updated;
      progress.duplicates += data.duplicates;
      emit();
    } catch (error) {
      complete(
        axios.isAxiosError(error) && !error.response ? 'You are offline.' : 'Upload failed.'
      );
    }
  };

  const batcher = new SizeBatcher<ImportedActivity>(MAX_BATCH_BYTES, MAX_BATCH_ITEMS, (batch) => {
    uploads = uploads.then(() => upload(batch));
  });

  worker.onmessage = (event: MessageEvent<ImportWorkerMessage>) => {
    const message = event.data;
    if (message.type === 'done') {
      batcher.flush();
      void uploads.then(() => complete());
      return;
    }
    if (message.type === 'error') {
      progress.failed++;
    } else {
      progress.files++;
      if (message.error) progress.failed++;
      else if (message.activities.length === 0) progress.skipped++;
      progress.found += message.activities.length;
      message.activities.forEach((activity) => batcher.add(activity));
    }
    emit();
  };
  worker.onerror = () => complete('Reading the files failed.');
  worker.postMessage({ files });

  return { done, cancel: () => complete('Cancelled.') };
}
