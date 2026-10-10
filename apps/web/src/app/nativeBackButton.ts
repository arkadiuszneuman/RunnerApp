import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { useRouter } from 'next/navigation';
import { NAV_ITEMS } from './base/navItems';
import { isNativeApp } from './ble/platform';

/**
 * Android's hardware/gesture back in the native shell (apps/android). Without a handler the
 * activity just finishes, closing the whole app from any screen. Instead, like a native app with
 * bottom tabs: on a tab's own page (Home, Programs, History, Stats) back sends the app to the
 * background — it never walks back through tab switches, and a run in progress keeps going (see
 * nativeRunBackground.ts). On any other page it steps back through the WebView's history (Next's
 * soft navigations are pushState entries, so this is the browser's back), or, with no history
 * left, goes to the tab the page belongs to (Home if none).
 */
export function useNativeBackButton(): void {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return;
    const listener = App.addListener('backButton', ({ canGoBack }) => {
      const { pathname } = window.location;
      if (NAV_ITEMS.some((item) => item.href === pathname)) void App.minimizeApp();
      else if (canGoBack) window.history.back();
      else router.replace(NAV_ITEMS.find((item) => item.match(pathname))?.href ?? '/');
    });
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [router]);
}
