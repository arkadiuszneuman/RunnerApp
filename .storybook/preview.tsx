import React from 'react';
import { Box, CssBaseline, ThemeProvider } from '@mui/material';
import { withThemeFromJSXProvider } from '@storybook/addon-themes';
import { Preview, ReactRenderer } from '@storybook/react';
import { Barlow } from 'next/font/google';
import theme from '../src/app/theme';
import './style.scss';

const roboto = Barlow({
  weight: ['100', '200', '300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-barlow',
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
      <div className={roboto.className}>
        <Story />
      </div>
    ),
    withThemeFromJSXProvider<ReactRenderer>({
      GlobalStyles: CssBaseline,
      Provider: ThemeProvider,
      themes: {
        // Provide your custom themes here
        light: theme,
      },
      defaultTheme: 'light',
    }),
  ],
};

export default preview;
