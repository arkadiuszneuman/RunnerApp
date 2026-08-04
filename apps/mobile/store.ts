import { createStore } from 'jotai/vanilla';

/**
 * One shared jotai store for the whole app. Passed to <Provider store={store}>
 * in app/_layout.tsx (so useAtomValue/useSetAtom in screens see updates) and
 * to RunSession (see runSession.ts), which reads/writes atoms imperatively
 * from outside React.
 */
export const store = createStore();
