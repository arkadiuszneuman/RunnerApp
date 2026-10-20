# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo layout

pnpm workspace with three packages:

- **`packages/core`** — framework-agnostic domain logic shared by every client: the BLE serial protocol
  (`src/ble/`), `RunSession` (run orchestration), the `Training` PID controller, Jotai atoms, `Timespan`,
  program parsing/calculation, and `FakeTreadmill` (used for tests and e2e without real hardware). Pure
  TypeScript — no DOM, no React Native. New domain logic goes here, not into `apps/web`.
- **`apps/web`** — the Next.js 16 app: UI, auth, and the API routes that back it.
- **`apps/android`** — a Capacitor shell around `apps/web`: `capacitor.config.ts` points `server.url` at a
  deployed (or LAN dev) instance of the Next.js app, so the WebView renders the *same* UI/CSS/animations —
  no separate UI codebase. Only the BLE/HR transports differ: `apps/web/src/app/ble/nativeBleTransport.ts` /
  `nativeHeartRateTransport.ts` implement `BleTransport` on `@capacitor-community/bluetooth-le`'s
  `BleClient`, selected over `Web*Transport` at runtime by `ble/platform.ts`'s `isNativeApp()` (checked in
  `BleManager.tsx`/`HeartRateManager.tsx`). Unlike Web Bluetooth, `BleClient.connect(deviceId)` dials the
  remembered device's Android MAC address directly — no `getDevices()`/`watchAdvertisements()` dance, no
  picker, no user gesture needed for silent auto-reconnect. `nativeRunBackground.ts` keeps a run alive via
  `@capacitor-community/keep-awake` + a `connectedDevice`-type foreground service
  (`@capawesome-team/capacitor-android-foreground-service`; the manifest `<service>`/`<receiver>` and the
  `FOREGROUND_SERVICE*`/`WAKE_LOCK` permissions are hand-added in `apps/android/android/app/src/main/
  AndroidManifest.xml` — that plugin doesn't declare them itself). Google OAuth is hidden on native (Google
  rejects OAuth from an embedded WebView) — see `login/page.tsx`. `isNativeApp()` reads
  `window.androidBridge`, which doesn't exist during SSR, so any render-body use of it must gate on a
  client-mount flag (`useEffect(() => setMounted(true), [])`) or the SSR/first-client-render HTML mismatches
  and the SSR branch sticks — see the `mounted` guard in `login/page.tsx` and `running/page.tsx`.
  `pnpm -F @runner/android sync` runs `cap sync android` (regenerates `android/app/src/main/assets/
  capacitor.config.json` + copies plugin native code into the Gradle project); building `android/` needs
  JDK 21 (Gradle: `cd apps/android/android && ./gradlew assembleDebug`).
  Installable builds come from `.github/workflows/android-release.yml` (on `apps/android/**` changes on main, or
  run by hand): a release APK pointed at production, signed with the key from the `ANDROID_KEYSTORE_BASE64`/
  `ANDROID_KEYSTORE_PASSWORD`/`ANDROID_KEY_ALIAS`/`ANDROID_KEY_PASSWORD` secrets, `versionCode` = run number,
  published as `runner.apk` on the `android-latest` GitHub release. Browsers (never the app itself) get a
  download card for it in Settings (`settings/InstallAppCard.tsx`). Locally built debug APKs are signed with a
  different key, so switching between them and the released app needs an uninstall.

A React Native/Expo mobile client (`apps/mobile`) was scaffolded and is parked on the `archive/mobile`
branch — not present on `main`. Don't resurrect it without being asked; `apps/android` (above) is the live
native-Android path. Its dedicated JWT bearer auth backend (`/api/mobile/auth/*`) was removed along with
it — the web app's Auth.js session cookie is the only auth path now (see Auth below).

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

