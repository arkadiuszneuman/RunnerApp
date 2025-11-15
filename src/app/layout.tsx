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
      <body
        className={roboto.variable}
        style={{
          background:
            'linear-gradient(129deg, rgba(50,206,217,1) 0%, rgba(40,148,173,1) 13%, rgba(35,117,149,1) 21%, rgba(28,75,117,1) 37%, rgba(26,27,77,1) 100%);',
        }}
      >
        <AppRouterCacheProvider>
          <Providers>{children}</Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
