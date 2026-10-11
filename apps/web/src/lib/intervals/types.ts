/** Wire shapes of /api/integrations/intervals* — shared with the client, so no server imports here. */

/** GET /api/integrations/intervals — never includes the key itself. */
export type IntervalsStatus =
  | { connected: false }
  | {
      connected: true;
      status: 'ok' | 'needs_reconnect' | 'error';
      keyHint: string;
      athleteName: string | null;
      lastSyncedAt: string | null;
      fullSyncDone: boolean;
      lastError: string | null;
      /** Stored activities whose GPS route is still to be fetched (see planRouteRefresh). */
      routesPending: number;
    };

/** POST /api/integrations/intervals/sync — one bounded pass; the client calls again while `remaining > 0`. */
export type SyncResult = {
  imported: number;
  attached: number;
  failed: number;
  remaining: number;
  /** Stored activities whose file was fetched again for the GPS route in this pass. */
  routes: number;
  /** Set when the pass stopped early; `remaining` is then still to do. */
  stopped?: 'rate_limited' | 'busy' | 'auth' | 'unreachable' | 'not_connected';
  retryAfterSec?: number;
};
