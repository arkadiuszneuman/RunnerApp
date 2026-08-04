// packages/core deliberately excludes "dom" from its tsconfig lib (see tsconfig.json)
// so that accidental use of browser-only APIs (localStorage, navigator, Event, ...)
// is a compile error. setInterval/clearInterval are timer primitives available
// identically in browsers, React Native/Hermes, so they're declared here instead
// of pulling in the whole DOM lib.
declare function setInterval(handler: (...args: unknown[]) => void, timeout?: number): number;
declare function clearInterval(id: number | undefined): void;
