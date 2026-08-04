'use client';

import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: 'transparent',
      paper: '#0d5f6e',
    },
  },
  typography: {
    fontFamily: 'var(--font-barlow)',
  },
});

export default theme;
