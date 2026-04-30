'use client';

import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: 'transparent',
      paper: 'rgba(255,255,255,0.08)',
    },
  },
  typography: {
    fontFamily: 'var(--font-barlow)',
  },
});

export default theme;
