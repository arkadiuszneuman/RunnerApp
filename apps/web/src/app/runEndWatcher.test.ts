import { describe, expect, it, vi } from 'vitest';
import { runningStateAtom } from '@runner/core';
import { createStore } from 'jotai/vanilla';
import { watchRunEnd } from './runEndWatcher';

function running() {
  return {
    running: true as const,
    paused: false,
    runningStartedDate: new Date(),
    runningTime: { totalMilliseconds: 0 } as never,
    treadmillOptions: { incline: 0, speed: 0, isCustomSpeedUsed: false, isManualSpeedActive: false },
  };
}

describe('watchRunEnd', () => {
  it('fires once when running flips true -> false, regardless of the path', () => {
    const store = createStore();
    const onEnd = vi.fn();
    watchRunEnd(store, onEnd);

    store.set(runningStateAtom, running());
    expect(onEnd).not.toHaveBeenCalled();

    // Program end without cooldown, a Stop button press, and a btStopped/btDisconnected event
    // all funnel through the same `{ running: false }` write — one watcher covers all of them.
    store.set(runningStateAtom, { running: false });
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('does not fire on transitions that stay running (e.g. pause/resume)', () => {
    const store = createStore();
    const onEnd = vi.fn();
    watchRunEnd(store, onEnd);

    store.set(runningStateAtom, running());
    store.set(runningStateAtom, { ...running(), paused: true });
    store.set(runningStateAtom, { ...running(), paused: false });
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('does not fire on a start attempt that never actually started', () => {
    const store = createStore();
    const onEnd = vi.fn();
    watchRunEnd(store, onEnd);

    // start() failing early (no stages, not connected) never sets running: true — the atom
    // is written with the same { running: false } shape it already had.
    store.set(runningStateAtom, { running: false });
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('unsubscribes when the returned function is called', () => {
    const store = createStore();
    const onEnd = vi.fn();
    const unsubscribe = watchRunEnd(store, onEnd);

    store.set(runningStateAtom, running());
    unsubscribe();
    store.set(runningStateAtom, { running: false });
    expect(onEnd).not.toHaveBeenCalled();
  });
});
