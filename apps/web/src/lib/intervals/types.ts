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
    };

/** POST /api/integrations/intervals/sync — one bounded pass; the client calls again while `remaining > 0`. */
export type SyncResult = {
  imported: number;
  attached: number;
  failed: number;
  remaining: number;
  /** Set when the pass stopped early; `remaining` is then still to do. */
  stopped?: 'rate_limited' | 'busy' | 'auth' | 'unreachable' | 'not_connected';
  retryAfterSec?: number;
};
