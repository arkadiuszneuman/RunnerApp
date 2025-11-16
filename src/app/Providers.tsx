'use client';

import { ReactNode, useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import objectSupport from 'dayjs/plugin/objectSupport';
import { Provider } from 'jotai';
import theme from './theme';

export default function Providers(props: Readonly<{ children?: ReactNode }>) {
  useEffect(() => {
    dayjs.extend(objectSupport);
  }, []);

  return (
    <Provider>
      <ThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterDayjs}>{props.children}</LocalizationProvider>
      </ThemeProvider>
    </Provider>
  );
}
