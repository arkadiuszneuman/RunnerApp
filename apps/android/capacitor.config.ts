import type { CapacitorConfig } from '@capacitor/cli';

// There's no fixed production domain yet (apps/web deploys to Vercel per the README, on
// whatever URL Vercel assigns) — so the server URL is env-driven rather than hardcoded.
// For local testing point it at this machine's LAN IP + `pnpm dev`'s port (3010); the phone and
// the dev machine must be on the same network. `adb reverse tcp:3010 tcp:3010` is an alternative
// to a LAN IP when testing over a USB cable instead.
const serverUrl = process.env.CAPACITOR_SERVER_URL ?? 'http://10.0.0.2:3010';

const config: CapacitorConfig = {
  appId: 'com.runnerapp.app',
  appName: 'Runner',
  webDir: 'www',
  server: {
    url: serverUrl,
    // Next.js's own dev/prod server already serves over http/https as configured — Capacitor
    // shouldn't second-guess that (and localhost/LAN dev has no TLS cert to validate anyway).
    cleartext: true,
    allowNavigation: [new URL(serverUrl).host],
  },
  android: {
    // Debuggable WebView so `chrome://inspect` can attach during development. Off by default;
    // set CAPACITOR_DEBUG=true for a local debug build (still requires USB debugging enabled on
    // the device itself to matter) — never set it for a real release build.
    webContentsDebuggingEnabled: process.env.CAPACITOR_DEBUG === 'true',
  },
  plugins: {
    // The app (theme.ts) is always dark-mode, regardless of the OS's own light/dark setting —
    // @capacitor/android's built-in SystemBars plugin defaults to STYLE_DEFAULT, which picks
    // status/nav bar icon color from the *system's* day/night mode (see SystemBars.java's
    // getStyleForTheme()), not the app's actual background. On a phone in system light mode that
    // renders dark-on-dark, invisible status bar icons — force it to always assume a dark
    // background instead.
    SystemBars: {
      style: 'dark',
    },
  },
};

export default config;
