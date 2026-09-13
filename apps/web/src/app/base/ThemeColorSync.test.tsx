import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { Timespan, type MultiplyStage } from '@runner/core';
import { Provider } from 'jotai';
import { createStore } from 'jotai/vanilla';
import { programInternalAtom, runningStateAtom } from '../atoms';
import { stageTypeColor, tokens } from '../theme';
import ThemeColorSync from './ThemeColorSync';

// A plain 'simple' stage followed by a 'regeneration' one, with neither
// adjacent to a 'sprint' stage — keeps their [from, to) boundaries at their
// natural positions (30s each) instead of the 10s "steal" calculateStages
// applies around sprint stages, which isn't what this is testing.
function program(): MultiplyStage[] {
  return [
    { times: 1, stages: [{ type: 'simple', speedType: 'tempo', tempo: Timespan.fromMinutes(5), duration: Timespan.fromSeconds(30) }] },
    { times: 1, stages: [{ type: 'regeneration', speedType: 'tempo', tempo: Timespan.fromMinutes(6), duration: Timespan.fromSeconds(30) }] },
  ];
}

function runningAt(seconds: number) {
  return {
    running: true as const,
    paused: false,
    runningStartedDate: new Date(),
    runningTime: Timespan.fromSeconds(seconds),
    treadmillOptions: { speed: 8, incline: 1, isCustomSpeedUsed: false, isManualSpeedActive: false },
  };
}

function themeColorContent(): string | null {
  return document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null;
}

afterEach(cleanup);

describe('ThemeColorSync', () => {
  it('uses the app background before a run starts', () => {
    const store = createStore();
    render(
      <Provider store={store}>
        <ThemeColorSync />
      </Provider>
    );
    expect(themeColorContent()).toBe(tokens.bg);
  });

  it('creates the meta tag if the page somehow has none yet', () => {
    document.querySelector('meta[name="theme-color"]')?.remove();
    const store = createStore();
    render(
      <Provider store={store}>
        <ThemeColorSync />
      </Provider>
    );
    expect(themeColorContent()).toBe(tokens.bg);
  });

  it("matches the current stage's color while running", () => {
    const store = createStore();
    store.set(programInternalAtom, { stages: program(), cooldown: false });
    store.set(runningStateAtom, runningAt(10)); // inside the 'simple' stage
    render(
      <Provider store={store}>
        <ThemeColorSync />
      </Provider>
    );
    expect(themeColorContent()).toBe(stageTypeColor.simple);
  });

  it('updates live when the stage changes', () => {
    const store = createStore();
    store.set(programInternalAtom, { stages: program(), cooldown: false });
    store.set(runningStateAtom, runningAt(10)); // 'simple'
    render(
      <Provider store={store}>
        <ThemeColorSync />
      </Provider>
    );
    expect(themeColorContent()).toBe(stageTypeColor.simple);

    // store.set() updates jotai's state synchronously, but the resulting
    // re-render (via useAtomValue's useSyncExternalStore subscription) is
    // still a React update, and needs act() to flush before asserting.
    act(() => {
      store.set(runningStateAtom, runningAt(45)); // now inside 'regeneration'
    });
    expect(themeColorContent()).toBe(stageTypeColor.regeneration);
  });

  it('falls back to the app background during cooldown (no stage is active)', () => {
    const store = createStore();
    store.set(programInternalAtom, { stages: program(), cooldown: true });
    store.set(runningStateAtom, runningAt(70)); // past the program's end
    render(
      <Provider store={store}>
        <ThemeColorSync />
      </Provider>
    );
    expect(themeColorContent()).toBe(tokens.bg);
  });

  it('reverts to the app background once the run stops', () => {
    const store = createStore();
    store.set(programInternalAtom, { stages: program(), cooldown: false });
    store.set(runningStateAtom, runningAt(10));
    render(
      <Provider store={store}>
        <ThemeColorSync />
      </Provider>
    );
    expect(themeColorContent()).toBe(stageTypeColor.simple);

    act(() => {
      store.set(runningStateAtom, { running: false });
    });
    expect(themeColorContent()).toBe(tokens.bg);
  });
});
