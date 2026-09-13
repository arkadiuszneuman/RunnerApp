export type OutboxMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface OutboxRequest {
  method: OutboxMethod;
  url: string;
  /** Any JSON-serializable value. Normalized through JSON on enqueue (so e.g. Timespans become `{ totalMilliseconds }`). */
  body?: unknown;
}

export interface OutboxEntry extends OutboxRequest {
  id: string;
  /**
   * Coalescing key: enqueueing a request whose key matches a still-waiting
   * entry updates that entry in place (keeping its queue position) instead of
   * appending a new one — e.g. every 30s telemetry flush of one run collapses
   * into a single pending PATCH.
   */
  key: string;
  enqueuedAt: number;
  attempts: number;
  /**
   * Set (and persisted) while some flush — possibly in another tab — is
   * sending this entry, so nothing coalesces into a request that's already on
   * the wire. Considered abandoned after `staleSendMs` (e.g. the tab died).
   */
  sendingSince?: number;
}

/** Persistence for the queue. `save` always receives the complete list. */
export interface OutboxStorage {
  load(): Promise<OutboxEntry[]>;
  save(entries: OutboxEntry[]): Promise<void>;
}

/** Performs one request. Resolves with the HTTP status; rejects only when the request never got a response (offline, timeout). */
export type OutboxSend = (request: OutboxRequest) => Promise<{ status: number }>;

/** Why a flush stopped before emptying the queue, or null if it didn't. */
export type OutboxBlockReason = 'offline' | 'auth' | 'server' | 'busy' | null;

export interface OutboxFlushResult {
  sent: OutboxEntry[];
  /** Entries the server permanently rejected (4xx other than 401/408/429) — retrying them can't succeed. */
  dropped: OutboxEntry[];
  blocked: OutboxBlockReason;
}

export interface OutboxOptions {
  storage: OutboxStorage;
  send: OutboxSend;
  now?: () => number;
  createId?: () => string;
  /**
   * Mutual exclusion around each load→modify→save, shared across every
   * context using the same storage (e.g. `navigator.locks` across tabs).
   * Calls within this Outbox instance are always serialized regardless.
   */
  withLock?: <T>(fn: () => Promise<T>) => Promise<T>;
  /** Defaults to 60s — must comfortably exceed the send timeout. */
  staleSendMs?: number;
}

export interface EnqueueOptions {
  key: string;
  /** Combines a waiting entry's body with the new one. Defaults to replacing it. */
  merge?: (previous: unknown, next: unknown) => unknown;
}

type Listener = (entries: readonly OutboxEntry[]) => void;

let fallbackIdCounter = 0;

/**
 * A persistent, ordered queue of mutating HTTP requests that survives being
 * offline and page reloads. Requests are replayed strictly in order, one at a
 * time: a request that couldn't be delivered (no network, 5xx, 401) stops the
 * flush and stays at the head so later requests never overtake it — a run's
 * PATCH can't land before its POST, a delete can't precede a create.
 *
 * Replayed requests must therefore be idempotent (client-generated ids for
 * creates, full-state PUT/PATCH bodies): a request whose response was lost is
 * sent again.
 */
export class Outbox {
  private readonly storage: OutboxStorage;
  private readonly send: OutboxSend;
  private readonly now: () => number;
  private readonly createId: () => string;
  private readonly withLock: <T>(fn: () => Promise<T>) => Promise<T>;
  private readonly staleSendMs: number;

  private snapshot: readonly OutboxEntry[] = [];
  private readonly listeners = new Set<Listener>();
  private localChain: Promise<unknown> = Promise.resolve();
  private flushPromise: Promise<OutboxFlushResult> | undefined;

  constructor(opts: OutboxOptions) {
    this.storage = opts.storage;
    this.send = opts.send;
    this.now = opts.now ?? Date.now;
    this.createId = opts.createId ?? (() => `${Date.now().toString(36)}-${(fallbackIdCounter++).toString(36)}`);
    this.withLock = opts.withLock ?? ((fn) => fn());
    this.staleSendMs = opts.staleSendMs ?? 60_000;
  }

