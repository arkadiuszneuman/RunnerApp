import { useSyncExternalStore } from 'react';
import { isNativeApp } from './ble/platform';

/** Published by .github/workflows/android-release.yml. */
export const ANDROID_APK_URL =
  'https://github.com/arkadiuszneuman/RunnerApp/releases/download/android-latest/runner.apk';

export type InstallPlatform = 'native' | 'android' | 'other';

const noSubscription = () => () => {};
const clientPlatform = (): InstallPlatform => {
  if (isNativeApp()) return 'native';
  return /android/i.test(navigator.userAgent) ? 'android' : 'other';
};
// isNativeApp() can't be read during SSR: undefined there and on the hydrating render.
const serverPlatform = (): InstallPlatform | undefined => undefined;

/**
 * Where the page runs, for offering the Android app (apps/android): 'native' inside the app
 * itself (nothing to install), 'android' in an Android browser, undefined until mounted.
 */
export function useInstallPlatform(): InstallPlatform | undefined {
  return useSyncExternalStore(noSubscription, clientPlatform, serverPlatform);
}
