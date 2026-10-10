import type { ImportedActivity } from '@runner/core';

/** Messages between runImport.ts (main thread) and importWorker.ts. */

export type ImportWorkerRequest = { files: File[] };

export type ImportWorkerMessage =
  /** A FIT file was read and decoded (whether or not it held a run). */
  | { type: 'file'; name: string; activities: ImportedActivity[]; skipped?: string; error?: string }
  /** A file or zip entry couldn't even be read. */
  | { type: 'error'; name: string; message: string }
  | { type: 'done' };
