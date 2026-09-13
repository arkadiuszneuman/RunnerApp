import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  // Warn rather than throw: Next.js imports every API route module during
  // the build's "collect page data" step just to read its metadata, without
  // ever calling the handler — and lib/auth.ts's `DrizzleAdapter(db, ...)`
  // needs `db` to be a real, synchronously-constructed drizzle instance at
  // module-eval time (a lazy proxy standing in for it reads to Auth.js as
  // "Unsupported database type"). So this can't defer construction the way
  // most other missing-env-var checks can — throwing here would fail the
  // entire build whenever DATABASE_URL isn't present in the build
  // environment, not just requests that actually touch the database. A real
  // request hitting a route that uses `db` without DATABASE_URL configured
  // still fails clearly enough on its own (postgres.js errors on connect).
  console.warn(
    'DATABASE_URL is not set — database queries will fail. Copy apps/web/.env.local.example to apps/web/.env.local and fill it in.'
  );
}

// prepare: false is required for Neon's connection pooler (PgBouncer)
const client = postgres(connectionString!, { prepare: false });

export const db = drizzle(client, { schema });
