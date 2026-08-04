import * as SecureStore from 'expo-secure-store';

const TOKENS_KEY = 'runnerapp.tokens';

/**
 * AFTER_FIRST_UNLOCK, not the default WHEN_UNLOCKED, is mandatory here: the
 * default makes the keychain item unreadable while the device is locked —
 * exactly the state a background run sits in between telemetry flushes. With
 * the default, a locked-screen run would silently 401 on every flush and lose
 * its telemetry.
 */
const OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  /** epoch ms — lets the API client refresh proactively instead of waiting for a 401. */
  accessTokenExpiresAt: number;
}

export async function getStoredTokens(): Promise<StoredTokens | null> {
  const raw = await SecureStore.getItemAsync(TOKENS_KEY, OPTS);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredTokens;
  } catch {
    return null;
  }
}

export async function setStoredTokens(tokens: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}): Promise<StoredTokens> {
  const stored: StoredTokens = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpiresAt: Date.now() + tokens.expiresIn * 1000,
  };
  await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(stored), OPTS);
  return stored;
}

export async function clearStoredTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKENS_KEY, OPTS);
}
