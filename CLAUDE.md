# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo layout

pnpm workspace with two packages:

- **`packages/core`** — framework-agnostic domain logic shared by every client: the BLE serial protocol
  (`src/ble/`), `RunSession` (run orchestration), the `Training` PID controller, Jotai atoms, `Timespan`,
  program parsing/calculation, and `FakeTreadmill` (used for tests and e2e without real hardware). Pure
  TypeScript — no DOM, no React Native. New domain logic goes here, not into `apps/web`.
- **`apps/web`** — the Next.js 16 app: UI, auth, and the API routes that back it.

A React Native/Expo mobile client (`apps/mobile`) was scaffolded and is parked on the `archive/mobile`
branch — not present on `main`. Don't resurrect it without being asked. Its backend surface still lives in
`apps/web` (see Auth below) since it's independent, migration-backed infrastructure.

## Commands

```bash
pnpm dev            # Web dev server with Turbopack (http://localhost:3010)
pnpm build          # Production build (apps/web)
pnpm lint           # ESLint across all workspace packages
pnpm typecheck      # tsc --noEmit across all workspace packages
pnpm test           # Run all tests once (Vitest: packages/core + apps/web)
pnpm test:watch     # Vitest in watch mode
pnpm test -- <file> # Run a single test file, e.g. pnpm test -- packages/core/src/services/Timespan.test.ts
pnpm storybook      # Storybook dev server (http://localhost:6006)

pnpm db:generate    # Generate a Drizzle migration from apps/web/src/lib/db/schema.ts changes
pnpm db:migrate     # Apply pending migrations (root drizzle/ folder)
pnpm db:studio      # Open Drizzle Studio (DB browser)
```

`db:*` scripts load env from `apps/web/.env.local` and run from the repo root (`drizzle.config.ts` points
at `apps/web/src/lib/db/schema.ts` and outputs to root `drizzle/`).

Package manager is **pnpm**. Do not use npm or yarn. To run a script in one package directly:
`pnpm -F @runner/web <script>` or `pnpm -F @runner/core <script>`.

Local Postgres is started with `docker compose up -d` (db `runnerapp`, user/pass `runner`, **port 5433** on
the host). Requires `apps/web/.env.local` with `DATABASE_URL`, `AUTH_SECRET`, and optionally
`AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` — copy `apps/web/.env.local.example` to `apps/web/.env.local` and
fill it in (see README.md for the full setup).

## Architecture

This is a **Next.js 16 App Router** application that controls a Bluetooth treadmill in real time, with
multi-user auth, program storage, and run history backed by Postgres.

### Data flow

```
WebBluetoothTransport ──► TreadmillProtocol ──► BleManager ──► RunSession ──► Jotai atoms ──► UI
                                                                     │
useRunningLoop (wake lock, heart rate, 200ms pump) ─────────────────┘
useProgramSync ──► /api/programs, /api/user-settings ──► Drizzle ──► Postgres
RunSession ──► /api/runs/:id (telemetry flush) ─────────► Drizzle ──► Postgres
```

- **`BleTransport`** (`packages/core/src/ble/transport.ts`) — platform-agnostic interface over one GATT
  connection: connect/disconnect, raw byte write, notify/disconnect subscriptions. `WebBluetoothTransport`
  (`apps/web/src/app/ble/webBluetoothTransport.ts`) is the Web Bluetooth implementation; owns device
  discovery/picker, GATT connect/teardown, and localStorage-remembered device id.
- **`TreadmillProtocol`** (`packages/core/src/ble/treadmillProtocol.ts`) — the wire protocol on top of a
  `BleTransport`: framing (checksum + `[3]` terminator), the message queue/retry pump, and the
  status/running state machine. Owns no timer itself — `tick()` must be driven by the host every ~200ms.
  Emits `TreadmillEvent`s. `sendIncAndSpeed` is a no-op unless the treadmill is already running, and
  enqueues the frame twice (the device firmware occasionally drops the first copy).
- **`BleManager`** (`apps/web/src/app/BleManager.tsx`) — thin singleton wrapper that owns one
  `WebBluetoothTransport` + `TreadmillProtocol` pair for the whole app and runs the 200ms `tick()` interval.
  Do not call `transport.write` directly — go through `BleManager`/`TreadmillProtocol`'s higher-level
  helpers (`sendIncAndSpeed`, `start`, `stop`, `addMessage`).
- **`HeartRateManager`** (`apps/web/src/app/HeartRateManager.tsx`) — singleton for the standard BLE
  `heart_rate` GATT service (separate device from the treadmill).
