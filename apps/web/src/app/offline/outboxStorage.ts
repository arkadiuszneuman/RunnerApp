import type { OutboxEntry, OutboxStorage } from '@runner/core';

const DB_NAME = 'runner-offline';
const STORE = 'outbox';

let dbPromise: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((error) => {
    dbPromise = undefined; // let a later call retry
    throw error;
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(request.result as T);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

/**
 * IndexedDB-backed outbox storage, one record per user — so writes queued by
 * one account are never replayed under another account's session. Falls back
 * to memory (queued writes then don't survive a reload) where IndexedDB is
 * unavailable, e.g. some private-browsing modes.
 */
export function createOutboxStorage(userId: string): OutboxStorage {
  let memory: OutboxEntry[] = [];
  let warned = false;
  const fallback = (error: unknown) => {
    if (!warned) console.warn('Offline queue: IndexedDB unavailable, writes will not survive a reload', error);
    warned = true;
  };

  return {
    async load() {
      try {
        return (await run<OutboxEntry[] | undefined>('readonly', (store) => store.get(userId))) ?? [];
      } catch (error) {
        fallback(error);
        return memory;
      }
    },
    async save(entries) {
      memory = entries;
      try {
        await run('readwrite', (store) => store.put(entries, userId));
      } catch (error) {
        fallback(error);
      }
    },
  };
}
