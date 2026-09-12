import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  // Fail fast with a clear message instead of letting `postgres(undefined!)`
  // below throw an opaque connection error on the first query.
  throw new Error(
    'DATABASE_URL is not set. Copy apps/web/.env.local.example to apps/web/.env.local and fill it in.'
  );
}

// prepare: false is required for Neon's connection pooler (PgBouncer)
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
