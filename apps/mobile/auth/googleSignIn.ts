import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';

let configured = false;

/**
 * webClientId is what actually matters for the backend: the ID token's `aud`
 * claim is scoped to it regardless of platform, since that's the client the
 * backend (see apps/web/src/app/api/mobile/auth/google/route.ts) verifies
 * against — it should be the SAME OAuth client as AUTH_GOOGLE_ID on the web
 * app, so a Google sign-in resolves to the same account either way.
 * iosClientId only drives the native iOS handshake itself.
 */
function configure(): void {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
  configured = true;
}

/** Returns the Google ID token to hand to /api/mobile/auth/google, or null if the user cancelled. */
export async function signInWithGoogle(): Promise<string | null> {
  configure();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) return null;
  return response.data.idToken;
}

export async function signOutGoogle(): Promise<void> {
  await GoogleSignin.signOut();
}
