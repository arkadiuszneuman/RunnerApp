import { and, eq } from 'drizzle-orm';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { accounts, users } from '@/lib/db/schema';
import { issueTokenPair } from '@/lib/mobileAuth';
import { normalizeEmail } from '@/lib/normalizeEmail';

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/**
 * Native Google sign-in (iOS/Android) has no client secret and mints its own ID
 * token client-side via expo-auth-session; this endpoint verifies that token
 * once and mints our own token pair. AUTH_GOOGLE_ID is the existing web OAuth
 * client; GOOGLE_IOS_CLIENT_ID/GOOGLE_ANDROID_CLIENT_ID are the native clients
 * added once the mobile app is registered in Google Cloud Console (Phase 5).
 */
function allowedAudiences(): string[] {
  return [process.env.AUTH_GOOGLE_ID, process.env.GOOGLE_IOS_CLIENT_ID, process.env.GOOGLE_ANDROID_CLIENT_ID].filter(
    (value): value is string => !!value
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const idToken = body?.idToken as string | undefined;
  if (!idToken) return NextResponse.json({ error: 'idToken is required' }, { status: 400 });

  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: GOOGLE_ISSUERS,
      audience: allowedAudiences(),
    }));
  } catch {
    return NextResponse.json({ error: 'Invalid Google ID token' }, { status: 401 });
  }

  const sub = payload.sub;
  const rawEmail = payload.email as string | undefined;
  const email = rawEmail ? normalizeEmail(rawEmail) : undefined;
  const emailVerified = payload.email_verified === true;
  const name = (payload.name as string | undefined) ?? null;
  const image = (payload.picture as string | undefined) ?? null;
  if (!sub || !email) {
    return NextResponse.json({ error: 'Invalid Google ID token' }, { status: 401 });
  }

  // Link to the SAME user/account records Auth.js's DrizzleAdapter would use on
  // web, so signing in with Google works identically on both platforms.
  const existingAccount = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(and(eq(accounts.provider, 'google'), eq(accounts.providerAccountId, sub)))
    .limit(1)
    .then((r) => r[0]);

  let userId: string;
  if (existingAccount) {
    userId = existingAccount.userId;
  } else {
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
      .then((r) => r[0]);

    // Only auto-link to an existing account by email when Google has actually
    // verified that email — otherwise an attacker who controls an unverified
    // address at some IdP could take over an existing credentials account by
    // typing the victim's email into their own Google account. Checked (rather
    // than skipped) even when unverified so we fail loudly instead of hitting
    // the users.email unique constraint on insert below.
    if (existingUser && !emailVerified) {
      return NextResponse.json(
        { error: 'This email is already registered. Sign in with your existing method instead.' },
        { status: 409 }
      );
    }

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const [inserted] = await db.insert(users).values({ email, name, image }).returning({ id: users.id });
      userId = inserted.id;
    }

    await db.insert(accounts).values({
      userId,
      type: 'oidc',
      provider: 'google',
      providerAccountId: sub,
    });
  }

  const pair = await issueTokenPair(userId);
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1).then((r) => r[0]);

  return NextResponse.json({
    ...pair,
    user: { id: userId, name: user?.name ?? null, email: user?.email ?? null, image: user?.image ?? null },
  });
}
