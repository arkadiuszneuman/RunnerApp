import { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

/**
 * Common page frame: centered column, entrance animation (replays on every
 * navigation since pages remount), and an optional eyebrow/title/action header.
 */
export default function Page({
  title,
  eyebrow,
  action,
  maxWidth = 640,
  children,
}: Readonly<{
  title?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  maxWidth?: number;
  children: ReactNode;
}>) {
  return (
    <Box sx={{ maxWidth, mx: 'auto', animation: 'fade-up 600ms var(--ease-out) backwards' }}>
      {(title || action) && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 2,
            mt: 1,
            mb: 2.5,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            {eyebrow && (
              <Typography variant="overline" component="p" sx={{ color: 'primary.main' }}>
                {eyebrow}
              </Typography>
            )}
            {title && (
              <Typography variant="h4" component="h1" sx={{ overflowWrap: 'anywhere' }}>
                {title}
              </Typography>
            )}
          </Box>
          {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
        </Box>
      )}
      {children}
    </Box>
  );
}
