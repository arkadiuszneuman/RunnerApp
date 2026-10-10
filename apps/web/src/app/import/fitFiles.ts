import {
  BlobReader,
  BlobWriter,
  configure,
  TextWriter,
  Uint8ArrayWriter,
  ZipReader,
} from '@zip.js/zip.js';

export type FitFile = { name: string; bytes: Uint8Array };

/** Extensions the importer accepts, for the file picker. */
export const ACCEPTED_IMPORT_TYPES = '.fit,.FIT,.gz,.zip,application/zip,application/gzip';

/**
 * The Garmin activity id in a file name: Garmin Connect's "Export original" download contains
 * `<activityId>_ACTIVITY.fit`. The full account export's `<email>_<number>.fit` names carry a
 * different number (the uploaded file's, not the activity's) — Garmin Connect can't open an
 * activity by it, so it isn't read.
 */
export function garminIdFromName(name: string): string | undefined {
  const base = name.split('/').pop() ?? name;
  return /^(\d{8,20})_ACTIVITY\.fit$/i.exec(base)?.[1];
}

/** Garmin activity ids by start time (whole seconds since the epoch, UTC). */
export type GarminIdsByStart = Map<number, string>;

/**
 * Collects Garmin activity ids from the full account export's activity summaries
 * (`DI_CONNECT/DI-Connect-Fitness/<email>_0_summarizedActivities.json`) — the only place in that
 * export that holds them, since its FIT files are named by upload, not by activity. Walks the JSON
 * generically: every object with a numeric `activityId` and a start timestamp counts.
 */
export function collectGarminIds(
  json: unknown,
  into: GarminIdsByStart = new Map()
): GarminIdsByStart {
  if (Array.isArray(json)) {
    for (const item of json) collectGarminIds(item, into);
  } else if (json && typeof json === 'object') {
    const record = json as Record<string, unknown>;
    const start = record.startTimeGmt ?? record.beginTimestamp;
    if (typeof record.activityId === 'number' && typeof start === 'number') {
      into.set(Math.round(start / 1000), String(record.activityId));
    } else {
      for (const value of Object.values(record)) collectGarminIds(value, into);
    }
  }
  return into;
}

/** The Garmin activity id of the activity that started at `startTime` (ISO), if known. */
export function garminIdAt(ids: GarminIdsByStart, startTime: string): string | undefined {
  const sec = Math.round(Date.parse(startTime) / 1000);
  for (const delta of [0, -1, 1, -2, 2]) {
    const id = ids.get(sec + delta);
    if (id) return id;
  }
  return undefined;
}

const isSummaries = (name: string) => /summarizedActivities[^/]*\.json$/i.test(name);

/** The activity ids in a Garmin account export zip (empty for any other file). */
export async function garminIdsFromExport(file: Blob, name: string): Promise<GarminIdsByStart> {
  const ids: GarminIdsByStart = new Map();
  if (!isZip(name)) return ids;
  configureZip();
  const reader = new ZipReader(new BlobReader(file));
  try {
    for await (const entry of reader.getEntriesGenerator()) {
      if (entry.directory || !isSummaries(entry.filename)) continue;
      try {
        collectGarminIds(JSON.parse(await entry.getData(new TextWriter())), ids);
      } catch {
        // Unreadable summaries only cost the Garmin Connect links, not the import.
      }
    }
  } catch {
    // Not a readable zip — fitFilesFrom reports that.
  } finally {
    await reader.close();
  }
  return ids;
}

const isFit = (name: string) => /\.fit$/i.test(name);
const isGzippedFit = (name: string) => /\.fit\.gz$/i.test(name);
const isZip = (name: string) => /\.zip$/i.test(name);

/** gunzips with the browser's native DecompressionStream. */
export async function gunzip(data: Blob): Promise<Uint8Array> {
  const stream = data.stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

let zipConfigured = false;

function configureZip() {
  if (zipConfigured) return;
  // This runs inside the import worker already; zip.js spawning its own workers from there buys
  // nothing.
  configure({ useWebWorkers: false });
  zipConfigured = true;
}

/**
 * Every FIT file in an upload: a `.fit` / `.fit.gz` file itself, or each one inside a zip —
 * including zips nested in zips, which is how Garmin's full data export packs them
 * (`DI_CONNECT/DI-Connect-Uploaded-Files/UploadedFiles_*.zip`). Zips are read through zip.js's
 * BlobReader, which only reads the byte ranges it needs: multi-gigabyte (ZIP64) exports never
 * have to fit in memory. Unreadable entries are reported through `onError` and skipped.
 */
export async function* fitFilesFrom(
  file: Blob,
  name: string,
  onError: (name: string, message: string) => void
): AsyncGenerator<FitFile> {
  if (isFit(name)) {
    yield { name, bytes: new Uint8Array(await file.arrayBuffer()) };
    return;
  }
  if (isGzippedFit(name)) {
    try {
      yield { name: name.replace(/\.gz$/i, ''), bytes: await gunzip(file) };
    } catch (error) {
      onError(name, error instanceof Error ? error.message : 'Unreadable gzip file');
    }
    return;
  }
  if (!isZip(name)) return;

  configureZip();
  const reader = new ZipReader(new BlobReader(file));
  try {
    for await (const entry of reader.getEntriesGenerator()) {
      if (entry.directory) continue;
      const entryName = entry.filename;
      try {
        if (isFit(entryName)) {
          yield { name: entryName, bytes: await entry.getData(new Uint8ArrayWriter()) };
        } else if (isGzippedFit(entryName) || isZip(entryName)) {
          const blob = await entry.getData(new BlobWriter());
          yield* fitFilesFrom(blob, entryName, onError);
        }
      } catch (error) {
        onError(entryName, error instanceof Error ? error.message : 'Unreadable zip entry');
      }
    }
  } catch (error) {
    onError(name, error instanceof Error ? error.message : 'Unreadable zip file');
  } finally {
    await reader.close();
  }
}
