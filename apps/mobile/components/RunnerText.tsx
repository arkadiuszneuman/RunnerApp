import { Text } from '@gluestack-ui/themed';
import type { ComponentProps } from 'react';

const REM = 16;

export type RunnerTextVariant = 'primary' | 'secondary';

/**
 * Barlow ships as three separate static font files (useFonts in
 * app/_layout.tsx), not weight variants of one family — RN can't synthesize
 * intermediate weights from them, so the exact loaded family must be picked
 * per requested weight rather than relying on a `fontWeight` prop.
 */
const BARLOW_BY_WEIGHT: Record<string, string> = {
  '400': 'Barlow_400Regular',
  normal: 'Barlow_400Regular',
  '500': 'Barlow_500Medium',
  '700': 'Barlow_700Bold',
  bold: 'Barlow_700Bold',
};
const DEFAULT_WEIGHT = '500';

export interface RunnerTextProps
  extends Omit<ComponentProps<typeof Text>, 'color' | 'fontSize' | 'lineHeight' | 'size'> {
  textVariant?: RunnerTextVariant;
  /** Font size in rem, matching the web app's RunnerTypography sx.fontSize convention. */
  remSize?: number;
}

/**
 * Mirrors apps/web/src/app/base/RunnerTypography.tsx. `lineHeight` is set
 * equal to the computed font size — the RN equivalent of the web version's
 * `lineHeight: 1` (a unitless CSS multiplier; RN lineHeight is absolute px,
 * so `lineHeight: 1` verbatim would collapse every label to a 1px line box).
 *
 * Defaults come first so callers can override fontWeight/textTransform (e.g.
 * RunInfoData wants weight 400, RunInfoUnit wants lowercase) — color,
 * fontSize and lineHeight are always computed here, excluded from the prop
 * type so a caller can't accidentally shadow them.
 */
export function RunnerText({
  textVariant = 'primary',
  remSize = 1,
  fontWeight = DEFAULT_WEIGHT,
  ...props
}: RunnerTextProps) {
  const fontSize = remSize * REM;
  const fontFamily = BARLOW_BY_WEIGHT[String(fontWeight)] ?? BARLOW_BY_WEIGHT[DEFAULT_WEIGHT];
  return (
    <Text
      textTransform="uppercase"
      {...props}
      fontFamily={fontFamily}
      fontWeight={fontWeight}
      color={textVariant === 'primary' ? '$white' : 'rgba(160,189,255,0.46)'}
      fontSize={fontSize}
      lineHeight={fontSize}
    />
  );
}
