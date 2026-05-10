# Google Photos plugin (`@curolia/plugin-google-photos`)

Imports photos into traces via the Google Photos Picker and stores OAuth tokens through the shared **`plugin-oauth`** Edge Function.

## Prerequisites

- Local or hosted Supabase with Edge Functions deployed.
- Same **`PLUGIN_OAUTH_ENCRYPTION_KEY`** everywhere functions read encrypted tokens (see repo root README → Plugin OAuth).
- **`GOOGLE_CLIENT_ID`** and **`GOOGLE_CLIENT_SECRET`** in **`packages/supabase/supabase/functions/.env`** (local) or Supabase secrets (production).

## Google Cloud Console

1. Enable **Google Photos Library API** (Picker uses Photos APIs).
2. OAuth consent screen + **Web application** credentials.
3. **Authorized redirect URIs** must include your **`plugin-oauth`** callback (exact match):
   - Local: `http://127.0.0.1:54321/functions/v1/plugin-oauth?action=callback` (or your API URL + `/functions/v1/plugin-oauth?action=callback`).
   - Production: `https://<project-ref>.supabase.co/functions/v1/plugin-oauth?action=callback`.

Scopes are declared in the plugin manifest and merged with companion OIDC scopes from **`@curolia/plugin-oauth`** (see `scopes-registry` codegen).

## App usage

1. **Settings → Plugins**: enable **Google Photos**, then **Link Google Photos** (OAuth).
2. Edit a trace → **Photos** → use **Select from Google Photos** (picker / import flow).

## Troubleshooting

- **`redirect_uri` shows `http://kong:8000/...`:** the Edge function rewrites internal Docker URLs for OAuth; set **`SUPABASE_PUBLIC_PORT`** or **`PLUGIN_OAUTH_CALLBACK_URL`** if your local API port differs (see root README).
