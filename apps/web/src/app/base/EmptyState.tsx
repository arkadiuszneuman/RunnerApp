import { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { enter, tokens } from '../theme';

export default function EmptyState({
  icon,
  title,
  text,
  action,
}: Readonly<{ icon: ReactNode; title: string; text: ReactNode; action?: ReactNode }>) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 4,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1.5,
        ...enter(1),
      }}
    >
      <Box
        sx={{
          width: 72,
          height: 72,
          borderRadius: '24px',
          display: 'grid',
          placeItems: 'center',
          color: tokens.volt,
          background: `linear-gradient(135deg, ${alpha(tokens.volt, 0.18)}, ${alpha(tokens.cyan, 0.1)})`,
          border: `1px solid ${alpha(tokens.volt, 0.25)}`,
          animation: 'float 4s ease-in-out infinite',
          '& svg': { fontSize: 34 },
        }}
      >
        {icon}
      </Box>
      <Typography variant="h6">{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320 }}>
        {text}
      </Typography>
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
    </Paper>
  );
}
