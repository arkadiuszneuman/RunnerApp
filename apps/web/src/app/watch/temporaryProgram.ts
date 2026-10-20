import type { MultiplyStage } from '@runner/core';
import {
  activeProgramIdAtom,
  isRunningAtom,
  programInternalAtom,
  temporaryProgramAtom,
} from '../atoms';
import type { ProgramData } from '../offline/overlay';
import { writes } from '../offline/requests';
import { enqueueWrite } from '../offline/sync';
import { store } from '../store';
import {
  activateProgram,
  EMPTY_PROGRAM,
  getCachedProgramData,
  loadProgramData,
  setProgramFromServer,
  upsertProgram,
} from '../userData';

/*
 * A workout read off the watch runs as a temporary program: it takes programInternalAtom (the one
 * slot the home screen, /running and RunSession read) while temporaryProgramAtom tells
 * useProgramSync not to save it over the active program. The saved selection stays put, and is
 * back after discarding it or restarting the app.
 */

/**
 * Puts a one-off workout in place of the active program, without saving anything. Like the
 * user's own programs, it ends with the 4 km/h cooldown walk.
 */
export function applyTemporaryProgram(name: string, stages: MultiplyStage[]): void {
  // The flag first, so the program change below is never seen without it.
  store.set(temporaryProgramAtom, { name });
  store.set(programInternalAtom, { stages, cooldown: true });
}

/** Back to the saved active program (or none). */
export async function discardTemporaryProgram(): Promise<void> {
  if (!store.get(temporaryProgramAtom) || store.get(isRunningAtom)) return;
  const id = store.get(activeProgramIdAtom);
  let data: ProgramData | null = null;
  let available = true;
  if (id) {
    try {
      data = getCachedProgramData(id) ?? (await loadProgramData(id));
    } catch {
      // Offline and never loaded: show no program rather than an empty one under its id, where
      // the next edit would be saved over it. The server still has it selected for next time.
      available = false;
    }
  }
  store.set(temporaryProgramAtom, null);
  if (!available) store.set(activeProgramIdAtom, null);
  setProgramFromServer(data ?? EMPTY_PROGRAM);
}

/** Saves a workout to the user's programs and makes it the active one. */
export async function saveAsProgram(name: string, data: ProgramData): Promise<string> {
  const id = crypto.randomUUID();
  void enqueueWrite(writes.createProgram(id, name, data));
  upsertProgram({ id, name, updatedAt: new Date().toISOString() });
  await activateProgram(id, data);
  return id;
}
