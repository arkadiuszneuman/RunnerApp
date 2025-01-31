'use client';

import RunnerTypography from '@/app/base/RunnerTypography';
import Box from '@mui/material/Box';
import Grid2 from '@mui/material/Grid2';

export default function Timer(props: {
  progress: number;
  primaryText?: string;
  primaryTextInfo?: string;
  secondaryText?: string;
  secondaryTextInfo?: string;
  size?: number;
}) {
  const { size = 15 } = props;
  const max = 29;
  const percentage = 100 - (props.progress / 100) * (100 - max);

  return (
    <Box sx={{ width: `${size}rem`, height: `${size}rem` }}>
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
            stroke="#5777B5"
            strokeWidth="0.7"
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

        <Grid2
          container
          direction="column"
          sx={{
            position: 'absolute',
            top: `${size / 6}rem`,
            left: 0,
            right: 0,
            bottom: `${size / 14}rem`,
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Grid2
            container
            direction="column"
            spacing={`${size / 15}rem`}
            sx={{
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: `${size / 15}rem`,
            }}
          >
            <Grid2>
              <RunnerTypography
                textVariant="secondary"
                sx={{
                  fontSize: `${size / 17}rem`,
                }}
              >
                {props.primaryTextInfo}
              </RunnerTypography>
            </Grid2>
            <Grid2 size="auto">
              <RunnerTypography
                sx={{
                  fontSize: `${size / 4}rem`,
                  fontWeight: '400',
                }}
              >
                {props.primaryText}
              </RunnerTypography>
            </Grid2>
          </Grid2>

          <Grid2
            container
            direction="column"
            sx={{
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Grid2>
              <RunnerTypography
                sx={{
                  fontSize: `${size / 17}rem`,
                }}
              >
                {props.secondaryText}
              </RunnerTypography>
            </Grid2>
            <Grid2>
              <RunnerTypography
                textVariant="secondary"
                sx={{
                  fontSize: `${size / 17}rem`,
                }}
              >
                {props.secondaryTextInfo}
              </RunnerTypography>
            </Grid2>
          </Grid2>
        </Grid2>
      </Box>
    </Box>
  );
}
