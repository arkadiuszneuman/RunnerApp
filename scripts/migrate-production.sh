#!/bin/sh
# Applies pending Drizzle migrations (root drizzle/ folder, via apps/web/scripts/migrate-production.mjs)
# as part of a Vercel *production* build —
# wired in as apps/web's "vercel-build" script, which Vercel runs instead of "build". The database
# credentials are "sensitive" Vercel env vars, readable only inside Vercel, so this is the one place
# production migrations can run from without copying them anywhere.
#
# Preview builds skip it: they must never migrate a database that production is still using. A
# failed migration fails the build, so the previous deployment stays live.
set -e

if [ "$VERCEL_ENV" != "production" ]; then
  echo "Skipping database migrations (VERCEL_ENV=${VERCEL_ENV:-unset})"
  exit 0
fi

cd "$(dirname "$0")/.."
# DDL goes over a direct connection, not Neon's pooler, when one is configured.
DATABASE_URL="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}" node apps/web/scripts/migrate-production.mjs
