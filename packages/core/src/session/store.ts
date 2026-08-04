import type { Atom, WritableAtom } from 'jotai';

/**
 * Structural subset of jotai's vanilla Store (the object returned by
 * `createStore()`), used instead of importing jotai's own Store type so this
 * stays stable across jotai versions. Each app creates ONE store, passes it to
 * jotai's <Provider store={store}> (so useAtomValue/useSetAtom see updates)
 * and to RunSession (so it can read/write the same atoms imperatively, from
 * outside React).
 */
export interface JotaiStore {
  get: <Value>(atom: Atom<Value>) => Value;
  set: <Value, Args extends unknown[], Result>(
    atom: WritableAtom<Value, Args, Result>,
    ...args: Args
  ) => Result;
}
