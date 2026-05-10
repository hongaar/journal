# Curolia

Travel / place journal: private **traces** (visits) per **journal**, with maps, tags, photos, and plugin stubs. Stack: **npm workspaces**, **Turborepo**, **Vite + React + TypeScript**, **shadcn/ui**, **Supabase** (Auth, Postgres, Storage), **MapLibre**.

## Monorepo

- `apps/web` — SPA package **`@curolia/web`** (`turbo --filter=@curolia/web`)
- `apps/mobile` — Capacitor host **`@curolia/mobile`** (`android/`, `ios/` live here)
- `packages/supabase/supabase/` — Supabase project (migrations, `config.toml`, `functions/`) via **`@curolia/supabase`**
- `packages/brand/` — app logo + theme config (**`@curolia/brand`**) and generators for web/native branding assets
- `packages/plugin-contract` — shared plugin manifest / contribution types (`@curolia/plugin-contract`)
- `packages/plugins/*` — optional plugin packages (e.g. `@curolia/plugin-ical`); Edge sources sync into `packages/supabase/supabase/functions/` via `npx turbo run functions:sync`. Structured plugin payloads attached to traces (and future entities) use **`public.plugin_entity_data`** (see migrations). Plugins that need OAuth or external dashboards document setup in **their own README** (e.g. [`packages/plugins/google-photos/README.md`](packages/plugins/google-photos/README.md), [`packages/plugins/spotify/README.md`](packages/plugins/spotify/README.md), [`packages/plugins/lastfm/README.md`](packages/plugins/lastfm/README.md)).

Plugin architecture details: [`packages/plugin-contract/README.md`](packages/plugin-contract/README.md).

See [`AGENTS.md`](AGENTS.md) for codegen rules (including **never hand-editing** `database.types.ts`).

Root scripts are Turborepo + Prettier only; see **`AGENTS.md` → Monorepo scripts**. The root **`turbo.json`** owns cross-package ordering: branding runs before the web plugin registry, web checks/builds depend on codegen, and mobile sync depends on the web build.

Common commands (from repo root):

```bash
npm ci
npm run dev         # Turbo dev: Supabase stack/functions, Vite, Storybook
npm run build       # turbo run build
npx turbo run lint typecheck test build   # CI shape; Turbo pulls required codegen
npx turbo run sync --filter=@curolia/mobile   # prepare native project; Turbo builds web and native assets first
npm run open:ios -w @curolia/mobile
npm run open:android -w @curolia/mobile
```

The production **Vercel** job runs **`npx turbo run codegen`** after install, then **`vercel build`** with **`apps/web/vercel.json`** **`buildCommand`**: **`npm run build`** (the **`@curolia/web`** Vite/TSC pipeline only).

## Hybrid Mobile (PWA + Capacitor)

- Web app ships as a PWA (installable + offline static shell caching).
- Native shells live under **`apps/mobile/ios`** and **`apps/mobile/android`** and reuse **`apps/web/dist`** (`capacitor.config.json` is next to those folders).
- From the repo root, let Turbo prepare mobile prerequisites:
  - `npx turbo run sync --filter=@curolia/mobile` — builds web, regenerates native icons/splash, and runs `cap sync`
  - `npm run open:ios -w @curolia/mobile`
  - `npm run open:android -w @curolia/mobile`

For iOS development, install Xcode + CocoaPods. For Android, install Android Studio SDK tools.

### Mobile CI/CD offload

Native builds are integrated into `.github/workflows/build-and-deploy.yml`:

- `android` job (Linux): `gradlew` under `apps/mobile/android`
- `ios` job (macOS): simulator `xcodebuild` under `apps/mobile/ios/App` (no signing)

Both jobs depend on the main `ci` job, then run **`npx turbo run sync --filter=@curolia/mobile`** so Turbo prepares native assets and builds the web output before Capacitor sync.

**GitHub Actions APK/IPA:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are injected per job (see workflow `ci`, `android`, `ios`). They must point at your **hosted** Supabase project (not `127.0.0.1`). Those jobs use **`environment: production`** so **GitHub environment secrets** work; a workflow-wide `env` block **cannot** read environment-only secrets. If the `production` environment limits which branches may deploy, pull-request runs might not see those secrets — use repository secrets for PR CI, relax the rule, or add a separate environment for builds.

## Supabase (local, recommended for now)

