import { BlobReader, BlobWriter, configure, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js';

export type FitFile = { name: string; bytes: Uint8Array };

/** Extensions the importer accepts, for the file picker. */
export const ACCEPTED_IMPORT_TYPES = '.fit,.FIT,.gz,.zip,application/zip,application/gzip';

/**
 * Garmin activity ids in file names: the full data export names uploaded files
 * `<email>_<activityId>.fit`, and Garmin Connect's "Export original" download contains
 * `<activityId>_ACTIVITY.fit`.
 */
export function garminIdFromName(name: string): string | undefined {
  const base = name.split('/').pop() ?? name;
  return /(?:^|_)(\d{8,20})(?:_ACTIVITY)?\.fit$/i.exec(base)?.[1];
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

  if (!zipConfigured) {
    // This runs inside the import worker already; zip.js spawning its own workers from there
    // buys nothing.
    configure({ useWebWorkers: false });
    zipConfigured = true;
  }
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
