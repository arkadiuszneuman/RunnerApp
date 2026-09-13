import React from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { withThemeFromJSXProvider } from '@storybook/addon-themes';
import { Preview, ReactRenderer } from '@storybook/react';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import '../src/app/globals.css';
import theme from '../src/app/theme';
import './style.scss';

const barlow = Barlow({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-barlow',
});

const barlowCondensed = Barlow_Condensed({
  weight: ['500', '600', '700', '800'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
});

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    (Story) => (
      <div
        className={`${barlow.variable} ${barlowCondensed.variable}`}
        style={{ fontFamily: 'var(--font-barlow), system-ui, sans-serif' }}
      >
        <Story />
      </div>
    ),
    withThemeFromJSXProvider<ReactRenderer>({
      GlobalStyles: CssBaseline,
      Provider: ThemeProvider,
      themes: {
        dark: theme,
      },
      defaultTheme: 'dark',
    }),
  ],
};

export default preview;
