'use client';

import { ReactNode, useEffect } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import objectSupport from 'dayjs/plugin/objectSupport';
import { Provider } from 'jotai';
import { SessionProvider } from 'next-auth/react';
import ThemeColorSync from './base/ThemeColorSync';
import { useOfflineSync } from './offline/useOfflineSync';
import { useLoadSpeedControllerPreference } from './speedControllerPreference';
import { store } from './store';
import theme from './theme';
import { useProgramSync } from './useProgramSync';
import { useUserDataPreload } from './userData';

function ProgramSyncInitializer() {
  useProgramSync();
  useLoadSpeedControllerPreference();
  useUserDataPreload();
  useOfflineSync();
  return null;
}

export default function Providers(props: Readonly<{ children?: ReactNode }>) {
  useEffect(() => {
    dayjs.extend(objectSupport);
  }, []);

  return (
    <SessionProvider>
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <CssBaseline enableColorScheme />
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <ProgramSyncInitializer />
            <ThemeColorSync />
            {props.children}
          </LocalizationProvider>
        </ThemeProvider>
      </Provider>
    </SessionProvider>
  );
}
