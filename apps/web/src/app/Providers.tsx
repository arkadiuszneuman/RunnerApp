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
import theme from './theme';
import { useProgramSync } from './useProgramSync';

function ProgramSyncInitializer() {
  useProgramSync();
  return null;
}

export default function Providers(props: Readonly<{ children?: ReactNode }>) {
  useEffect(() => {
    dayjs.extend(objectSupport);
  }, []);

  return (
    <SessionProvider>
      <Provider>
        <ThemeProvider theme={theme}>
          <CssBaseline enableColorScheme />
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <ProgramSyncInitializer />
            {props.children}
          </LocalizationProvider>
        </ThemeProvider>
      </Provider>
    </SessionProvider>
  );
}
