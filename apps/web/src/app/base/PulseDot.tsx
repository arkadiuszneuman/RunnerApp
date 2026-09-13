import Box from '@mui/material/Box';
import { tokens } from '../theme';

/** Small glowing "live" indicator with a radiating ping. */
export default function PulseDot({ color = tokens.volt, size = 8 }: Readonly<{ color?: string; size?: number }>) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        position: 'relative',
        display: 'inline-block',
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: color,
        boxShadow: `0 0 10px ${color}`,
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          bgcolor: color,
          animation: 'ping 1.8s var(--ease-out) infinite',
        },
      }}
    />
  );
}
