import { ReactNode } from 'react';
import Box from '@mui/material/Box';
import { tokens } from '../theme';

/** Compact circular percentage gauge that draws itself in on mount. */
export default function ProgressRing({
  value,
  size = 44,
  stroke = 4,
  color = tokens.volt,
  children,
}: Readonly<{ value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }>) {
  const r = (36 - stroke) / 2;
  const pct = Math.min(100, Math.max(0, value));

  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg viewBox="0 0 36 36" width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={18} cy={18} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={18}
          cy={18}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${pct} 100`}
          style={{
            animation: 'ring-draw 1.1s var(--ease-out) 200ms backwards',
            filter: `drop-shadow(0 0 3px ${color})`,
          }}
        />
      </svg>
      <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{children}</Box>
    </Box>
  );
}