- **`RunSession`** (`packages/core/src/session/RunSession.ts`) — the main orchestration class: the 1Hz PID
  control loop, manual-speed-override detection (gap/trend analysis vs. the last commanded speed),
  cooldown/stage transitions, pause/resume time-shift arithmetic, and telemetry buffering (flushed to
  `/api/runs/:id` every 30s and on stop/disconnect). Reads/writes the same Jotai atoms the UI observes.
  Takes an injectable clock for tests. One instance is created per app (`apps/web/src/app/runSession.ts`)
  and driven by `useRunningLoop`'s 200ms `pump()` timer.
- **Speed controllers** (`packages/core/src/training/`) — adjust treadmill speed to hit a target heart
  rate (tempo stages instead use a fixed pace via `speedCalculator.ts`). Both implement `SpeedController`
  (`update(hr, stage, deltaTimeMs)`, called at 1 Hz with `1000`). `RunSession` creates one per run via
  `createSpeedController(kind)`, where `kind` comes from `speedControllerAtom` (toggle on the home/run
  screens, persisted per device in localStorage and recorded on each run as `controller`):
  - `legacy` → `Training.ts`, the original PID, kept unchanged.
  - `adaptive` → `AdaptiveTraining.ts`: filtered HR with a least-squares trend prediction, IMC-tuned
    velocity-form PI, feedforward on target steps, slew limit, quantization only on the output.
  `heartRateSimulation.ts` is a seeded closed-loop runner model used by the tests and `/pid-simulator`.
- **Jotai atoms** (`packages/core/src/state/atoms.ts`, re-exported via `apps/web/src/app/atoms.ts`) — all
  runtime state. `runningStateAtom` is the single source of truth (discriminated union:
  `{running: false} | {running: true, ...}`), with derived read-only atoms (`isRunningAtom`,
  `currentStageAtom`, `stagesAtom`, etc.) computed from it. `programInternalAtom` holds the active
  program's stages/cooldown and is kept in sync with Postgres by `useProgramSync`.
- **`useProgramSync`** (`apps/web/src/app/useProgramSync.ts`) — loads the user's active program from
  `/api/user-settings` + `/api/programs/:id` on auth, then debounce-saves (`1s`) `programInternalAtom`
  changes back via `PUT /api/programs/:id`.

### Auth

Auth.js v5 (`apps/web/src/lib/auth.ts`) with the Drizzle adapter, JWT sessions, Google OAuth and
email/password (`bcryptjs`) credentials. `apps/web/src/proxy.ts` is the Next.js middleware — it gates
every route except `/api`, `/login`, `/register`, and static assets behind a session check, redirecting to
`/login`. **API routes are not covered by the proxy matcher** — each one resolves the user itself via
`getUserId(request)` (`apps/web/src/lib/session.ts`), which checks a `Bearer` token first (via
`verifyAccessToken` in `lib/mobileTokens.ts`) and falls back to the Auth.js session cookie; an invalid
Bearer header returns unauthenticated rather than falling back.

The `/api/mobile/auth/*` routes and `lib/mobileAuth.ts`/`lib/mobileTokens.ts` implement a separate JWT
bearer auth flow (short-lived `MOBILE_JWT_SECRET`-signed access tokens + rotated, hashed refresh tokens
stored in `mobile_refresh_tokens`) originally built for the mobile app. That app is currently archived
(see Monorepo layout above), but this backend surface is still live and still worth treating as an active
part of the attack surface when touching auth code.

### Persistence

Drizzle ORM + Postgres (`apps/web/src/lib/db/schema.ts`, `apps/web/src/lib/db/index.ts`). Besides the
Auth.js tables (`user`, `account`, `session`, `verificationToken`) and `mobile_refresh_tokens`, app tables
are intentionally schemaless JSONB blobs:
- `programs` — one row per saved program, `data: { stages: MultiplyStage[], cooldown: boolean }`.
- `user_settings` — one row per user, `data: { activeProgramId: string | null }`.
- `run_history` — one row per run, `data` holds start/finish timestamps + the telemetry array
  (`packages/core/src/types/telemetry.ts`).

Program data flows through `/api/programs` + `programAtom`/`useProgramSync` — there is no separate
repository layer in `apps/web`.

