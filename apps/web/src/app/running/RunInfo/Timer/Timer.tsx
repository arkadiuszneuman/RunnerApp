'use client';

import { ReactNode, useId } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { displayFont, tokens } from '@/app/theme';

/** The ring is a 270° arc: 75 units of a pathLength=100 circle, gap at the bottom. */
const ARC = 75;
const R = 86;
const toRad = (deg: number) => (deg * Math.PI) / 180;
/** Polar → SVG coordinate, rounded: Node and browsers can differ in the last float digit, which breaks hydration. */
const polar = (radius: number, deg: number, fn: typeof Math.cos) =>
  Math.round((100 + radius * fn(toRad(deg))) * 1000) / 1000;

const labelSx = {
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: tokens.textMuted,
  fontWeight: 600,
  lineHeight: 1.2,
} as const;

export default function Timer(props: {
  /** 0..100 */
  progress: number;
  primaryText?: string;
  primaryTextInfo?: string;
  secondaryText?: string;
  secondaryTextInfo?: string;
  /** Maximum diameter in rem (the ring also caps at 80vw). */
  size?: number;
  /** Gradient start/end of the progress arc. */
  colors?: [string, string];
  /** Rendered under the primary text, e.g. the stage target. */
  children?: ReactNode;
  dimmed?: boolean;
}) {
  const { size = 18, colors = [tokens.volt, tokens.cyan] } = props;
  const id = `ring${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const p = Math.min(100, Math.max(0, props.progress || 0)) / 100;

  const arcProps = {
    cx: 100,
    cy: 100,
    r: R,
    fill: 'none',
    strokeWidth: 12,
    strokeLinecap: 'round' as const,
    pathLength: 100,
    transform: 'rotate(135 100 100)',
  };

  return (
    <Box
      sx={{
        position: 'relative',
        width: `min(${size}rem, 80vw)`,
        aspectRatio: '1',
        mx: 'auto',
        containerType: 'inline-size',
      }}
    >
      <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={colors[0]} />
            <stop offset="100%" stopColor={colors[1]} />
          </linearGradient>
          <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>

        {Array.from({ length: 31 }, (_, i) => {
          const deg = 135 + (270 * i) / 30;
          const inner = i % 5 === 0 ? 68 : 71;
          return (
            <line
              key={i}
              x1={polar(inner, deg, Math.cos)}
              y1={polar(inner, deg, Math.sin)}
              x2={polar(75, deg, Math.cos)}
              y2={polar(75, deg, Math.sin)}
              stroke={i / 30 <= p ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)'}
              strokeWidth={i % 5 === 0 ? 1.6 : 1}
              strokeLinecap="round"
              style={{ transition: 'stroke 600ms ease' }}
            />
          );
        })}

        <circle {...arcProps} stroke="rgba(255,255,255,0.07)" strokeDasharray={`${ARC} 100`} />

        {p > 0 && (
          <>
            <circle
              {...arcProps}
              stroke={`url(#${id})`}
              strokeDasharray={`${ARC * p} 100`}
              filter={`url(#${id}-glow)`}
              opacity={0.6}
              style={{ transition: 'stroke-dasharray 1s linear' }}
            />
            <circle
              {...arcProps}
              stroke={`url(#${id})`}
              strokeDasharray={`${ARC * p} 100`}
              style={{ transition: 'stroke-dasharray 1s linear' }}
            />
            {/* Knob rides the arc by rotating, so a stage reset rewinds along the ring */}
            <g
              style={{
                transform: `rotate(${270 * p}deg)`,
                transformOrigin: '100px 100px',
                transition: 'transform 1s linear',
              }}
            >
              <circle cx={polar(R, 135, Math.cos)} cy={polar(R, 135, Math.sin)} r={4} fill="#fff" />
            </g>
          </>
        )}
      </svg>

      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          opacity: props.dimmed ? 0.45 : 1,
          transition: 'opacity 400ms ease',
        }}
      >
        <Typography sx={{ ...labelSx, fontSize: '4.2cqi' }}>{props.primaryTextInfo}</Typography>
        <Typography
          className="tabular"
          sx={{
            fontFamily: displayFont,
            fontWeight: 700,
            fontSize: '25cqi',
            lineHeight: 1,
            letterSpacing: '-0.02em',
            my: '1cqi',
          }}
        >
          {props.primaryText}
        </Typography>
        {props.children}
      </Box>

      <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: '3cqi', textAlign: 'center' }}>
        <Typography
          className="tabular"
          sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '8cqi', lineHeight: 1 }}
        >
          {props.secondaryText}
        </Typography>
        <Typography sx={{ ...labelSx, fontSize: '3.4cqi' }}>{props.secondaryTextInfo}</Typography>
      </Box>
    </Box>
  );
}
