// Applies pending Drizzle migrations (root drizzle/ folder) during a Vercel production build — run
// by scripts/migrate-production.sh. Uses drizzle-orm's migrator directly rather than drizzle-kit
// so a failure prints the actual database error, and so a schema that predates the migration
// journal can be adopted (below) instead of being re-created.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../drizzle'
);
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
const migrations = readMigrationFiles({ migrationsFolder });
try {
  const tables = new Set(
    (await sql`select table_name from information_schema.tables where table_schema = 'public'`).map(
      (r) => r.table_name
    )
  );
  const journal =
    (await sql`select to_regclass('drizzle.__drizzle_migrations') as t`)[0].t !== null;
  const applied = journal
    ? await sql`select hash, created_at from drizzle.__drizzle_migrations order by created_at`
    : [];
  console.log(
    `Migrations: ${migrations.length} in the repo, ${applied.length} recorded as applied` +
      `${journal ? '' : ' (no journal table)'}; tables: ${[...tables].sort().join(', ') || 'none'}`
  );

  // A schema created before migrations were tracked (e.g. with `drizzle-kit push`): record the
  // migrations whose effects are already there, so the migrator doesn't try to re-create them.
  // Each migration is identified by a table it leaves behind.
  if (applied.length === 0 && tables.has('run_history')) {
    const present = [
      tables.has('run_history'), // 0000
      tables.has('user_settings'), // 0001
      tables.has('user_settings'), // 0002 created mobile_refresh_tokens …
      tables.has('user_settings') && !tables.has('mobile_refresh_tokens'), // … 0003 dropped it
      tables.has('external_activities'), // 0004
      tables.has('user_integrations'), // 0005
    ];
    let upTo = -1;
    while (upTo + 1 < Math.min(present.length, migrations.length) && present[upTo + 1]) upTo++;
    if (upTo >= 0) {
      console.log(
        `Existing schema predates the journal: recording migrations 0–${upTo} as applied`
      );
      await sql`create schema if not exists drizzle`;
      await sql`create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)`;
      for (const m of migrations.slice(0, upTo + 1)) {
        await sql`insert into drizzle.__drizzle_migrations (hash, created_at) values (${m.hash}, ${m.folderMillis})`;
      }
    }
  }

  await migrate(drizzle(sql), { migrationsFolder });
  const after = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`;
  console.log(`Migrations up to date (${after[0].n} recorded)`);
} catch (error) {
  console.error('Migration failed:', error?.message ?? error);
  if (error?.cause) console.error('Cause:', error.cause.message ?? error.cause);
  process.exitCode = 1;
} finally {
  await sql.end();
}
