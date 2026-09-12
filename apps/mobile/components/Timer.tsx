import { Box } from '@gluestack-ui/themed';
import { useId } from 'react';
import { useWindowDimensions } from 'react-native';
import { Circle, Defs, LinearGradient, Stop, Svg } from 'react-native-svg';
import { RunnerText } from './RunnerText';

export interface TimerProps {
  progress: number;
  primaryText?: string;
  primaryTextInfo?: string;
  secondaryText?: string;
  secondaryTextInfo?: string;
  /** Size in rem. Defaults to a value derived from screen width when omitted (see MIN/MAX_REM_SIZE). */
  size?: number;
}

const REM = 16;
const MAX = 29;
/** Default size targets ~55% of screen width, clamped between these — the web version's fixed 15rem is the ceiling. */
const MIN_REM_SIZE = 10;
const MAX_REM_SIZE = 15;

/**
 * Mirrors apps/web/.../Timer/Timer.tsx. The strokeDashoffset math ports
 * verbatim. Deltas from the web version:
 * - `gradientTransform="rotate(70)"` isn't reliably supported by
 *   react-native-svg, so the rotated gradient line is pre-computed as
 *   explicit endpoints: rotating the default (0,0)->(1,0) line by 70° about
 *   the origin gives (0,0)->(cos70°, sin70°) = (0,0)->(0.342, 0.940).
 * - `width="100%"` doesn't work in RN; size is computed in pixels up front.
 * - the web version's fixed 15rem default doesn't scale down for narrow
 *   phones, so the default here is derived from window width instead.
 */
export function Timer({
  progress,
  primaryText,
  primaryTextInfo,
  secondaryText,
  secondaryTextInfo,
  size,
}: TimerProps) {
  const gradientId = useId();
  const { width } = useWindowDimensions();
  const defaultSize = Math.min(MAX_REM_SIZE, Math.max(MIN_REM_SIZE, (width * 0.55) / REM));
  const resolvedSize = size ?? defaultSize;
  const pixelSize = resolvedSize * REM;
  const percentage = 100 - (progress / 100) * (100 - MAX);

  return (
    <Box style={{ width: pixelSize, height: pixelSize }}>
      <Svg width={pixelSize} height={pixelSize} viewBox="0 0 36 36">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0.342" y2="0.940">
            <Stop offset="20%" stopColor="#3CF8C8" />
            <Stop offset="100%" stopColor="#10BBFE" />
          </LinearGradient>
        </Defs>

        {/* Background circle */}
        <Circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          stroke="#5777B5"
          strokeWidth={0.7}
          strokeDasharray="100"
          strokeDashoffset={MAX}
          strokeLinecap="round"
          transform="rotate(130 18 18)"
        />

        {/* Progress circle */}
        {progress > 0 && (
          <Circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={0.8}
            strokeDasharray="100"
            strokeDashoffset={percentage}
            strokeLinecap="round"
            transform="rotate(130 18 18)"
          />
        )}
      </Svg>

      <Box
        style={{
          position: 'absolute',
          top: pixelSize / 6,
          left: 0,
          right: 0,
          bottom: pixelSize / 14,
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box style={{ alignItems: 'center', marginTop: pixelSize / 15 }}>
          <RunnerText textVariant="secondary" remSize={resolvedSize / 17}>
            {primaryTextInfo}
          </RunnerText>
          <RunnerText remSize={resolvedSize / 4}>{primaryText}</RunnerText>
        </Box>

        <Box style={{ alignItems: 'center' }}>
          <RunnerText remSize={resolvedSize / 17}>{secondaryText}</RunnerText>
          <RunnerText textVariant="secondary" remSize={resolvedSize / 17}>
            {secondaryTextInfo}
          </RunnerText>
        </Box>
      </Box>
    </Box>
  );
}
