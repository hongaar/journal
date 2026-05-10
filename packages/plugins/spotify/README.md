# Spotify plugin (`@curolia/plugin-spotify`)

Adds **top streamed tracks** (by replay count in your Spotify **recently played** history) that fall within each trace’s **date range** as **trace links**. Tokens use the shared **`plugin-oauth`** Edge Function (PKCE).

## Prerequisites

- **`SPOTIFY_CLIENT_ID`** in **`packages/supabase/supabase/functions/.env`** (local) or Supabase secrets (production).
- **`SPOTIFY_CLIENT_SECRET`** is optional: use it if your Spotify app is configured as a **confidential** client; the token exchange sends it when set.
- Same **`PLUGIN_OAUTH_ENCRYPTION_KEY`** as other plugin OAuth (see repo root README).

## Spotify Developer Dashboard

1. Create an app at [Spotify for Developers](https://developer.spotify.com/dashboard).
2. **Redirect URIs**: add your **`plugin-oauth`** callback **exactly** (same path as Google OAuth in this repo):
   - Local: `http://127.0.0.1:54321/functions/v1/plugin-oauth?action=callback` (adjust host/port if your Supabase API URL differs).
   - Production: `https://<project-ref>.supabase.co/functions/v1/plugin-oauth?action=callback`.
3. Required scope for this plugin is **`user-read-recently-played`** (declared in the plugin manifest; the OAuth registry is generated via `functions:sync`).

## App usage

1. **Settings → Plugins**: enable **Spotify**, then **Link Spotify**.
2. Edit a trace that has a **start date** (and optional end date). While the trace editor is open, the app syncs links automatically (subject to client/API limits documented in `src/constants.ts`).

## Behaviour notes

- Ranking uses **recently played** entries inside the trace window, **not** Spotify’s separate “top tracks” API (which uses fixed time ranges, not calendar dates).
- Long windows are capped: see **`SPOTIFY_RECENTLY_PLAYED_MAX_PAGES`** and related constants in **`src/constants.ts`** to avoid excessive Spotify pagination.