**`Timespan`** (`packages/core/src/services/Timespan.ts`) — immutable value object (ms internally). Always
construct via static factories (`Timespan.fromSeconds`, `Timespan.fromMinutes`, `Timespan.parse`). Has a
`toJSON`/`reviver` pair — API responses containing Timespans must be parsed with
`JSON.parse(rawBody, Timespan.reviver)` (using axios's `transformResponse: [(data) => data]` to get the raw
string first) rather than the default JSON parsing, or nested Timespans deserialize as plain
`{ totalMilliseconds }` objects. See `useProgramSync.ts` for the pattern.

Import domain logic (`Timespan`, `calculateStages`, `MultiplyStage`/`Stage`, `parseProgram`, `Training`,
`useInterval`, etc.) from `@runner/core` directly — `apps/web` has no local re-export shims for these.

### Training program model

Programs are arrays of **`MultiplyStage`** → each contains a repeat count and an array of **`Stage`**.
`calculateStages` in `packages/core/src/services/stagesCalculator.ts` flattens and expands these into flat
`StageResult[]` with absolute `from`/`to` timespans. Sprint stages "steal" 10 seconds from the preceding
stage for ramp-up.

Each `Stage` uses either:
- `speedType: 'bmp'` — PID targets a heart rate (`bmp` field)
- `speedType: 'tempo'` — fixed pace derived from `tempo: Timespan` (min/km)

Programs can also be authored as plain text and parsed via
`packages/core/src/services/programTextParser.ts` (format `NxMM:SS@BPM`; see
`apps/web/src/app/add-program/ImportProgramDialog.tsx`). Default warmup/cooldown/regeneration BPM and
durations live in `packages/core/src/services/trainingDefaults.ts`.

### Routing (App Router)

| Route | Purpose |
|---|---|
| `/` | Home / BLE connect screen |
| `/running` | Active run dashboard |
| `/programs` | List/select saved programs |
| `/add-program` | Program builder |
| `/pid-simulator` | Dev tool comparing the speed controllers on a simulated runner |
| `/login`, `/register` | Auth pages (public, excluded from the proxy gate) |

API routes under `apps/web/src/app/api/` (`programs`, `programs/[id]`, `runs`, `runs/[id]`,
`user-settings`, `register`, `auth/[...nextauth]`, `mobile/auth/*`) all resolve the user via `getUserId()`
(or `auth()` for the NextAuth handler itself) and scope Drizzle queries to that user's id.

## Conventions

### State management
- Use **Jotai** for all shared/persistent state. Do not use React context or Redux.
- Derived atoms (read-only) are defined inline using `atom((get) => …)`. Writable derived atoms use the
  two-argument form (see `programAtom`/`programCooldownAtom` in `packages/core/src/state/atoms.ts`).

### TypeScript & styling
- Strict TypeScript — no `any` unless absolutely unavoidable (suppress with
  `// eslint-disable-next-line @typescript-eslint/no-explicit-any`).
- UI components use **MUI v9** (`@mui/material`). Theme is defined in `apps/web/src/app/theme.ts`; font is
  Barlow via CSS variable `--font-barlow`.
- Prettier enforces: single quotes, 100-char print width, LF line endings, `es5` trailing commas. Import
  order: `react` first, then third-party, then local (`^[./]`).

### Testing
- Tests live next to their source files (e.g., `Timespan.test.ts` beside `Timespan.ts`).
- `packages/core` tests run in a `node` environment; `apps/web` tests run in **jsdom** — use
  `@testing-library/react` for component tests. Both are wired into the root `vitest.config.mts` as
  Vitest workspace projects.
- Path aliases (`@/`) work in `apps/web` tests via `vite-tsconfig-paths`.

### Storybook
- Stories live next to their components (e.g. `apps/web/src/app/running/RunInfo/RunInfo.stories.tsx`) or
  in `apps/web/src/stories/` for the Storybook-generated boilerplate examples (`.stories.ts`/`.stories.tsx`).
- Jotai state in stories is managed via `@alexgorbatchev/storybook-addon-jotai`.

### BLE protocol notes
- All treadmill commands are `Uint8Array` with a checksum byte (XOR of bytes 1…n) appended before a `[3]`
  terminator (see `packages/core/src/ble/frame.ts`).
- Speed is stored as `speed * 10` (integer tenths of km/h) in the BLE payload.
- `TreadmillProtocol` is ticked at 200 ms intervals by `BleManager` and queues commands; do not call
  `transport.write`/`sendMessage` directly — use `addMessage`/`enqueue` or the higher-level helpers
  (`sendIncAndSpeed`, `start`, `stop`).
