import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { clearStoredTokens, getStoredTokens, setStoredTokens, type StoredTokens } from '../auth/tokenStorage';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
if (!API_URL) {
  throw new Error('EXPO_PUBLIC_API_URL is not set — see apps/mobile/.env.example');
}

/** A 90-minute run outlives a 1h access token, so refresh proactively before it's needed. */
const PROACTIVE_REFRESH_WINDOW_MS = 10 * 60 * 1000;

export const client = axios.create({ baseURL: API_URL });

let refreshPromise: Promise<StoredTokens | null> | null = null;

async function performRefresh(refreshToken: string): Promise<StoredTokens | null> {
  try {
    const { data } = await axios.post(`${API_URL}/api/mobile/auth/refresh`, { refreshToken });
    return await setStoredTokens(data);
  } catch {
    return null;
  }
}

/** Single-flight: concurrent callers share the same in-flight refresh instead of racing. */
function refreshOnce(refreshToken: string): Promise<StoredTokens | null> {
  if (!refreshPromise) {
    refreshPromise = performRefresh(refreshToken).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

client.interceptors.request.use(async (config) => {
  const tokens = await getStoredTokens();
  if (!tokens) return config;

  let activeTokens = tokens;
  if (tokens.accessTokenExpiresAt - Date.now() < PROACTIVE_REFRESH_WINDOW_MS) {
    const refreshed = await refreshOnce(tokens.refreshToken);
    // If refresh failed (e.g. offline), fall through with the stale token —
    // don't sign the user out mid-run over a network blip.
    if (refreshed) activeTokens = refreshed;
  }

  config.headers.set('Authorization', `Bearer ${activeTokens.accessToken}`);
  return config;
});

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableConfig | undefined;
    if (error.response?.status !== 401 || !originalRequest) {
      throw error;
    }

    if (originalRequest._retried) {
      // Already retried once with a freshly refreshed token and still 401 —
      // the session is genuinely invalid server-side (revoked, deleted, ...).
      await clearStoredTokens();
      throw error;
    }

    const tokens = await getStoredTokens();
    if (!tokens) throw error;

    const refreshed = await refreshOnce(tokens.refreshToken);
    if (!refreshed) throw error;

    originalRequest._retried = true;
    originalRequest.headers.set('Authorization', `Bearer ${refreshed.accessToken}`);
    return client(originalRequest);
  }
);
