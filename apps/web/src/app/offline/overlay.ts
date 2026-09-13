import { Timespan, type MultiplyStage, type OutboxEntry } from '@runner/core';
import type { ProgramSummary, RunListItem } from '../userData';

export type ProgramData = { stages: MultiplyStage[]; cooldown: boolean };

/**
 * Pure helpers that layer not-yet-delivered writes (see requests.ts) over
 * server data. While offline, reads are answered from the service worker's
 * cache — i.e. from before the user's latest edits — so without this a
 * program renamed/deleted/edited offline would "come back" on the next load.
 */

function splitKey(key: string): [kind: string, id: string] {
  const index = key.indexOf(':');
  return index === -1 ? [key, ''] : [key.slice(0, index), key.slice(index + 1)];
}

/** Queue bodies are plain JSON; programs hold Timespans. */
function reviveProgramData(value: unknown): ProgramData {
  return JSON.parse(JSON.stringify(value), Timespan.reviver);
}

export function overlayPrograms(list: ProgramSummary[], entries: readonly OutboxEntry[]): ProgramSummary[] {
  let result = list;
  for (const entry of entries) {
    const [kind, id] = splitKey(entry.key);
    const body = entry.body as { name?: string } | undefined;
    const updatedAt = new Date(entry.enqueuedAt).toISOString();
    if (kind === 'program-create' && !result.some((p) => p.id === id)) {
      result = [{ id, name: body?.name ?? '', updatedAt }, ...result];
    } else if (kind === 'program-update') {
      result = result.map((p) => (p.id === id ? { ...p, name: body?.name ?? p.name, updatedAt } : p));
    } else if (kind === 'program-delete') {
      result = result.filter((p) => p.id !== id);
    }
  }
  return result;
}

export type PendingProgram = {
  created: boolean;
  deleted: boolean;
  name?: string;
  data?: ProgramData;
};

/** Everything still queued for one program, or undefined if nothing is. */
export function pendingProgram(id: string, entries: readonly OutboxEntry[]): PendingProgram | undefined {
  let pending: PendingProgram | undefined;
  for (const entry of entries) {
    const [kind, entryId] = splitKey(entry.key);
    if (entryId !== id || !kind.startsWith('program-')) continue;
    pending ??= { created: false, deleted: false };
    const body = entry.body as { name?: string; data?: unknown } | undefined;
    if (kind === 'program-create') pending.created = true;
    if (kind === 'program-delete') pending.deleted = true;
    if (body?.name !== undefined) pending.name = body.name;
    if (body?.data !== undefined) pending.data = reviveProgramData(body.data);
  }
  return pending;
}

export function overlayActiveProgramId(serverValue: string | null, entries: readonly OutboxEntry[]): string | null {
  let value = serverValue;
  for (const entry of entries) {
    if (entry.key === 'user-settings') {
      value = (entry.body as { activeProgramId: string | null }).activeProgramId;
    }
  }
  return value;
}

export function overlayRuns(list: RunListItem[], entries: readonly OutboxEntry[]): RunListItem[] {
  const deleted = new Set(
    entries.map((e) => splitKey(e.key)).filter(([kind]) => kind === 'run-delete').map(([, id]) => id)
  );
  return deleted.size === 0 ? list : list.filter((run) => !deleted.has(run.id));
}

/** How many queued writes belong to runs vs. everything else — for the sync indicator. */
export function countPendingRuns(entries: readonly OutboxEntry[]): number {
  return new Set(
    entries.map((e) => splitKey(e.key)).filter(([kind]) => kind.startsWith('run-')).map(([, id]) => id)
  ).size;
}
