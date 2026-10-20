import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { Timespan, type MultiplyStage } from '@runner/core';
import { Provider } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activeProgramIdAtom, programInternalAtom, temporaryProgramAtom } from '../atoms';
import { enqueueWrite } from '../offline/sync';
import { store } from '../store';
import { useProgramSync } from '../useProgramSync';
import { cacheProgramData, setProgramFromServer } from '../userData';
import { applyTemporaryProgram, discardTemporaryProgram, saveAsProgram } from './temporaryProgram';

vi.mock('../offline/sync', () => ({
  enqueueWrite: vi.fn(async () => undefined),
  getPendingWrites: vi.fn(async () => []),
}));
vi.mock('next-auth/react', () => ({ useSession: () => ({ status: 'authenticated' }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('axios', () => ({
  default: {
    get: vi.fn(async (url: string) =>
      url === '/api/user-settings'
        ? { data: { activeProgramId: 'saved' } }
        : { data: JSON.stringify({ data: saved }) }
    ),
    isAxiosError: () => false,
  },
}));

const stage = (minutes: number, bmp: number): MultiplyStage => ({
  times: 1,
  stages: [{ type: 'simple', duration: Timespan.fromMinutes(minutes), speedType: 'bmp', bmp }],
});
const saved = { stages: [stage(30, 140)], cooldown: true };
const watchWorkout = [stage(10, 143), stage(21, 169), stage(10, 143)];

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(Provider, { store }, children);

/** Mounts useProgramSync with the saved program 'saved' active, as after sign-in. */
async function mountSync() {
  renderHook(() => useProgramSync(), { wrapper });
  await act(async () => {
    await vi.waitFor(() => expect(store.get(activeProgramIdAtom)).toBe('saved'));
  });
  cacheProgramData('saved', saved);
}

const programWrites = () =>
  vi
    .mocked(enqueueWrite)
    .mock.calls.map(([write]) => write.request)
    .filter((r) => r.url.startsWith('/api/programs'));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  store.set(temporaryProgramAtom, null);
  store.set(activeProgramIdAtom, null);
  setProgramFromServer({ stages: [], cooldown: false });
  vi.mocked(enqueueWrite).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('temporary (watch) programs', () => {
  it('never saves the workout over the active program', async () => {
    await mountSync();
    act(() => applyTemporaryProgram('Próg', watchWorkout));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(store.get(programInternalAtom)).toEqual({ stages: watchWorkout, cooldown: true });
    expect(store.get(activeProgramIdAtom)).toBe('saved');
    expect(programWrites()).toEqual([]);
  });

  it('brings the saved program back on discard, still without a save', async () => {
    await mountSync();
    act(() => applyTemporaryProgram('Próg', watchWorkout));
    await act(async () => {
      await discardTemporaryProgram();
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(store.get(temporaryProgramAtom)).toBeNull();
    expect(store.get(programInternalAtom)).toEqual(saved);
    expect(programWrites()).toEqual([]);
  });

  it('saves it as a new program with its stages and makes that the active one', async () => {
    await mountSync();
    act(() => applyTemporaryProgram('Próg', watchWorkout));
    let id = '';
    await act(async () => {
      id = await saveAsProgram('Próg', store.get(programInternalAtom));
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(store.get(temporaryProgramAtom)).toBeNull();
    expect(store.get(activeProgramIdAtom)).toBe(id);
    expect(programWrites()).toEqual([
      {
        method: 'POST',
        url: '/api/programs',
        body: { id, name: 'Próg', data: { stages: watchWorkout, cooldown: true } },
      },
    ]);
    // The create carries the data, so there's no follow-up PUT.
    expect(vi.mocked(enqueueWrite).mock.calls.map(([w]) => w.request.body)).toContainEqual({
      activeProgramId: id,
    });
  });
});
