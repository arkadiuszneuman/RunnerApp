# RunnerApp

A Next.js 16 app that controls a Bluetooth treadmill in real time, with multi-user support, training program storage, and run history — backed by Vercel Postgres (Neon).

## Stack

- **Next.js 16** (App Router, Turbopack)
- **Auth.js v5** — Google OAuth + email/password credentials
- **Drizzle ORM** + **Vercel Postgres (Neon)** — serverless PostgreSQL
- **Jotai** — client-side state
- **MUI v6** — UI components

## Local Development

### 1. Start the database

```bash
docker compose up -d
```

This starts a Postgres 16 container on `localhost:5432` (db: `runnerapp`, user/pass: `runner`).

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in:

```
DATABASE_URL=postgresql://runner:runner@localhost:5432/runnerapp

AUTH_SECRET=<run: openssl rand -base64 32>
AUTH_TRUST_HOST=true
AUTH_GOOGLE_ID=<your Google OAuth client ID>       # optional — skip to use email/password only
AUTH_GOOGLE_SECRET=<your Google OAuth client secret>
```

To get Google OAuth credentials, create a project at [console.cloud.google.com](https://console.cloud.google.com), enable the Google+ API, and add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI.

### 3. Run migrations

```bash
pnpm db:migrate
```

### 4. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

| Command | Description |
|---|---|
| `pnpm dev` | Dev server (Turbopack, http://localhost:3000) |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit tests |
| `pnpm storybook` | Storybook (http://localhost:6006) |
| `pnpm db:generate` | Generate Drizzle migration from schema changes |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:studio` | Open Drizzle Studio (DB browser) |

## Deploy on Vercel

1. Push to GitHub and import the repo in [Vercel](https://vercel.com/new).
2. Add **Vercel Postgres** from the Storage tab — it auto-sets `POSTGRES_URL` in your project.
3. Add these environment variables in Vercel project settings:

```
AUTH_SECRET          # openssl rand -base64 32
AUTH_GOOGLE_ID       # Google OAuth client ID
AUTH_GOOGLE_SECRET   # Google OAuth client secret
NEXTAUTH_URL         # https://your-app.vercel.app
```

4. On first deploy, run `pnpm db:migrate` locally pointing at the Neon connection string, or trigger it via a one-off Vercel function.

> **Pricing**: Vercel Postgres (Neon) is free on the Hobby plan — 0.5 GB storage, 190 compute hours/month.
