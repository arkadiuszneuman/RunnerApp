import { DrizzleAdapter } from '@auth/drizzle-adapter';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { db } from './db';
import { accounts, sessions, users, verificationTokens } from './db/schema';
import { isRateLimited, rateLimitKey } from './rateLimit';
import { verifyCredentials } from './verifyCredentials';

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Deliberately not hardcoded to true: trusting the incoming Host/
  // X-Forwarded-Host header is only safe behind a reverse proxy you control,
  // since it's otherwise used unauthenticated to build redirect/callback
  // URLs. Auth.js already derives this from the environment on its own
  // (AUTH_URL, AUTH_TRUST_HOST, or being on Vercel/Cloudflare Pages — see
  // @auth/core's env.ts) when left unset here, which matches the
  // AUTH_TRUST_HOST documented in apps/web/.env.local.example.
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: 'jwt' },
  providers: [
    Google,
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;
        if (isRateLimited(rateLimitKey(request, 'web-credentials'), { windowMs: 5 * 60_000, max: 10 })) {
          return null;
        }
        return verifyCredentials(credentials.email as string, credentials.password as string);
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
});