  /** The last known queue contents (refreshed by every operation). */
  entries(): readonly OutboxEntry[] {
    return this.snapshot;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Re-reads storage, e.g. on startup or when another tab may have changed it. */
  async refresh(): Promise<readonly OutboxEntry[]> {
    await this.mutate(() => undefined);
    return this.snapshot;
  }

  async enqueue(request: OutboxRequest, { key, merge }: EnqueueOptions): Promise<void> {
    const body = request.body === undefined ? undefined : JSON.parse(JSON.stringify(request.body));
    await this.mutate((entries) => {
      const waiting = findLast(entries, (e) => e.key === key && !this.isBeingSent(e));
      if (waiting) {
        waiting.method = request.method;
        waiting.url = request.url;
        waiting.body = merge && waiting.body !== undefined ? merge(waiting.body, body) : body;
        return;
      }
      entries.push({
        id: this.createId(),
        key,
        method: request.method,
        url: request.url,
        body,
        enqueuedAt: this.now(),
        attempts: 0,
      });
    });
  }

  /** Sends queued requests in order until the queue is empty or delivery is blocked. Concurrent calls share one run. */
  flush(): Promise<OutboxFlushResult> {
    if (this.flushPromise) return this.flushPromise;
    this.flushPromise = this.runFlush().finally(() => {
      this.flushPromise = undefined;
    });
    return this.flushPromise;
  }

  private async runFlush(): Promise<OutboxFlushResult> {
    const result: OutboxFlushResult = { sent: [], dropped: [], blocked: null };

    for (;;) {
      let claimed: OutboxEntry | undefined;
      let busy = false;
      await this.mutate((entries) => {
        const head = entries[0];
        if (!head) return;
        if (this.isBeingSent(head)) {
          busy = true;
          return;
        }
        head.sendingSince = this.now();
        claimed = { ...head };
      });
      if (busy) return { ...result, blocked: 'busy' };
      if (!claimed) return result;
      const entry: OutboxEntry = claimed;

      let status: number | undefined;
      try {
        ({ status } = await this.send({ method: entry.method, url: entry.url, body: entry.body }));
      } catch {
        status = undefined;
      }

      const outcome = classify(status);
      await this.mutate((entries) => {
        const index = entries.findIndex((e) => e.id === entry.id);
        if (index === -1) return;
        if (outcome === 'done' || outcome === 'drop') {
          entries.splice(index, 1);
        } else {
          delete entries[index].sendingSince;
          entries[index].attempts += 1;
        }
      });

      if (outcome === 'done') result.sent.push(entry);
      else if (outcome === 'drop') result.dropped.push(entry);
      else return { ...result, blocked: outcome };
    }
  }

  private isBeingSent(entry: OutboxEntry): boolean {
    return entry.sendingSince !== undefined && this.now() - entry.sendingSince < this.staleSendMs;
  }

  private mutate(fn: (entries: OutboxEntry[]) => void): Promise<void> {
    const run = () =>
      this.withLock(async () => {
        const entries = (await this.storage.load()).map((e) => ({ ...e }));
        const before = JSON.stringify(entries);
        fn(entries);
        if (JSON.stringify(entries) !== before) await this.storage.save(entries);
        this.setSnapshot(entries);
      });
    const next = this.localChain.then(run, run);
    this.localChain = next.catch(() => {});
    return next;
  }

  private setSnapshot(entries: OutboxEntry[]): void {
    const changed = JSON.stringify(entries) !== JSON.stringify(this.snapshot);
    this.snapshot = entries;
    if (changed) this.listeners.forEach((listener) => listener(entries));
  }
}

function classify(status: number | undefined): 'done' | 'drop' | Exclude<OutboxBlockReason, 'busy' | null> {
  if (status === undefined) return 'offline';
  if (status >= 200 && status < 300) return 'done';
  if (status === 401) return 'auth';
  if (status === 408 || status === 429 || status >= 500) return 'server';
  return 'drop';
}

function findLast<T>(items: T[], predicate: (item: T) => boolean): T | undefined {
  for (let i = items.length - 1; i >= 0; i--) {
    if (predicate(items[i])) return items[i];
  }
  return undefined;
}
