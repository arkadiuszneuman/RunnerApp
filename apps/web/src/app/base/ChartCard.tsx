import { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useDeferredMount } from '../charts/useDeferredMount';
import { displayFont, enter } from '../theme';

/** A titled card holding one chart; `wide` spans the whole row of a two-column grid. */
export default function ChartCard({
  title,
  height = 260,
  wide,
  index,
  deferIndex = 0,
  children,
}: Readonly<{
  title: string;
  height?: number;
  wide?: boolean;
  index: number;
  /** Charts mount `deferIndex` animation frames after this card first renders — see useDeferredMount. */
  deferIndex?: number;
  children: ReactNode;
}>) {
  const ready = useDeferredMount(deferIndex);
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, gridColumn: wide ? '1 / -1' : undefined, minWidth: 0, ...enter(index) }}
    >
      <Typography sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.15rem', mb: 1 }}>
        {title}
      </Typography>
      <Box sx={{ height }}>{ready ? children : null}</Box>
    </Paper>
  );
}
