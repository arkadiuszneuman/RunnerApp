# Copilot Instructions

## Commands

```bash
pnpm dev            # Start dev server with Turbopack (http://localhost:3000)
pnpm build          # Production build
pnpm lint           # ESLint
pnpm test           # Run all tests (Vitest + jsdom)
pnpm test -- <file> # Run a single test file, e.g. pnpm test -- src/services/Timespan.test.ts
pnpm storybook      # Storybook dev server (http://localhost:6006)
```

Package manager is **pnpm**. Do not use npm or yarn.

## Architecture

This is a **Next.js 16 App Router** application that controls a Bluetooth treadmill in real time.

### Data flow

```
BleManager (singleton) ──► useRunningLoop (hook) ──► Jotai atoms ──► UI components
HeartRateManager ─────────────────────────────────────────────────►
```

- **`BleManager`** (`src/app/BleManager.tsx`) — singleton that owns the Web Bluetooth GATT connection to the treadmill. Communicates via a proprietary serial-over-BLE protocol (service `0000fff0-…`). Emits `TreadmillEvent` to subscribers. All command bytes are defined as module-level constants.
- **`useRunningLoop`** (`src/app/useRunningLoop.ts`) — the main orchestration hook. Reads Jotai atoms for current stage/heart rate, feeds them into `Training` (PID controller), and calls `BleManager.sendIncAndSpeed` every second. Also manages wake lock.
- **`Training`** (`src/app/Training.ts`) — PID controller class that adjusts treadmill speed to hit a target heart rate BPM. Stateful per run (integral/derivative carry over between calls). Instantiated fresh on each run start.
- **Jotai atoms** (`src/app/atoms.ts`) — all runtime state. `runningStateAtom` is the single source of truth (discriminated union: `{running: false} | {running: true, ...}`). `programAtom` persists to localStorage via a custom storage adapter that handles `Timespan` deserialization.

### Training program model

Programs are arrays of **`MultiplyStage`** → each contains a repeat count and an array of **`Stage`**. `calculateStages` in `src/services/stagesCalculator.ts` flattens and expands these into flat `StageResult[]` with absolute `from`/`to` timespans. Sprint stages "steal" 10 seconds from the preceding stage for ramp-up.

Each `Stage` uses either:
- `speedType: 'bmp'` — PID targets a heart rate (`bmp` field)
- `speedType: 'tempo'` — fixed pace derived from `tempo: Timespan` (min/km)

### Key services

- **`Timespan`** (`src/services/Timespan.ts`) — immutable value object (ms internally). Always construct via static factories (`Timespan.fromSeconds`, `Timespan.fromMinutes`, `Timespan.parse`). Has a `toJSON`/`reviver` pair — always use `JSON.parse(data, Timespan.reviver)` when deserializing data that contains Timespans.
- **`src/services/db/programRepository.ts`** — currently an in-memory store (despite the `db` folder name). No actual database is used yet.

### Routing (App Router)

| Route | Purpose |
|---|---|
| `/` | Home / BLE connect screen |
| `/running` | Active run dashboard |
| `/add-program` | Program builder |
| `/pid-simulator` | Dev tool to tune PID constants |

## Conventions

### State management
- Use **Jotai** for all shared/persistent state. Do not use React context or Redux.
- Derived atoms (read-only) are defined inline using `atom((get) => …)`. Writable derived atoms use the two-argument form.
- `atomWithStorage` requires a custom storage object when the value contains `Timespan` instances (see `programStorage` in `atoms.ts` as the reference pattern).

### TypeScript & styling
- Strict TypeScript — no `any` unless absolutely unavoidable (suppress with `// eslint-disable-next-line @typescript-eslint/no-explicit-any`).
- UI components use **MUI v6** (`@mui/material`). Theme is defined in `src/app/theme.ts`; font is Barlow via CSS variable `--font-barlow`.
- Prettier enforces: single quotes, 100-char print width, CRLF line endings, `es5` trailing commas. Import order: `react` first, then third-party, then local (`^[./]`).

### Testing
- Tests live next to their source files (e.g., `Timespan.test.ts` beside `Timespan.ts`).
- Test environment is **jsdom** (configured in `vitest.config.mts`). Use `@testing-library/react` for component tests.
- Path aliases (`@/`) work in tests via `vite-tsconfig-paths`.

### Storybook
- Stories are in `src/stories/` and use `.stories.ts` extension.
- Jotai state in stories is managed via `@alexgorbatchev/storybook-addon-jotai`.

### BLE protocol notes
- All treadmill commands are `Uint8Array` with a checksum byte (XOR of bytes 1…n) appended before a `[3]` terminator.
- Speed is stored as `speed * 10` (integer tenths of km/h) in the BLE payload.
- `BleManager` polls at 200 ms intervals and queues commands; do not call `sendMessage` directly — use `addMessage` or the higher-level helpers.
