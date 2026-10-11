import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { AdapterAccountType } from 'next-auth/adapters';

// ─── Auth.js tables ──────────────────────────────────────────────────────────

export const users = pgTable('user', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
  password: text('password'),
});

export const accounts = pgTable(
  'account',
  {
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => [primaryKey({ columns: [account.provider, account.providerAccountId] })]
);

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// ─── App tables ───────────────────────────────────────────────────────────────

/** A user's saved programs — each stores { stages: MultiplyStage[], cooldown: boolean } */
export const programs = pgTable('programs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default('My Program'),
  data: jsonb('data').notNull().default({}),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});

/**
 * Per-user settings — stores { activeProgramId, speedCalibration, athleteProfile } (see
 * api/user-settings/route.ts).
 */
export const userSettings = pgTable('user_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  data: jsonb('data').notNull().default({}),
});

/**
 * One row per run. `data` is the client-written RunRecord (see packages/core's runAnalysis.ts);
 * the columns after it are derived from `data` by the server (see lib/runs/summaries.ts) and are
 * never written by the client: when the run happened, and its summary — so the history list and
 * statistics never have to load every run's telemetry.
 */
export const runHistory = pgTable(
  'run_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    data: jsonb('data').notNull().default({}),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { mode: 'date', withTimezone: true }),
    endedAt: timestamp('ended_at', { mode: 'date', withTimezone: true }),
    summary: jsonb('summary'),
    summaryVersion: integer('summary_version'),
  },
  (run) => [index('run_history_user_started_idx').on(run.userId, run.startedAt)]
);

/**
 * Activities imported from the runner's watch (Garmin, via intervals.icu or uploaded FIT files),
 * optionally linked to the RunnerApp run recorded at the same time. `summary` holds
 * ActivityMetrics (packages/core/src/activities/types.ts) plus the version they were computed
 * with; `streams` the 5 s downsampled samples (no GPS). Deleting one only sets `deleted_at`, so a
 * later sync doesn't import it again.
 */
export const externalActivities = pgTable(
  'external_activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 'intervals' | 'fit_upload' — how it first arrived. */
    source: text('source').notNull(),
    intervalsId: text('intervals_id'),
    garminId: text('garmin_id'),
    /** Identity of the recording (watch serial + file creation time) — see fitActivity.ts. */
    dedupKey: text('dedup_key').notNull(),
    startTime: timestamp('start_time', { mode: 'date', withTimezone: true }).notNull(),
    tzOffsetMin: integer('tz_offset_min'),
    /** ActivitySport: 'run' | 'treadmill' | 'trail' | 'track' | 'indoor'. */
    sport: text('sport').notNull(),
    name: text('name'),
    device: text('device'),
    distanceM: real('distance_m').notNull(),
    elapsedS: integer('elapsed_s').notNull(),
    summary: jsonb('summary').notNull(),
    summaryVersion: integer('summary_version').notNull(),
    streams: jsonb('streams'),
    /** ACTIVITY_STREAMS_VERSION the streams were built with (2: with the GPS route). */
    streamsVersion: integer('streams_version').notNull().default(1),
    importError: text('import_error'),
    linkedRunId: uuid('linked_run_id').references(() => runHistory.id, { onDelete: 'set null' }),
    /** LinkMode: null (never touched) | 'auto' | 'manual' | 'none' (unlinked by the user). */
    linkMode: text('link_mode'),
    deletedAt: timestamp('deleted_at', { mode: 'date', withTimezone: true }),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  },
  (a) => [
    uniqueIndex('external_activities_user_dedup_idx').on(a.userId, a.dedupKey),
    uniqueIndex('external_activities_user_intervals_idx').on(a.userId, a.intervalsId),
    uniqueIndex('external_activities_linked_run_idx').on(a.linkedRunId),
    index('external_activities_user_start_idx').on(a.userId, a.startTime),
  ]
);

/**
 * A user's connection to a third-party data source (today only 'intervals' — intervals.icu, which
 * relays the user's Garmin activities). `secret` is the encrypted credential (lib/crypto.ts) and
 * never leaves the server. The sync bookkeeping lives here too: `sync_lock_until` is a lease so
 * only one sync runs per user at a time, even across serverless instances.
 */
export const userIntegrations = pgTable(
  'user_integrations',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    secret: text('secret').notNull(),
    /** Last characters of the key, to show which one is connected. */
    keyHint: text('key_hint').notNull(),
    athleteId: text('athlete_id'),
    athleteName: text('athlete_name'),
    /** 'ok' | 'needs_reconnect' | 'error' */
    status: text('status').notNull().default('ok'),
    lastError: text('last_error'),
    lastSyncedAt: timestamp('last_synced_at', { mode: 'date', withTimezone: true }),
    fullSyncDoneAt: timestamp('full_sync_done_at', { mode: 'date', withTimezone: true }),
    syncLockUntil: timestamp('sync_lock_until', { mode: 'date', withTimezone: true }),
    retryAfter: timestamp('retry_after', { mode: 'date', withTimezone: true }),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  },
  (i) => [primaryKey({ columns: [i.userId, i.provider] })]
);
