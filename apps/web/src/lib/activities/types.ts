import type {
  ActivityMetrics,
  ActivitySport,
  ActivityStreams,
  LinkMode,
} from '@runner/core/src/activities/types';

/**
 * Wire shapes of /api/activities — shared by the route handlers (lib/activities/repo.ts) and the
 * client (userData.ts), so this module must stay free of server-only imports.
 */

export type ActivitySource = 'intervals' | 'fit_upload';

/** One row of GET /api/activities (no samples). */
export type ActivityListItem = {
  id: string;
  source: ActivitySource;
  intervalsId: string | null;
  garminId: string | null;
  /** ISO 8601, UTC. */
  startTime: string;
  tzOffsetMin: number | null;
  sport: ActivitySport;
  name: string | null;
  device: string | null;
  metrics: ActivityMetrics;
  linkedRunId: string | null;
  linkMode: LinkMode | null;
  importError: string | null;
};

/** GET /api/activities/:id. */
export type ActivityDetail = ActivityListItem & { streams: ActivityStreams | null };
