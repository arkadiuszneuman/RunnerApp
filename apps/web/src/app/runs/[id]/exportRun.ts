import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNativeApp } from '../../ble/platform';
import type { RunRow } from '../../userData';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * `run-YYYY-MM-DD-HHmm.json`, timestamped from when the run started, in the viewer's local time
 * (friendlier for a human-facing filename than UTC).
 */
export function buildExportFilename(row: RunRow): string {
  const d = new Date(row.data.startedAt);
  return `run-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
}

/**
 * The full run record as JSON: id/createdAt plus everything in `data` — start/finish, duration,
 * program snapshot, speed controller, and the full telemetry array. `Timespan` fields inside
 * `data.program` serialize through its own `toJSON()` (see Timespan.ts) as `{ totalMilliseconds }`
 * — this export is meant to be read (by a person or by Claude analyzing a run), not re-imported
 * through the app's own `Timespan.reviver`, so that plain shape is intentional, not a bug.
 */
export function buildExportJson(row: RunRow): string {
  return JSON.stringify({ id: row.id, createdAt: row.createdAt, ...row.data }, null, 2);
}

/**
 * Saves a run's full record to a file the user can send elsewhere (e.g. to share with Claude for
 * analysis — see the speed-controller tuning discussion in RunSession.ts). Web/PWA downloads it
 * directly; the native shell has no `<a download>`, so it writes to the app's cache dir and hands
 * it to Android's share sheet instead. Falls back to the clipboard if an older installed APK is
 * missing the Share plugin (`isPluginAvailable` false) rather than silently doing nothing.
 */
export async function exportRun(
  row: RunRow
): Promise<{ method: 'download' | 'share' | 'clipboard' }> {
  const filename = buildExportFilename(row);
  const json = buildExportJson(row);

  if (!isNativeApp()) {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
    return { method: 'download' };
  }

  if (!Capacitor.isPluginAvailable('Share') || !Capacitor.isPluginAvailable('Filesystem')) {
    await navigator.clipboard.writeText(json);
    return { method: 'clipboard' };
  }

  await Filesystem.writeFile({
    path: filename,
    data: json,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
  await Share.share({ title: filename, dialogTitle: 'Export run', files: [uri] });
  return { method: 'share' };
}
