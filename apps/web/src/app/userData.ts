'use client';

import { useEffect, useRef } from 'react';
import { Timespan, type RunRecord, type RunSummary, type SpeedControllerKind } from '@runner/core';
import axios from 'axios';
import { atom } from 'jotai';
import { useSession } from 'next-auth/react';
import { activeProgramIdAtom, programInternalAtom } from './atoms';
import { overlayPrograms, overlayRuns, pendingProgram, type ProgramData } from './offline/overlay';
import { getPendingWrites } from './offline/sync';
import { store } from './store';

export type ProgramSummary = { id: string; name: string; updatedAt: string };

export type RunListItem = {
  id: string;
  createdAt: string;
  startedAt: string;
  finishedAt?: string;
  programName?: string;
  controller?: SpeedControllerKind;
  summary: RunSummary;
};

export type RunRow = { id: string; createdAt: string; data: RunRecord };

/**
 * App-wide caches for the programs list and run history. Populated once on
 * login (see useUserDataPreload below) and kept in sync by the mutation
 * helpers below instead of being refetched on every tab switch — see
 * programs/page.tsx, runs/page.tsx and runs/[id]/page.tsx.
 * `undefined` means "not loaded yet" (renders a loading skeleton); an empty
 * array means "loaded, and there's nothing".
 */
export const programsAtom = atom<ProgramSummary[] | undefined>(undefined);
export const runsAtom = atom<RunListItem[] | undefined>(undefined);
export const runDetailsAtom = atom<Record<string, RunRow>>({});

/** Set once useProgramSync's initial /api/user-settings load finishes (success or failure). */
export const userSettingsLoadedAtom = atom(false);

/**
 * The active program's name, distinguishing "still loading" (undefined) from
 * "loaded, no active program" (null) — see BleConnector.tsx, which uses this
 * to avoid flashing "No program selected" before data has arrived.
 */
export const activeProgramNameAtom = atom((get) => {
  if (!get(userSettingsLoadedAtom)) return undefined;
  const activeProgramId = get(activeProgramIdAtom);
  if (activeProgramId === null) return null;
  const programs = get(programsAtom);
  if (programs === undefined) return undefined;
  return programs.find((p) => p.id === activeProgramId)?.name ?? null;
});

export function setPrograms(programs: ProgramSummary[]): void {
  store.set(programsAtom, programs);
}

/** Adds a newly created program to the cache, or replaces an existing entry (e.g. after a rename). */
export function upsertProgram(program: ProgramSummary): void {
  store.set(programsAtom, (prev) => {
    const list = prev ?? [];
    const index = list.findIndex((p) => p.id === program.id);
    if (index === -1) return [program, ...list];
    const next = [...list];
    next[index] = program;
    return next;
  });
}

export function removeProgramFromCache(id: string): void {
  store.set(programsAtom, (prev) => prev?.filter((p) => p.id !== id));
}

export function setRuns(runs: RunListItem[]): void {
  store.set(runsAtom, runs);
}

export function removeRunFromCache(id: string): void {
  store.set(runsAtom, (prev) => prev?.filter((r) => r.id !== id));
  store.set(runDetailsAtom, (prev) =>
    id in prev ? Object.fromEntries(Object.entries(prev).filter(([key]) => key !== id)) : prev
  );
}

export function cacheRunDetail(row: RunRow): void {
  store.set(runDetailsAtom, (prev) => ({ ...prev, [row.id]: row }));
}

/**
 * Re-fetches the programs list from the server and replaces the cache,
 * with not-yet-synced offline edits layered on top. Best-effort.
 */
export async function refreshPrograms(): Promise<void> {
  try {
    const [{ data }, pending] = await Promise.all([axios.get('/api/programs'), getPendingWrites()]);
    setPrograms(overlayPrograms(data ?? [], pending));
  } catch {
    // Best-effort background refresh — a failure just leaves the previous cache in place.
  }
}

/** Re-fetches the run history list from the server and replaces the cache. Best-effort. */
export async function refreshRuns(): Promise<void> {
  try {
    const [{ data }, pending] = await Promise.all([
      axios.get('/api/runs', { transformResponse: [(raw) => raw] }),
      getPendingWrites(),
    ]);
    setRuns(overlayRuns(JSON.parse(data, Timespan.reviver) ?? [], pending));
  } catch {
    // Best-effort background refresh.
  }
}

/**
 * Loads one program's stages, preferring any edits still queued offline.
 * Resolves null for a program with no data (or one deleted offline); rejects
 * when it's neither reachable nor known locally — e.g. offline, never opened.
 */
export async function loadProgramData(id: string): Promise<ProgramData | null> {
  const pending = pendingProgram(id, await getPendingWrites());
  if (pending?.deleted) return null;
  try {
    const { data } = await axios.get(`/api/programs/${id}`, { transformResponse: [(raw) => raw] });
    const program = JSON.parse(data, Timespan.reviver);
    return pending?.data ?? program?.data ?? null;
  } catch (error) {
    if (pending?.data) return pending.data;
    if (pending?.created) return { stages: [], cooldown: false };
    throw error;
  }
}

/**
 * The JSON of the program state last loaded from, or queued to, the server.
 * useProgramSync's debounced save compares against it, so loading a program
 * (or re-selecting one) never echoes it straight back as a save — which,
 * offline, could push a stale cached copy over newer server data.
 */
let lastSyncedProgramJson: string | undefined;

/** Puts server-sourced program data into the editor state without triggering a save. */
export function setProgramFromServer(data: ProgramData): void {
  lastSyncedProgramJson = JSON.stringify(data);
  store.set(programInternalAtom, data);
}

/** True (and records it as synced) if this state differs from what the server last saw. */
export function claimProgramSave(data: ProgramData): boolean {
  const json = JSON.stringify(data);
  if (json === lastSyncedProgramJson) return false;
  lastSyncedProgramJson = json;
  return true;
}

/**
 * Loads the programs list and run history once per session, in parallel with
 * useProgramSync's own load. Mounted once at the app root (see
 * Providers.tsx), so navigating between tabs never refetches them — pages
 * read straight from programsAtom/runsAtom and mutate the cache directly
 * instead.
 */
export function useUserDataPreload(): void {
  const { status } = useSession();
  // Guards against StrictMode's dev-mode double-invoke and re-renders while
  // still loading — this must fire exactly once per session, not once per
  // status-changing render.
  const startedRef = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || startedRef.current) return;
    startedRef.current = true;
    void refreshPrograms();
    void refreshRuns();
  }, [status]);
}
