'use client';

import Box from '@mui/material/Box';

export default function Timer(props: { progress: number }) {
  const max = 29;
  const percentage = 100 - (props.progress / 100) * (100 - max);

  return (
    <Box sx={{ width: '130px', height: '130px' }}>
      <Box position="relative" display="inline-block">
        <svg width="100%" height="100%" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="linearColor" gradientTransform="rotate(70)">
              <stop offset="20%" stop-color="#3CF8C8"></stop>
              <stop offset="100%" stop-color="#10BBFE"></stop>
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

        {/* Text inside the circle */}
        {/* Text inside the circle */}
        <Box
          sx={{
            position: 'absolute',
            top: '2em',
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            fontSize: '0.7rem',
            fontWeight: '500',
            color: '#333',
          }}
        >
          TODAY KM
        </Box>
        <Box
          sx={{
            position: 'absolute',
            top: '1.2em',
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            fontSize: '2rem',
            fontWeight: '400',
            color: '#333',
          }}
        >
          9.40
        </Box>

        <Box
          sx={{
            position: 'absolute',
            top: '8.5em',
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            fontSize: '0.7rem',
            fontWeight: '500',
            color: '#333',
          }}
        >
          10 KM
        </Box>
        <Box
          sx={{
            position: 'absolute',
            top: '9.5em',
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            fontSize: '0.7rem',
            fontWeight: '500',
            color: '#333',
          }}
        >
          DAILY GOAL
        </Box>
      </Box>
    </Box>
  );
}
