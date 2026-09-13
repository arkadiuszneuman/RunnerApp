import { ReactNode } from 'react';
import Box from '@mui/material/Box';
import { glass } from '../theme';

/** Floating, thumb-reachable action bar pinned to the bottom of the viewport. */
export default function ActionBar({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Box
      sx={{
        position: 'sticky',
        bottom: 'calc(12px + env(safe-area-inset-bottom))',
        zIndex: 5,
        mt: 3,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        borderRadius: 999,
        ...glass,
        background: 'rgba(14, 19, 29, 0.8)',
        boxShadow: '0 20px 50px -12px rgba(0,0,0,0.75)',
        animation: 'fade-up 500ms var(--ease-out) 150ms backwards',
      }}
    >
      {children}
    </Box>
  );
}
