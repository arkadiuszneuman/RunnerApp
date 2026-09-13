'use client';

import { useEffect, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { useSession } from 'next-auth/react';
import { programsAtom, refreshPrograms, refreshRuns, runsAtom } from '../userData';
import { adoptCacheOwner, registerServiceWorker, warmOfflineCache } from './serviceWorker';
import { onOutboxFlushed, setSyncUser, startSyncTriggers } from './sync';

/** Top-level routes whose pages (and their build assets) are pre-cached for offline use. */
const APP_ROUTES = ['/', '/running', '/programs', '/add-program', '/runs'];

/**
 * Mounted once at the app root (Providers.tsx): registers the service worker,
 * binds the offline write queue to the signed-in user, refreshes the cached
 * lists once queued writes land, and pre-caches the app for offline use.
 */
export function useOfflineSync(): void {
  const { data: session, status } = useSession();
  const userId = session?.user?.id ?? null;
  const programs = useAtomValue(programsAtom);
  const runs = useAtomValue(runsAtom);
  const warmedRef = useRef(false);

  useEffect(() => {
    registerServiceWorker();
    return startSyncTriggers();
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    const id = status === 'authenticated' ? userId : null;
    setSyncUser(id);
    if (id) void adoptCacheOwner(id);
  }, [status, userId]);

  useEffect(
    () =>
      onOutboxFlushed(({ sent }) => {
        // Not on every mid-run telemetry flush — only once a run appears,
        // disappears, or finishes (which is what makes its summary meaningful).
        const runsChanged = sent.some(
          (e) =>
            e.key.startsWith('run-create:') ||
            e.key.startsWith('run-delete:') ||
            (e.key.startsWith('run-patch:') && (e.body as { finishedAt?: string } | undefined)?.finishedAt)
        );
        if (runsChanged) void refreshRuns();
        if (sent.some((e) => e.key.startsWith('program-'))) void refreshPrograms();
      }),
    []
  );

  useEffect(() => {
    if (warmedRef.current || status !== 'authenticated' || !programs || !runs || !navigator.onLine) return;
    warmedRef.current = true;
    warmOfflineCache([
      ...APP_ROUTES,
      // Any program can then be picked/started offline, not just ones opened before.
      ...programs.map((p) => `/api/programs/${p.id}`),
      // Covers the run-detail route's own build assets (the page is dynamic).
      ...(runs[0] ? [`/runs/${runs[0].id}`] : []),
    ]);
  }, [status, programs, runs]);
}
