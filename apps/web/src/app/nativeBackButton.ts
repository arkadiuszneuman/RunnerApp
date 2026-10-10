import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { useRouter } from 'next/navigation';
import { isNativeApp } from './ble/platform';

/**
 * Android's hardware/gesture back in the native shell (apps/android). Without a handler the
 * activity just finishes, closing the whole app from any screen. Instead: step back through the
 * WebView's history (Next's soft navigations are pushState entries, so this is the same as the
 * browser's back); with no history left, go to the home screen, and from home send the app to the
 * background rather than finishing it — a run in progress keeps going (see nativeRunBackground.ts).
 */
export function useNativeBackButton(): void {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return;
    const listener = App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else if (window.location.pathname !== '/') router.replace('/');
      else void App.minimizeApp();
    });
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [router]);
}
