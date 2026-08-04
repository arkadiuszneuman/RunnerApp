import axios from 'axios';
import { client } from './client';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export interface AuthUser {
  id: string;
  name: string | null;
  email: string | null;
  image?: string | null;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}

export async function loginWithCredentials(email: string, password: string): Promise<TokenResponse> {
  const { data } = await axios.post<TokenResponse>(`${API_URL}/api/mobile/auth/credentials`, {
    email,
    password,
  });
  return data;
}

export async function loginWithGoogleIdToken(idToken: string): Promise<TokenResponse> {
  const { data } = await axios.post<TokenResponse>(`${API_URL}/api/mobile/auth/google`, { idToken });
  return data;
}

export async function register(name: string, email: string, password: string): Promise<void> {
  await axios.post(`${API_URL}/api/register`, { name, email, password });
}

export async function logout(refreshToken: string): Promise<void> {
  await axios.post(`${API_URL}/api/mobile/auth/logout`, { refreshToken }).catch(() => {});
}

export async function fetchMe(): Promise<AuthUser | null> {
  const { data } = await client.get<AuthUser | null>('/api/mobile/auth/me');
  return data;
}
