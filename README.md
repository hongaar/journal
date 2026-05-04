# Curolia

Travel / place journal: private **traces** (visits) per **journal**, with maps, tags, photos, and connector stubs. Stack: **npm workspaces**, **Turborepo**, **Vite + React + TypeScript**, **shadcn/ui**, **Supabase** (Auth, Postgres, Storage), **MapLibre**.

## Monorepo

- `apps/web` — SPA (`name: web` for `turbo --filter=web`)
- `supabase/migrations` — schema, RLS, storage policies, auth bootstrap trigger
- `packages/connector-contract` — shared connector manifest / contribution types (`@curolia/connector-contract`)
- `packages/connectors/*` — optional connector packages (e.g. `@curolia/connector-ical`); Edge sources sync into `supabase/functions/` via `npm run functions:sync`

See [`AGENTS.md`](AGENTS.md) for codegen rules (including **never hand-editing** `database.types.ts`).

Common commands (from repo root):

```bash
npm ci
npm run dev          # turbo run dev → Vite dev server
npx turbo run build --filter=web
npx turbo run lint typecheck test build
```

## Supabase (local, recommended for now)

Prerequisites: [Docker](https://docs.docker.com/get-docker/) (or another engine the [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) can use).

From the repo root:

```bash
npm install
npm run db:start          # first run pulls images; can take a few minutes
npm run db:reset          # optional: wipe local DB and re-apply all migrations
npm run db:status         # shows API URL, anon key, Studio URL, etc.
```

Point the web app at the local API (defaults are stable):

1. Create `apps/web/.env` (see [`apps/web/.env.example`](apps/web/.env.example)).
2. Set `VITE_SUPABASE_URL` to the **API URL** from `npm run db:status` (usually `http://127.0.0.1:54321`).
3. Set `VITE_SUPABASE_PUBLISHABLE_KEY` to the **anon key** from `npm run db:status`.

Then run `npm run dev` and open the app. [Studio](http://127.0.0.1:54323) lists tables and auth users. [Mailpit](http://127.0.0.1:54324) catches auth emails if you turn confirmations back on.

Stop the stack when finished: `npm run db:stop`.

**Edge Functions (local):** after `npm run db:start`, run `npm run functions:sync` when you change code under `packages/connectors/*/supabase/functions/`, then `npm run functions:start` in another terminal to serve all functions (e.g. iCal at `/functions/v1/ical-feed`). `npm run functions:stop` sends `pkill` to the `supabase functions serve` process (Linux/macOS); you can also stop with Ctrl+C in that terminal.

On first signup, a **profile**, personal **journal**, and **owner** membership are created automatically (via the migration trigger).

### Hosted Supabase later

Use `supabase link` against your cloud project, then `supabase db push` for migrations. Copy that project’s URL and anon/publishable key into `apps/web/.env` for deployed or hybrid setups.

## Deploy (Vercel)

- **Root directory**: repository root (default).
- **Install**: `npm ci`
- **Build**: `npx turbo run build --filter=web`
- **Output**: `apps/web/dist`

`vercel.json` in this repo matches the above. Set the same Supabase env vars for Production (and Preview): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.

### Production: Supabase (GitHub Actions) + web (Vercel Git)

Connect the repo to Vercel so **pushes to `main` build production** via Vercel’s native GitHub integration (same `vercel.json` install/build/output as above).

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) also runs, after CI: **`npm run functions:sync`** (copies connector packages’ `supabase/functions/*` into the repo-root functions tree), **`supabase db push`**, and **`supabase functions deploy --use-api`** for every function. Run `functions:sync` here so deployed Edge code always matches `packages/connectors/*`, not only whatever was last committed under `supabase/functions/`.

That job and Vercel both start on the same push; they can finish in either order. Prefer backward-compatible migrations and function APIs when the app might go live before this job completes.

GitHub [secrets](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions) for the `production` environment (or repository): `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`. The database password is the Supabase project **Database** password (Settings → Database).

## Roadmap (not in this repo yet)

- **Mobile app** — e.g. Expo consuming the same Supabase project.
- **Public HTTP API** — service role + API keys behind a small Node layer or Edge Functions when you need non-Supabase clients.
