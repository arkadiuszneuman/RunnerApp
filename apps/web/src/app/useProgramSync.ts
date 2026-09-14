'use client';

import { useAtom, useSetAtom } from 'jotai';
import { useEffect, useRef } from 'react';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { activeProgramIdAtom, programInternalAtom } from './atoms';
import { overlayActiveProgramId } from './offline/overlay';
import { writes } from './offline/requests';
import { enqueueWrite, getPendingWrites } from './offline/sync';
import {
  cacheProgramData,
  claimProgramSave,
  loadProgramData,
  setProgramFromServer,
  userSettingsLoadedAtom,
} from './userData';

export function useProgramSync() {
  const [programState] = useAtom(programInternalAtom);
  const [activeProgramId, setActiveProgramId] = useAtom(activeProgramIdAtom);
  const setUserSettingsLoaded = useSetAtom(userSettingsLoadedAtom);
  const activeProgramIdRef = useRef<string | null>(null);
  const loadedRef = useRef(false);
  const { status } = useSession();
  const router = useRouter();

  // Keep the ref in sync with the atom so saves always target the current program,
  // even when it is changed from outside (e.g. the programs list page).
  useEffect(() => {
    activeProgramIdRef.current = activeProgramId;
  }, [activeProgramId]);

  // Load activeProgramId from settings once authenticated, then load that program's data.
  // Offline, both reads come from the service worker's cache, with any
  // still-queued local changes layered on top.
  useEffect(() => {
    if (status !== 'authenticated') return;

    (async () => {
      try {
        const [settings, pending] = await Promise.all([axios.get('/api/user-settings'), getPendingWrites()]);
        const id = overlayActiveProgramId(settings.data?.activeProgramId ?? null, pending);
        setActiveProgramId(id);
        if (!id) return;

        const data = await loadProgramData(id);
        if (data) setProgramFromServer(data);
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          router.push('/login');
        }
      } finally {
        loadedRef.current = true;
        setUserSettingsLoaded(true);
      }
    })();
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save on change (debounced 1 s) through the offline queue, so edits made
  // without a connection are delivered once it's back.
  useEffect(() => {
    if (!loadedRef.current || !activeProgramIdRef.current) return;

    const id = activeProgramIdRef.current;
    // Keeps programDataCache (see programs/page.tsx's setActive) reflecting
    // the program as it's actually being edited, not undone the moment a
    // save is claimed — not debounced, since it's just an in-memory mirror
    // for instant switching, no network involved.
    cacheProgramData(id, programState);
    const timer = setTimeout(() => {
      if (claimProgramSave(programState)) {
        void enqueueWrite(writes.updateProgram(id, { data: programState }));
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [programState]);
}
