import { Outbox, type OutboxEntry, type OutboxFlushResult, type OutboxSend } from '@runner/core';
import { atom } from 'jotai';
import { store } from '../store';
import { createOutboxStorage } from './outboxStorage';
import type { QueuedWrite } from './requests';

/** idle = nothing waiting (or waiting on another tab); auth = the server wants a fresh sign-in first. */
export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'auth' | 'error';

export const pendingWritesAtom = atom<readonly OutboxEntry[]>([]);
export const syncStatusAtom = atom<SyncStatus>('idle');
/**
 * True when the browser reports no network OR the last delivery attempt
 * couldn't reach the server — navigator.onLine alone stays true on a Wi-Fi
 * network with no working uplink, which is exactly the gym scenario.
 */
export const isOfflineAtom = atom(false);

const SEND_TIMEOUT_MS = 20_000;
const RETRY_INTERVAL_MS = 15_000;

const send: OutboxSend = async ({ method, url, body }) => {
  const response = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  return { status: response.status };
};

let outbox: Outbox | undefined;
let outboxUserId: string | null = null;
let unsubscribeOutbox: (() => void) | undefined;
let waiters: ((box: Outbox) => void)[] = [];
const flushListeners = new Set<(result: OutboxFlushResult) => void>();

/**
 * Binds the queue to the signed-in user (null = signed out / unknown). Writes
 * enqueued while no user is known wait in memory for the next one, rather
 * than being guessed into some account.
 */
export function setSyncUser(userId: string | null): void {
  if (userId === outboxUserId) return;
  outboxUserId = userId;
  unsubscribeOutbox?.();
  unsubscribeOutbox = undefined;
  outbox = undefined;
  store.set(pendingWritesAtom, []);
  if (!userId) return;

  const box = new Outbox({
    storage: createOutboxStorage(userId),
    send,
    createId: () => crypto.randomUUID(),
    withLock: (fn) =>
      typeof navigator !== 'undefined' && navigator.locks
        ? navigator.locks.request(`runner-outbox:${userId}`, fn)
        : fn(),
  });
  outbox = box;
  unsubscribeOutbox = box.subscribe((entries) => store.set(pendingWritesAtom, entries));
  waiters.forEach((resolve) => resolve(box));
  waiters = [];
  void box.refresh().then(() => flushOutbox());
}

/** Persists a write and tries to deliver it right away. Resolves once it's safely queued, not once it's sent. */
export async function enqueueWrite(write: QueuedWrite): Promise<void> {
  const box = outbox ?? (await new Promise<Outbox>((resolve) => waiters.push(resolve)));
  await box.enqueue(write.request, write.options);
  void flushOutbox();
}

/**
 * The current user's queued writes, read fresh from storage — for layering
 * over server data at load time, when pendingWritesAtom may not have been
 * populated yet. Gives up (empty) if no user gets bound within a few seconds.
 */
export async function getPendingWrites(): Promise<readonly OutboxEntry[]> {
  const box =
    outbox ??
    (await Promise.race([
      new Promise<Outbox>((resolve) => waiters.push(resolve)),
      new Promise<undefined>((resolve) => setTimeout(resolve, 3_000)),
    ]));
  return box ? box.refresh() : [];
}

/** Called after every flush that delivered or dropped something. */
export function onOutboxFlushed(listener: (result: OutboxFlushResult) => void): () => void {
  flushListeners.add(listener);
  return () => {
    flushListeners.delete(listener);
  };
}

export async function flushOutbox(): Promise<void> {
  const box = outbox;
  if (!box) return;
  if (box.entries().length > 0) store.set(syncStatusAtom, 'syncing');

  const result = await box.flush();
  if (box !== outbox) return; // user changed mid-flush

  if (result.blocked === 'offline') {
    store.set(isOfflineAtom, true);
  } else if (result.blocked !== 'busy') {
    store.set(isOfflineAtom, false);
  }
  store.set(
    syncStatusAtom,
    result.blocked === 'offline'
      ? 'offline'
      : result.blocked === 'auth'
        ? 'auth'
        : result.blocked === 'server'
          ? 'error'
          : 'idle'
  );

  if (result.dropped.length > 0) {
    console.warn(
      'Offline queue: the server rejected these writes, discarding them',
      result.dropped.map((e) => `${e.method} ${e.url}`)
    );
  }
  if (result.sent.length > 0 || result.dropped.length > 0) {
    flushListeners.forEach((listener) => listener(result));
  }
}

/** Wires connectivity events and periodic retries. Returns a cleanup function. */
export function startSyncTriggers(): () => void {
  store.set(isOfflineAtom, !navigator.onLine);

  const handleOnline = () => {
    store.set(isOfflineAtom, false);
    void flushOutbox();
  };
  const handleOffline = () => store.set(isOfflineAtom, true);
  const handleVisible = () => {
    if (document.visibilityState === 'visible') void flushOutbox();
  };
  // The service worker (public/sw.js) reports whether its network requests
  // actually got through — the only reliable signal once it serves from cache.
  const handleWorkerMessage = (event: MessageEvent) => {
    const data = event.data as { type?: string; online?: boolean } | undefined;
    if (data?.type !== 'NETWORK') return;
    const wasOffline = store.get(isOfflineAtom);
    store.set(isOfflineAtom, !data.online);
    if (data.online && wasOffline) void flushOutbox();
  };
  const retry = setInterval(() => {
    if ((outbox?.entries().length ?? 0) > 0) void flushOutbox();
  }, RETRY_INTERVAL_MS);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  document.addEventListener('visibilitychange', handleVisible);
  navigator.serviceWorker?.addEventListener('message', handleWorkerMessage);
  return () => {
    navigator.serviceWorker?.removeEventListener('message', handleWorkerMessage);
    clearInterval(retry);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    document.removeEventListener('visibilitychange', handleVisible);
  };
}
