'use client';

import { Typography } from '@mui/material';
import Box from '@mui/material/Box';

export default function Timer(props: {
  progress: number;
  primaryText?: string;
  primaryTextInfo?: string;
  secondaryText?: string;
  secondaryTextInfo?: string;
}) {
  const max = 29;
  const percentage = 100 - (props.progress / 100) * (100 - max);

  return (
    <Box sx={{ width: '130px', height: '130px' }}>
      <Box position="relative" display="inline-block">
        <svg width="100%" height="100%" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="linearColor" gradientTransform="rotate(70)">
              <stop offset="20%" stopColor="#3CF8C8"></stop>
              <stop offset="100%" stopColor="#10BBFE"></stop>
            </linearGradient>
          </defs>

          {/* Background circle */}
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke="#e6e6e6"
            strokeWidth="0.8"
            strokeDasharray="100"
            strokeDashoffset={max}
            strokeLinecap="round"
            transform="rotate(130 18 18)"
          />

          {/* Progress circle */}
          {props.progress > 0 && (
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke="url(#linearColor)"
              strokeWidth="0.8"
              strokeDasharray="100"
              strokeDashoffset={percentage}
              strokeLinecap="round"
              transform="rotate(130 18 18)"
            />
          )}
        </svg>

        <Typography
          sx={{
            position: 'absolute',
            top: '2em',
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            fontSize: '0.7rem',
            fontWeight: '500',
            color: '#333',
            textTransform: 'uppercase',
          }}
        >
          {props.primaryTextInfo}
        </Typography>

        <Typography
          sx={{
            position: 'absolute',
            top: '1.2em',
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            fontSize: '2rem',
            fontWeight: '400',
            color: '#333',
            textTransform: 'uppercase',
          }}
        >
          {props.primaryText}
        </Typography>

        <Typography
          sx={{
            position: 'absolute',
            top: '8.5em',
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            fontSize: '0.7rem',
            fontWeight: '500',
            color: '#333',
            textTransform: 'uppercase',
          }}
        >
          {props.secondaryText}
        </Typography>
        <Typography
          sx={{
            position: 'absolute',
            top: '9.5em',
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            fontSize: '0.7rem',
            fontWeight: '500',
            color: '#333',
            textTransform: 'uppercase',
          }}
        >
          {props.secondaryTextInfo}
        </Typography>
      </Box>
    </Box>
  );
}
