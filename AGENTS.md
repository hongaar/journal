# Agent notes (Curolia monorepo)

## Monorepo scripts (root `package.json`)

- The **root** `package.json` should only expose **`turbo run …`** for build/lint/typecheck/test/dev (plus **`prettier`** **`format`** / **`format:check`**, since Prettier is a direct root devDependency). Do **not** add thin wrappers that chain **`npm run -w`** or other workspaces from root (e.g. avoid **`codegen && turbo build`**).
- **CI/CD** and **developers** orchestrate codegen and checks via **Turbo** (e.g. `npx turbo run codegen lint typecheck test build`). Prefer Turbo **`codegen`**: **`@curolia/brand`** (`generate:web`) then **`@curolia/web`** (`plugins:sync`), wired with **`dependsOn`** in **`apps/web/turbo.json`**. Do **not** add root **`package.json`** chains of **`npm run -w …`**. Underlying scripts stay on each workspace **`package.json`**; each participating package exposes a **`codegen`** script for Turbo.
- **Per-package `turbo.json`**: use **`"extends": false`** on inherited task names (**`dev`**, **`codegen`**, **`lint`**, **`build`**, …) when that package has **no** matching **`package.json`** script, so Turborepo does not schedule empty tasks. For example, only **`@curolia/web`** defines **`lint`**, **`test`**, and **`build`**.

## Database TypeScript types

- **Do not hand-edit** `apps/web/src/lib/database.types.ts`. It is generated from the Supabase schema. Do **not** paste or invent table definitions here to “fix” TypeScript when codegen has not run yet—doing so drifts from the real DB, duplicates partial edits (other tables/columns change too), and violates this repo’s single source of truth.
- After adding or changing migrations, apply them to the **local** database, then regenerate types. Prefer migrating without wiping data:

  ```bash
  npm run db:migrate -w @curolia/supabase
  npm run db:types -w @curolia/supabase
  ```

  (`db:types` runs `supabase gen types typescript --local > apps/web/src/lib/database.types.ts` from the `@curolia/supabase` package and requires local Supabase to be running with migrations applied.)

- Use `npm run db:reset -w @curolia/supabase` only when you intentionally want a full local reset, not as the default after routine schema changes.

## Plugin packages

- Implementations live under **`packages/plugins/<plugin-id>/`** (e.g. `@curolia/plugin-ical`). The root `package.json` **workspaces** list must include **`packages/plugins/*`** so nested plugin packages participate in the monorepo install.
- Inter-package deps use **`file:`** specifiers (e.g. `@curolia/web` → `packages/plugin-contract`) so installs work on npm versions that do not support the `workspace:` protocol.
- Shared **manifest / contribution types** live in **`@curolia/plugin-contract`** (`packages/plugin-contract`). Use that for declaring global settings, per-journal settings, app hooks, and Edge Function metadata.
- **`@curolia/brand`** and **plugin registry** (`apps/web/scripts/generate-plugin-registry.mjs`, **`npm run plugins:sync -w @curolia/web`**) must not run from **`apps/web` lifecycle hooks**. Run them via Turbo **`codegen`** (or the two workspace commands directly) before builds/typechecks in **CI**, before **`vercel build`** in the deploy workflow, or locally—never from chained root **`package.json`** scripts.

- **Supabase Edge Functions** for a plugin live under `packages/plugins/<id>/supabase/functions/<slug>/`. After changing plugin-owned function sources, copy them into the Supabase CLI project with:

  ```bash
  npm run functions:sync -w @curolia/supabase
  ```

  before `npm run functions:start -w @curolia/supabase` / remote `supabase functions deploy`.

- **Web UI** may stay in `apps/web` initially; packages should still export **manifest + config parsers** so behavior and declarations stay with the plugin. Prefer moving React panels into the plugin package when they stabilize (with `react` as a `peerDependency`).