Prerequisites: [Docker](https://docs.docker.com/get-docker/) (or another engine the [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) can use).

From the repo root:

```bash
npm install
npm run db:start -w @curolia/supabase
npm run db:reset -w @curolia/supabase   # optional: wipe local DB and re-apply all migrations
npm run db:status -w @curolia/supabase
```

Point the web app at the local API (defaults are stable):

1. Create `apps/web/.env` (see [`apps/web/.env.example`](apps/web/.env.example)).
2. Set `VITE_SUPABASE_URL` to the **API URL** from `npm run db:status -w @curolia/supabase` (usually `http://127.0.0.1:54321`).
3. Set `VITE_SUPABASE_PUBLISHABLE_KEY` to the **anon key** from that same command.

Then run **`npm run dev`** from the **repo root** (Turbo runs **`@curolia/supabase#stack`** once: `supabase start` + **`functions:sync`**, then **`supabase functions serve`**, **Vite**, and **Storybook** (port 6006) in parallel after that). Open the web app URL from Vite's output. [Studio](http://127.0.0.1:54323) lists tables and auth users. [Mailpit](http://127.0.0.1:54324) catches auth emails if you turn confirmations back on.

Stopping: Ctrl+C stops the Turbo dev tasks; **`npm run db:stop -w @curolia/supabase`** stops Docker when you're done.

**Edge Functions:** **`npm run dev`** pulls plugin handlers in via **`stack`**. After changing files under **`packages/plugins/*/supabase/functions/`**, restart **`npm run dev`** (or run **`npx turbo run functions:sync`** and restart **`functions serve`** only).

### Push notifications (first mobile feature)

Push delivery is currently enabled for `journal_invitation` notifications when the recipient has push enabled in settings.

1. Ensure local Supabase and functions are running (`npm run dev` from repo root covers this):

```bash
npm run db:start -w @curolia/supabase
npx turbo run functions:sync
npm run functions:start -w @curolia/supabase
```

2. Set local function secrets for the dispatcher. The Supabase CLI has **no** `secrets set --local`; use an env file next to the functions instead:

   ```bash
   cp packages/supabase/supabase/functions/.env.example packages/supabase/supabase/functions/.env
   # Edit `.env`: set PUSH_DISPATCH_SECRET and FCM_SERVER_KEY
   ```

   Restart **`npm run functions:start -w @curolia/supabase`** (or your dev stack) after changing `packages/supabase/supabase/functions/.env`.

3. Apply migrations and regenerate DB types:

```bash
npm run db:migrate -w @curolia/supabase
npm run db:types -w @curolia/supabase
```

4. Build web, sync native shells, and run on device/emulator:

```bash
npx turbo run sync --filter=@curolia/mobile
npm run open:android -w @curolia/mobile
# or npm run open:ios -w @curolia/mobile on macOS
```

5. Trigger dispatch (example):

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/push-dispatch \
  -H "Authorization: Bearer <PUSH_DISPATCH_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"limit":50}'
```

Notes:

- Device tokens are stored in `public.push_tokens`.
- Pending deliveries are queued in `public.push_notification_outbox`.
- The web/native app registers tokens only on native platforms and only when `notification_push_enabled` is true.

### Plugin OAuth + Edge config (local)

Plugin OAuth is handled by the **`plugin-oauth`** Edge Function; encrypted tokens live in **`user_plugin_oauth_tokens`**. Provider client IDs/secrets and dashboard steps are **per plugin** — see:

- [Google Photos](packages/plugins/google-photos/README.md)
- [Spotify](packages/plugins/spotify/README.md)
- [Last.fm](packages/plugins/lastfm/README.md)

Common steps:

1. Run Supabase and functions (see above). After changing files under **`packages/plugins/*/supabase/functions/`**, run **`npx turbo run functions:sync`** and restart **`functions serve`** if needed.

2. **`apps/web/.env`**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (see [`apps/web/.env.example`](apps/web/.env.example)).

3. **`packages/supabase/supabase/functions/.env`**: copy from [`.env.example`](packages/supabase/supabase/functions/.env.example). Always set **`PLUGIN_OAUTH_ENCRYPTION_KEY`** (generate with `openssl rand -base64 32`) and **`PUBLIC_APP_ORIGIN`** (e.g. `http://127.0.0.1:5173`). Add provider vars for the plugins you use (**`GOOGLE_*`**, **`SPOTIFY_*`**, **`LASTFM_API_KEY`**). Restart **`npm run functions:start -w @curolia/supabase`** after edits.

4. **`redirect_uri` / Kong:** locally, Edge may see `SUPABASE_URL` as **`http://kong:8000`**. **`plugin-oauth`** maps that to **`http://127.0.0.1:54321`** for the OAuth callback when the hostname is `kong`. Override with **`SUPABASE_PUBLIC_PORT`** or **`PLUGIN_OAUTH_CALLBACK_URL`** if needed.

On first signup, a **profile**, personal **journal**, and **owner** membership are created automatically (via the migration trigger).

### Hosted Supabase later

Use `supabase link` against your cloud project, then `supabase db push` for migrations. Copy that project’s URL and anon/publishable key into `apps/web/.env` for deployed or hybrid setups.

## Deploy (Vercel)

Configure the Vercel project **Root Directory** to **`apps/web`** so it picks up [`apps/web/vercel.json`](apps/web/vercel.json).

That file installs from the repo root, runs **`npm run build`** inside **`apps/web`** (**`buildCommand`**). **`codegen`** is executed through Turbo in CI **before** `vercel build` so generated assets exist. **`outputDirectory`** is **`dist`** relative to **`apps/web`**.

Set the same Supabase env vars for Production (and Preview): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.

Link the CLI from `apps/web` (creates `apps/web/.vercel/`) if you deploy locally: `cd apps/web && npx vercel link`.

### Production: Supabase (GitHub Actions) + web (Vercel Git)

Production web deploy is orchestrated by GitHub Actions (`.github/workflows/build-and-deploy.yml`) from **`apps/web`** using the `vercel` npm scripts (`vercel pull` / `vercel build` / `vercel deploy --prebuilt`).
Vercel Git auto-deploy is disabled (`apps/web/vercel.json` → `git.deploymentEnabled: false`) so deployments happen only through the CI/CD workflow.

The [`.github/workflows/build-and-deploy.yml`](.github/workflows/build-and-deploy.yml) workflow also runs, after CI: **`npx turbo run functions:sync`** (copies plugin packages’ function sources into `packages/supabase/supabase/functions/`), then **`supabase db push`** and **`supabase functions deploy --use-api`** from `packages/supabase`. This keeps deployed Edge code aligned with `packages/plugins/*`, not only last-run sync output.

`supabase` deploy runs before the `vercel` job in CI/CD so database/functions are updated before the production web deployment.

GitHub [secrets](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions) for the `production` environment (or repository): `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`. The database password is the Supabase project **Database** password (Settings → Database).

### GitHub environment bootstrap (from scratch)

Create a GitHub Actions environment named `production` and add these secrets before running the full CI/CD pipeline:

- Supabase deploy:
  - `SUPABASE_ACCESS_TOKEN`
  - `SUPABASE_PROJECT_REF`
  - `SUPABASE_DB_PASSWORD`
- Vercel deploy:
  - `VERCEL_TOKEN`
  - `VERCEL_ORG_ID`
  - `VERCEL_PROJECT_ID`
- Frontend runtime/build env (mirrored from Vercel Production env):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`

Optional hardening:

- keep production secrets scoped to the `production` environment (not repo-wide)
- require manual approval for the `production` environment if you want a deploy gate

### Vercel-to-GitHub env sync (manual)

When env vars are already configured in Vercel UI, copy these frontend vars manually into the GitHub `production` environment secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

### Plugin OAuth + Edge config (production)

Put **OAuth and plugin secrets in the Supabase project** (Dashboard → Edge Functions secrets or `supabase secrets set`), not in Vercel. Browser/build vars stay **`VITE_SUPABASE_*`** only.

Generate **`PLUGIN_OAUTH_ENCRYPTION_KEY`** with `openssl rand -base64 32`. Include **`PUBLIC_APP_ORIGIN`** (your deployed web origin) plus whichever providers you enable, for example:

```bash
cd packages/supabase && npx supabase secrets set \
  PLUGIN_OAUTH_ENCRYPTION_KEY=<base64 32-byte key> \
  PUBLIC_APP_ORIGIN=https://<your-vercel-domain> \
  GOOGLE_CLIENT_ID=... \
  GOOGLE_CLIENT_SECRET=... \
  SPOTIFY_CLIENT_ID=...
# Optional: SPOTIFY_CLIENT_SECRET=...  — if your Spotify app uses a client secret
```

Provider-specific redirect URIs and dashboards: [Google Photos](packages/plugins/google-photos/README.md), [Spotify](packages/plugins/spotify/README.md), [Last.fm](packages/plugins/lastfm/README.md). The **`plugin-oauth`** callback path is always **`/functions/v1/plugin-oauth?action=callback`** on your Supabase API URL.

Production checklist:

1. In each provider’s developer console, register the Supabase callback URL `https://<project-ref>.supabase.co/functions/v1/plugin-oauth?action=callback` where required.
2. Vercel **Preview + Production**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. **`config.toml`**: `plugin-oauth` keeps **`verify_jwt = false`** (browser redirect has no JWT); other functions verify JWT in the handler if needed.
4. Deploy: GitHub workflow runs **`functions:sync`**, **`supabase db push`**, **`supabase functions deploy --use-api`**, then Vercel prebuilt deploy.

## Roadmap

- **Public HTTP API** — service role + API keys behind a small Node layer or Edge Functions when you need non-Supabase clients.
