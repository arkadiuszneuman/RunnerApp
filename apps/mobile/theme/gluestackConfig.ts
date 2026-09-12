import { createConfig } from '@gluestack-style/react';
import { config as defaultConfig } from '@gluestack-ui/config';

/**
 * The stock @gluestack-ui/config ships `tokens.fonts.{heading,body,mono}` as
 * `undefined` (see Text.ts / Heading.ts: `fontFamily: '$body'` / `'$heading'`),
 * so every gluestack primitive (ButtonText, Heading, Input, Badge, ...) falls
 * back to the platform system font even after Barlow is loaded via useFonts
 * in app/_layout.tsx. This rebuilds the same config with those tokens pointed
 * at the loaded Barlow weights — same aliases/plugins/components, only the
 * `fonts` token category changes.
 *
 * RunnerText (mirroring the web app's RunnerTypography) still sets its own
 * fontFamily explicitly per weight, since RN needs the exact static font file
 * per weight rather than one family plus a synthesized fontWeight.
 */
const gluestackUIConfig = createConfig({
  aliases: defaultConfig.aliases,
  tokens: {
    ...defaultConfig.tokens,
    fonts: {
      heading: 'Barlow_700Bold',
      body: 'Barlow_400Regular',
      mono: 'Barlow_400Regular',
    },
  },
  plugins: defaultConfig.plugins,
});

export const config = {
  ...gluestackUIConfig,
  components: defaultConfig.components,
};
