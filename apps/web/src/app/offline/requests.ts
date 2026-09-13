import type { EnqueueOptions, OutboxRequest, RunApi } from '@runner/core';

/** A mutation ready to hand to the outbox (see sync.ts). */
export type QueuedWrite = { request: OutboxRequest; options: EnqueueOptions };

export type ProgramPatch = { name?: string; data?: unknown };

type RunMeta = Parameters<RunApi['createRun']>[1];
type RunPatch = Parameters<RunApi['patchRun']>[1];

const shallowMerge = (previous: unknown, next: unknown) => ({
  ...(previous as object),
  ...(next as object),
});

/**
 * Outbox coalescing keys. overlay.ts parses these back to show pending writes
 * on top of (possibly stale, SW-cached) server data, so every write the app
 * makes goes through the builders below rather than ad-hoc keys.
 */
export const outboxKey = {
  programCreate: (id: string) => `program-create:${id}`,
  programUpdate: (id: string) => `program-update:${id}`,
  programDelete: (id: string) => `program-delete:${id}`,
  userSettings: () => 'user-settings',
  runCreate: (id: string) => `run-create:${id}`,
  runPatch: (id: string) => `run-patch:${id}`,
  runDelete: (id: string) => `run-delete:${id}`,
};

export const writes = {
  createProgram(id: string, name: string): QueuedWrite {
    return {
      request: { method: 'POST', url: '/api/programs', body: { id, name } },
      options: { key: outboxKey.programCreate(id) },
    };
  },

  /** A rename and a data save of the same program collapse into one PUT carrying both. */
  updateProgram(id: string, patch: ProgramPatch): QueuedWrite {
    return {
      request: { method: 'PUT', url: `/api/programs/${id}`, body: patch },
      options: { key: outboxKey.programUpdate(id), merge: shallowMerge },
    };
  },

  deleteProgram(id: string): QueuedWrite {
    return {
      request: { method: 'DELETE', url: `/api/programs/${id}` },
      options: { key: outboxKey.programDelete(id) },
    };
  },

  setActiveProgram(activeProgramId: string | null): QueuedWrite {
    return {
      request: { method: 'PUT', url: '/api/user-settings', body: { activeProgramId } },
      options: { key: outboxKey.userSettings() },
    };
  },

  createRun(id: string, startedAt: string, meta: RunMeta): QueuedWrite {
    return {
      request: { method: 'POST', url: '/api/runs', body: { id, startedAt, ...meta } },
      options: { key: outboxKey.runCreate(id) },
    };
  },

  /**
   * Each telemetry flush resends the run's whole buffer, so a newer patch
   * supersedes an older one — but a merge (not a replace) keeps a
   * `finishedAt`/`durationMs` from an earlier patch that a later one lacks.
   */
  patchRun(id: string, payload: RunPatch): QueuedWrite {
    return {
      request: { method: 'PATCH', url: `/api/runs/${id}`, body: payload },
      options: { key: outboxKey.runPatch(id), merge: shallowMerge },
    };
  },

  deleteRun(id: string): QueuedWrite {
    return {
      request: { method: 'DELETE', url: `/api/runs/${id}` },
      options: { key: outboxKey.runDelete(id) },
    };
  },
};
