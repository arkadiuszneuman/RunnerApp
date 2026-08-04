import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  type AuthUser,
  type TokenResponse,
  fetchMe,
  loginWithCredentials as apiLoginWithCredentials,
  loginWithGoogleIdToken as apiLoginWithGoogleIdToken,
  logout as apiLogout,
  register as apiRegister,
} from '../api/authApi';
import { signInWithGoogle, signOutGoogle } from './googleSignIn';
import { clearStoredTokens, getStoredTokens, setStoredTokens } from './tokenStorage';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginWithCredentials: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const tokens = await getStoredTokens();
      if (!tokens) {
        setIsLoading(false);
        return;
      }
      const me = await fetchMe().catch(() => null);
      setUser(me);
      setIsLoading(false);
    })();
  }, []);

  const applyTokenResponse = useCallback(async (response: TokenResponse) => {
    await setStoredTokens(response);
    setUser(response.user);
  }, []);

  const loginWithCredentials = useCallback(
    async (email: string, password: string) => {
      await applyTokenResponse(await apiLoginWithCredentials(email, password));
    },
    [applyTokenResponse]
  );

  const loginWithGoogle = useCallback(async () => {
    const idToken = await signInWithGoogle();
    if (!idToken) return; // user cancelled
    await applyTokenResponse(await apiLoginWithGoogleIdToken(idToken));
  }, [applyTokenResponse]);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      await apiRegister(name, email, password);
      await loginWithCredentials(email, password);
    },
    [loginWithCredentials]
  );

  const logout = useCallback(async () => {
    const tokens = await getStoredTokens();
    if (tokens) await apiLogout(tokens.refreshToken);
    await Promise.all([clearStoredTokens(), signOutGoogle().catch(() => {})]);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      loginWithCredentials,
      loginWithGoogle,
      register,
      logout,
    }),
    [user, isLoading, loginWithCredentials, loginWithGoogle, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
