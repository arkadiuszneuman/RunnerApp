import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import type { Metadata } from 'next';
import { Barlow } from 'next/font/google';
import Providers from './Providers';
import './globals.css';

const roboto = Barlow({
  weight: ['100', '200', '300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-barlow',
});

export const metadata: Metadata = {
  title: 'Runner App',
  description: 'App for the runners',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={roboto.variable}>
        <AppRouterCacheProvider>
          <Providers>{children}</Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
