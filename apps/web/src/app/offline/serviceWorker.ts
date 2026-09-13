import { atom } from 'jotai';
import { store } from '../store';

/**
 * Caches holding anything user-specific (pages, RSC payloads, API responses,
 * the session). Must match USER_CACHE_PREFIX in public/sw.js. The static-asset
 * cache deliberately doesn't use it: hashed build files are safe to share.
 */
const USER_CACHE_PREFIX = 'runner-user-';
const LAST_USER_KEY = 'runner:lastUserId';

/** Minimal typing for Chromium's install prompt event (not in lib.dom). */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** The deferred install prompt, when the browser offers one (Chromium only; null once installed). */
export const installPromptAtom = atom<BeforeInstallPromptEvent | null>(null);

// Registered at module load rather than in an effect: the event can fire
// before React has hydrated, and it isn't re-dispatched.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    store.set(installPromptAtom, event as BeforeInstallPromptEvent);
  });
  window.addEventListener('appinstalled', () => store.set(installPromptAtom, null));
}

export async function promptInstall(): Promise<void> {
  const event = store.get(installPromptAtom);
  if (!event) return;
  await event.prompt();
  await event.userChoice;
  // A prompt event can only be used once.
  store.set(installPromptAtom, null);
}

/**
 * Production only: in `next dev` a service worker would serve stale chunks
 * across HMR rebuilds, so there we instead remove any worker a previous
 * `next start` on the same origin left behind.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  if (process.env.NODE_ENV !== 'production') {
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => void registration.unregister());
    });
    return;
  }

  navigator.serviceWorker
    .register('/sw.js', { scope: '/', updateViaCache: 'none' })
    .catch((error) => console.warn('Service worker registration failed', error));
}

/**
 * Asks the service worker to fetch and cache these same-origin URLs (pages
 * plus the build assets they reference, API reads) so they work offline even
 * if the user never opened them while online.
 */
export function warmOfflineCache(urls: string[]): void {
  if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;
  void navigator.serviceWorker.ready.then((registration) => {
    registration.active?.postMessage({ type: 'WARM', urls });
  });
}

export async function clearUserCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;
  const names = await caches.keys();
  await Promise.all(names.filter((name) => name.startsWith(USER_CACHE_PREFIX)).map((name) => caches.delete(name)));
}

/**
 * Drops another account's cached pages/API data when a different user signs
 * in on this device — otherwise going offline later could surface them.
 */
export async function adoptCacheOwner(userId: string): Promise<void> {
  let previous: string | null = null;
  try {
    previous = localStorage.getItem(LAST_USER_KEY);
    localStorage.setItem(LAST_USER_KEY, userId);
  } catch {
    // Storage unavailable — nothing to compare against.
  }
  if (previous && previous !== userId) await clearUserCaches();
}

/** Call before signing out, so nothing of this account's data stays readable offline. */
export async function forgetCachedUserData(): Promise<void> {
  try {
    localStorage.removeItem(LAST_USER_KEY);
  } catch {
    // ignore
  }
  await clearUserCaches();
}