Production migrations are applied by the Vercel production build itself (`apps/web`'s `vercel-build` →
`scripts/migrate-production.sh`; the DB credentials are sensitive env vars that can't be pulled locally). Preview
builds skip them. Each preview gets its own Neon database branch `preview/<git branch>` (Vercel-managed Neon
integration); `.github/workflows/neon-preview-cleanup.yml` deletes it when the PR closes — left behind, they hit
Neon's branch limit and every preview fails with "Resource provisioning failed". `db:*` scripts load env from `apps/web/.env.local` and run from the repo root (`drizzle.config.ts` points
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
useProgramSync ──► GET /api/programs, /api/user-settings ──► Drizzle ──► Postgres
useProgramSync / pages / RunSession ──► offline Outbox (IndexedDB) ──► POST/PUT/PATCH/DELETE /api/*
Settings → import worker (FIT/zip) ──► POST /api/activities ──► external_activities ◄─► run_history (links)
public/sw.js (service worker) ── caches pages, build assets and GET /api reads for offline use
```

### PWA & offline

The app is an installable PWA that must keep working with no network during a run (BLE doesn't need it).

- **Manifest/icons** — `apps/web/src/app/manifest.ts`, `app/apple-icon.png`, `public/icons/` (PNGs rendered
  from the `icon*.svg` sources there). `proxy.ts`'s matcher must keep `sw.js`, `manifest.webmanifest`,
  `offline.html`, `icons/`, `tesseract/` and `apple-icon` public.
- **Service worker** — `apps/web/public/sw.js`, a plain hand-written script (no bundler). Registered in
  production only (`app/offline/serviceWorker.ts`; `next dev` unregisters it), so test offline behaviour with
  `pnpm build && pnpm start`. Cache-first for `/_next/static`, network-first (4s timeout → cache) for
  navigations, RSC payloads and the GET API reads + `/api/auth/session`, `/offline.html` fallback. After
  sign-in the app posts a `WARM` message so every main route + its assets and each program's data are cached
  up front. User-specific caches are prefixed `runner-user-` and wiped on sign-out/account switch. It also
  posts `NETWORK` messages so the UI knows it's offline even when `navigator.onLine` lies. Bump `VERSION`
  when changing caching strategy.
- **Writes** — never call mutating endpoints directly from the web app. Build a request with `writes.*`
  (`app/offline/requests.ts`) and `enqueueWrite()` it (`app/offline/sync.ts`): the `Outbox`
  (`packages/core/src/sync/Outbox.ts`) persists it per user in IndexedDB, coalesces by key, and replays in
  order when reachable. Replays must be idempotent — creates carry client-generated UUIDs (`POST /api/runs`
  and `POST /api/programs` accept an optional `id` and return 200 for a replay). `app/offline/overlay.ts`
  layers still-queued writes over (possibly SW-cached) reads — see `refreshPrograms`/`loadProgramData` in
  `userData.ts`. The one deliberate exception is importing watch activities from files
  (`app/import/runImport.ts`): an explicit, online-only action whose payload is far too big for the outbox, and
  safe to re-run (the server deduplicates).
- **Bluetooth** — Web Bluetooth exists only in Chromium browsers (not iOS, not Firefox) and only in a secure
  context. `ble/bluetoothAvailability.ts` + `base/BluetoothNotice.tsx` explain/disable accordingly.

- **`BleTransport`** (`packages/core/src/ble/transport.ts`) — platform-agnostic interface over one GATT
  connection: connect/disconnect, raw byte write, notify/disconnect subscriptions. `WebBluetoothTransport`
  (`apps/web/src/app/ble/webBluetoothTransport.ts`) is the Web Bluetooth implementation; owns device
  discovery/picker, GATT connect/teardown, and a localStorage-remembered device id (both it and
  `webHeartRateTransport.ts` share this remembering logic via `ble/rememberedDevice.ts`). Auto-reconnect
  looks the remembered id up via `navigator.bluetooth.getDevices()` (no user gesture needed) and, if the
  device supports it, waits briefly on `watchAdvertisements()` before `gatt.connect()` — Chrome otherwise
  often rejects `connect()` on a device it hasn't seen advertise since the page loaded. A failed connect no
  longer forgets the device (a treadmill that's just off/out of range shouldn't need re-pairing); `connect({
  pick: true })` forces the picker regardless, and `forget()` revokes the permission and clears the
  remembered id — both wired to the "Change device"/"Forget" menu on each `base/DeviceCard.tsx` on the home
  screen, which also auto-connects both remembered devices on mount (see `BleConnector.tsx`).
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
  control loop, manual-speed-override detection (`ManualSpeedDetector`: a belt reading outside every target
  commanded in the last 3 s, moving further out or held after settling, twice in a row), speed commands sent
  only on change (re-sent if the belt never picks one up — a per-second resend undid presses on the
  treadmill's buttons and starved the STATUS polls),
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
`getUserId()` (`apps/web/src/lib/session.ts`), a thin wrapper around the Auth.js session cookie.

### Persistence

Drizzle ORM + Postgres (`apps/web/src/lib/db/schema.ts`, `apps/web/src/lib/db/index.ts`). Besides the
Auth.js tables (`user`, `account`, `session`, `verificationToken`), app tables are intentionally
schemaless JSONB blobs:
- `programs` — one row per saved program, `data: { stages: MultiplyStage[], cooldown: boolean }`.
- `user_settings` — one row per user, `data: { activeProgramId, speedCalibration, athleteProfile }`.
- `run_history` — one row per run, `data` holds start/finish timestamps + the telemetry array
  (`packages/core/src/types/telemetry.ts`). Next to it, server-derived columns the client never writes
  (`started_at`/`ended_at`/`summary`/`summary_version`, see `apps/web/src/lib/runs/summaries.ts`): computed on
  every telemetry PATCH, lazily backfilled by `GET /api/runs` for rows with an outdated `RUN_SUMMARY_VERSION`, so
  the list/statistics never load telemetry. `data.startedAt` is shifted by pauses on every flush — use
  `data.wallStartedAt` / the `started_at` column (see `runInterval` in `packages/core/src/activities/matching.ts`)
  for when a run really happened.
- `external_activities` — watch activities (Garmin) imported from FIT files, see "Watch activities" below.

Program data flows through `/api/programs` + `programAtom`/`useProgramSync` — there is no separate
repository layer in `apps/web`.

### Watch activities (Garmin import)

Runs recorded on the user's Garmin watch are imported read-only (nothing is ever sent to Garmin) and linked to the
RunnerApp run recorded at the same time. Direct Garmin API access isn't available (business-only program; the
unofficial login broke in 2026; Strava's API needs a paid subscription), so the sources are FIT files: pulled
automatically from **intervals.icu** (an official Garmin partner; the user pastes their personal API key), and
uploaded by hand (single files, zips, or Garmin's whole account export — for history older than the ~1 year
Garmin gives intervals.icu).

- **Core** (`packages/core/src/activities/`): `ActivityMetrics` (distance/time/HR, best efforts, per-bpm HR
  histogram, km splits, steady-state speed/HR) is computed the same way for watch activities
  (`fitActivity.ts`, from decoded FIT messages) and app runs (`runMetrics.ts`, from telemetry), so they compare.
  `matching.ts` pairs runs and activities by time overlap. `fitActivity.ts` is imported by concrete path, never via
  the barrel.
- **Decoding**: `apps/web/src/lib/fit/decodeFit.ts` is the only user of `@garmin/fitsdk`. Browser uploads are
  unpacked (`@zip.js/zip.js`, nested zips, `.fit.gz`) and decoded in a module Worker (`app/import/`), then posted
  in ≤2 MB batches (Vercel's request limit is 4.5 MB).
- **Server** (`lib/activities/repo.ts`): dedup by recording identity (`dedup_key` = watch serial + file creation
  time), intervals.icu id, or identical start time; auto-link after imports and when a run finishes;
  `link_mode` `'manual'`/`'none'` records the user's choice so auto-linking never overrides it; deleting only
  sets `deleted_at` (a tombstone background sync respects, an explicit re-upload restores).
- **intervals.icu** (`lib/intervals/`): `client.ts` (Basic `API_KEY:<key>`; base URL overridable via
  `INTERVALS_API_URL` for local testing), `sync.ts` — one bounded pass per `POST /api/integrations/intervals/sync`
  (DB lease, ~40 s budget, no cursor: list → `planSync` diff → download original FIT → `decodeFit` → import), the
  client loops while `remaining > 0` (`app/integrations/intervalsSync.ts`; auto-runs on app start at most hourly).
  Strava-sourced activities can't be fetched from intervals.icu. The key is stored encrypted in
  `user_integrations` (`lib/crypto.ts`, AES-256-GCM, user id as AAD; `INTEGRATIONS_ENCRYPTION_KEY` or derived from
  `AUTH_SECRET`) and never returned to the client.
- **Route map**: outdoor activities keep their GPS track in `streams.lat`/`lng` (5 s bins, index-aligned with the
  other streams); `/activities/[id]` draws it with Leaflet on Esri's plain Light Gray Canvas tiles (`RouteMap.tsx`), coloured by pace/HR/
  elevation/cadence, each in its chart's hue, darker = higher (`routeSegments.ts`). The stream charts run on moving time (`movingTimes`):
  pauses take no room, and gaps are bridged with a dashed line, like Garmin's own charts. `external_activities.streams_version` (`ACTIVITY_STREAMS_VERSION`) marks
  streams built before the route existed: the intervals.icu sync re-downloads those files (`planRouteRefresh`), and
  re-uploading a file upgrades it too.
- **UI**: History (`runs/page.tsx`) merges both (`historyAtom` in `userData.ts`); `/activities/[id]` and the
  "Watch" card on `/runs/[id]` show/change links (outbox writes `writes.linkActivity`/`deleteActivity`);
  `/settings` holds the file import and the heart-rate profile (`user_settings.athleteProfile`).

### Workout from a watch photo

Home → "Scan watch" photographs the workout Garmin shows on the watch ("Baza / 143bpm / 31:00",
"Próg / 21:00@169bpm / 41:00") and runs it as a one-off program. Everything happens on the device:
- **Notation** (`packages/core/src/services/watchWorkoutParser.ts`): `parseWatchWorkout` reads the watch's
  own notation (`143bpm 31:00` = one steady stage; `21:00@169bpm 41:00` = that block with the rest of the
  total split into a warmup and cooldown at the default 143 bpm; `4x4:00@184` = parseProgram's intervals),
  `extractWatchWorkout` pulls it out of noisy OCR text (digit misreads, the ALL-CAPS day header).
- **OCR** (`apps/web/src/app/watch/`): `prepareWatchImage` crops to the watch's black screen and keeps only
  its white text; `readWatchWorkout` reads it with a few thresholds and only trusts a reading two of them
  agree on; `ocr.ts` runs Tesseract.js (Polish + English models) in a classic worker. Its assets are
  self-hosted: `apps/web/scripts/tesseract-assets.mjs` copies them from node_modules into the gitignored
  `public/tesseract/<versions>/` before `dev`/`build` (path exposed as `NEXT_PUBLIC_TESSERACT_ASSETS` by
  next.config.ts), and sw.js caches them cache-first, so scanning works offline after the first time.
  `readWatchWorkout.fixture.test.ts` runs the real pipeline on two photos in `__fixtures__/`.
- **Temporary program** (`watch/temporaryProgram.ts`): the workout takes `programInternalAtom` while
  `temporaryProgramAtom` is set — `useProgramSync` then neither saves nor caches it (it would land on the
  active program), the saved selection stays put and comes back on Discard, `activateProgram`
  (userData.ts, also behind /programs' selection) or an app restart. Runs record `programId: null` +
  `programName` (POST /api/runs takes the client's name only without a programId). "Also save" /
  "Save to programs" creates a normal program, data included in the create.
- **Start**: the preview dialog's Start sets `autostartRunAtom`, and `/running` starts the run on show when
  the treadmill can connect without a picker. On Android the `<input capture>` opens the camera app via
  Capacitor's file chooser — the manifest's `<queries>` for `IMAGE_CAPTURE` makes it visible.

### Statistics

`/stats` and History's filters run entirely client-side on `StatsActivity` (`packages/core/src/stats/`):
`buildStatsActivities` merges app runs and watch activities (a linked pair counts once; belt vs watch distance is a
per-device preference), with `localMs` = local wall-clock time encoded as UTC (read with `getUTC*`). Pure
modules: `filters.ts` (presets + custom year/month/day ranges), `aggregate.ts` (totals, periods, YTD, streaks,
distributions), `records.ts`, `predictions.ts` (VDOT, Riegel with fitted exponent, HR-based effective VO2max,
Tanda), `load.ts` (TRIMP → CTL/ATL/TSB, HR zones). Web side: `app/stats/` (filter atoms in localStorage,
generic chart.js wrappers in `charts.tsx`). Chart look (glass tooltip, glow, gradients) and the validated
palette built from the theme's hues live in `app/charts/chartSetup.ts` — load the `dataviz` skill before
changing colours.

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

`cacheComponents` is on, so Next.js keeps the last 3 visited routes mounted but hidden (React `<Activity>`)
instead of unmounting them: switching back to a recent tab only re-shows it. Hiding runs effect cleanups and
showing re-runs effects, but state (and DOM) survive. Two consequences:
- Each bottom-nav tab page memoizes its content (`StatsContent` etc., `memo(BleConnector)`): Next re-renders a
  re-shown page with fresh props, which would otherwise re-render everything below it.
- Charts go through `app/charts/PersistentChart.tsx` (not react-chartjs-2): it keeps the chart.js instance
  while the page is only hidden, instead of destroying and rebuilding every chart on each re-show.
`AppShell` reads the pathname, so the root layout wraps it in `<Suspense>` (routes with dynamic params, e.g.
`/runs/[id]`, only know it per request).

| Route | Purpose |
|---|---|
| `/` | Home / BLE connect screen |
| `/running` | Active run dashboard |
| `/programs` | List/select saved programs |
| `/add-program` | Program builder |
| `/activities/[id]` | Imported watch activity (charts, splits, best efforts, link to app run) |
| `/stats` | Statistics: KPIs, race predictions, records, charts, filters |
| `/settings` | Garmin sync (intervals.icu) and file import, heart-rate profile, stats preferences |
| `/pid-simulator` | Dev tool comparing the speed controllers on a simulated runner |
| `/login`, `/register` | Auth pages (public, excluded from the proxy gate) |

API routes under `apps/web/src/app/api/` (`programs`, `programs/[id]`, `runs`, `runs/[id]`, `activities`,
`activities/[id]`, `integrations/intervals`, `integrations/intervals/sync`, `user-settings`, `register`, `auth/[...nextauth]`) all resolve the user via `getUserId()` (or `auth()`
for the NextAuth handler itself) and scope Drizzle queries to that user's id.

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
