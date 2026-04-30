'use client';

import { useAtom, useSetAtom } from 'jotai';
import { useEffect, useRef } from 'react';
import axios from 'axios';
import { Timespan } from '@/services/Timespan';
import { activeProgramIdAtom, programInternalAtom } from './atoms';

export function useProgramSync() {
  const [programState, setProgramState] = useAtom(programInternalAtom);
  const setActiveProgramId = useSetAtom(activeProgramIdAtom);
  const activeProgramIdRef = useRef<string | null>(null);
  const loadedRef = useRef(false);

  // On mount: load activeProgramId from settings, then load that program's data
  useEffect(() => {
    axios
      .get('/api/user-settings')
      .then(async (res) => {
        const id: string | null = res.data?.activeProgramId ?? null;
        activeProgramIdRef.current = id;
        setActiveProgramId(id);

        if (!id) return;

        const programRes = await axios.get(`/api/programs/${id}`, {
          transformResponse: [(data) => data],
        });
        const program = JSON.parse(programRes.data as string, Timespan.reviver);
        if (program?.data) setProgramState(program.data);
      })
      .catch(() => {})
      .finally(() => {
        setTimeout(() => {
          loadedRef.current = true;
        }, 0);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
