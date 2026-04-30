'use client';

import { useAtom } from 'jotai';
import { useEffect, useRef } from 'react';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Timespan } from '@/services/Timespan';
import { activeProgramIdAtom, programInternalAtom } from './atoms';

export function useProgramSync() {
  const [programState, setProgramState] = useAtom(programInternalAtom);
  const [activeProgramId, setActiveProgramId] = useAtom(activeProgramIdAtom);
  const activeProgramIdRef = useRef<string | null>(null);
  const loadedRef = useRef(false);
  const { status } = useSession();
  const router = useRouter();

  // Keep the ref in sync with the atom so saves always target the current program,
  // even when it is changed from outside (e.g. the programs list page).
  useEffect(() => {
    activeProgramIdRef.current = activeProgramId;
  }, [activeProgramId]);

  // Load activeProgramId from settings once authenticated, then load that program's data
  useEffect(() => {
    if (status !== 'authenticated') return;

    axios
      .get('/api/user-settings')
      .then(async (res) => {
        const id: string | null = res.data?.activeProgramId ?? null;
        setActiveProgramId(id);

        if (!id) return;

        const programRes = await axios.get(`/api/programs/${id}`, {
          transformResponse: [(data) => data],
        });
        const program = JSON.parse(programRes.data as string, Timespan.reviver);
        if (program?.data) setProgramState(program.data);
      })
      .catch((err) => {
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          router.push('/login');
        }
      })
      .finally(() => {
        setTimeout(() => {
          loadedRef.current = true;
        }, 0);
      });
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save to DB on change (debounced 1 s)
  useEffect(() => {
    if (!loadedRef.current || !activeProgramIdRef.current) return;

    const id = activeProgramIdRef.current;
    const timer = setTimeout(() => {
      axios.put(`/api/programs/${id}`, { data: programState }).catch(() => {});
    }, 1000);

    return () => clearTimeout(timer);
  }, [programState]);
}
