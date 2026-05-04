# Agent notes (Curolia monorepo)

## Database TypeScript types

- **Do not hand-edit** `apps/web/src/lib/database.types.ts`. It is generated from the Supabase schema. Do **not** paste or invent table definitions here to “fix” TypeScript when codegen has not run yet—doing so drifts from the real DB, duplicates partial edits (other tables/columns change too), and violates this repo’s single source of truth.
- After adding or changing migrations, apply them to the **local** database, then regenerate types. Prefer migrating without wiping data:

  ```bash
  npx supabase migration up --local
  npm run db:types
  ```

  (`npm run db:types` runs `supabase gen types typescript --local > apps/web/src/lib/database.types.ts` and requires local Supabase to be running with migrations applied.)
- Use `npm run db:reset` only when you intentionally want a full local reset, not as the default after routine schema changes.

## Connector packages

- Implementations live under **`packages/connectors/<connector-id>/`** (e.g. `@curolia/connector-ical`). The root `package.json` **workspaces** list must include **`packages/connectors/*`** so nested connector packages participate in the monorepo install.
- Inter-package deps use **`file:`** specifiers (e.g. `web` → `packages/connector-contract`) so installs work on npm versions that do not support the `workspace:` protocol.
- Shared **manifest / contribution types** live in **`@curolia/connector-contract`** (`packages/connector-contract`). Use that for declaring global settings, per-journal settings, future app hooks, and Edge Function metadata.
- **Supabase Edge Functions** for a connector live under `packages/connectors/<id>/supabase/functions/<slug>/`. The Supabase CLI only loads `supabase/functions/` at the repo root, so after changing connector-owned functions run:

  ```bash
  npm run functions:sync
  ```

  before `npm run functions:start` / `supabase functions deploy`.

- **Web UI** may stay in `apps/web` initially; packages should still export **manifest + config parsers** so behavior and declarations stay with the connector. Prefer moving React panels into the connector package when they stabilize (with `react` as a `peerDependency`).
