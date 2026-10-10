import { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { displayFont, enter, tokens } from '../theme';

/** Small uppercase caption used above stat values. */
export const statLabelSx = {
  fontSize: '0.68rem',
  fontWeight: 600,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: tokens.textMuted,
} as const;

/** One headline number with an icon, label and optional unit/sub-line. */
export default function StatTile(
  props: Readonly<{
    label: string;
    value: string;
    sub?: string;
    icon: ReactNode;
    accent: string;
    index: number;
  }>
) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, height: '100%', ...enter(props.index) }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          mb: 0.5,
          color: props.accent,
          '& svg': { fontSize: 16 },
        }}
      >
        {props.icon}
        <Typography sx={statLabelSx}>{props.label}</Typography>
      </Box>
      <Typography
        className="tabular"
        sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.6rem', lineHeight: 1.1 }}
      >
        {props.value}
      </Typography>
      {props.sub && (
        <Typography variant="caption" color="text.secondary">
          {props.sub}
        </Typography>
      )}
    </Paper>
  );
}
