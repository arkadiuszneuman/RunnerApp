import { useEffect, useState, useSyncExternalStore } from 'react';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { ANDROID_APK_URL, type AndroidRelease } from '@/lib/androidRelease';
import { isNativeApp } from './ble/platform';

export { ANDROID_APK_URL };

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

export interface AndroidAppVersion {
  installed: AndroidRelease;
  /** The newest published build, when it's newer than the installed one. */
  update?: AndroidRelease;
}

/** How long one check serves every screen that asks (home, Settings). */
const CHECK_TTL_MS = 10 * 60_000;
let check: { at: number; result: Promise<AndroidAppVersion> } | undefined;

async function checkVersion(): Promise<AndroidAppVersion> {
  const info = await App.getInfo();
  const installed = { versionCode: Number(info.build), versionName: info.version };
  try {
    const response = await fetch('/api/android/latest');
    const latest = response.ok ? ((await response.json()) as AndroidRelease | null) : null;
    // A local debug build is versionCode 1 (and signed with another key): every release shows as
    // an update there, but won't install over it.
    const update = latest && latest.versionCode > installed.versionCode ? latest : undefined;
    return { installed, update };
  } catch {
    return { installed };
  }
}

/**
 * The installed app's version and any newer published build, inside the Android app only
 * (undefined in a browser and until checked). Offline, it just reports no update.
 */
export function useAndroidAppVersion(): AndroidAppVersion | undefined {
  const [version, setVersion] = useState<AndroidAppVersion>();
  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;
    const now = Date.now();
    if (!check || now - check.at > CHECK_TTL_MS) check = { at: now, result: checkVersion() };
    check.result.then(
      (result) => !cancelled && setVersion(result),
      () => {}
    );
    return () => {
      cancelled = true;
    };
  }, []);
  return version;
}

/**
 * Downloads the newest APK in a browser tab over the app; opening the downloaded file installs
 * it over this one (same signing key, higher versionCode), keeping the app's data.
 */
export function downloadAndroidUpdate(): Promise<void> {
  return Browser.open({ url: ANDROID_APK_URL });
}

/** Test helper: forget the cached check. */
export function resetAndroidVersionCheck(): void {
  check = undefined;
}
