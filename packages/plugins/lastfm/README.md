# Last.fm plugin (`@curolia/plugin-lastfm`)

Resolves **top scrobbled tracks** (by play count) within each trace’s **date range** using Last.fm’s **`user.getRecentTracks`** API, stores them in **`public.plugin_entity_data`**, and renders a **Last.fm** card on the **trace detail** page. Unlike Spotify’s Web API “recently played” feed, Last.fm is built around **full listening history** (scrobbles), so older trace periods can still show plays when they exist in your Last.fm profile.

## Prerequisites

- **`LASTFM_API_KEY`** in **`packages/supabase/supabase/functions/.env`** (local) or Supabase secrets (production). Create an API account at [Last.fm API](https://www.last.fm/api/account/create).

## Account linking

There is **no OAuth** in this plugin: users enter their **public Last.fm username** under **Settings → Plugins → Last.fm** and save. The Edge Function reads it from **`user_plugins.config.lastfm.username`**.

## App usage

1. Set **`LASTFM_API_KEY`** for Edge functions.
2. **Settings → Plugins**: enable **Last.fm**, enter your **Last.fm username**, and **Save**.
3. Open a **trace** with a **start date** (and optional end date). The trace detail page syncs when dates are set; changing dates invalidates the sync query key (**`lastfmTraceSyncQueryKey`** in **`src/query-keys.ts`**).

## Behaviour notes

- Uses **`user.getRecentTracks`** with **`from`** / **`to`** (Unix **seconds**, UTC), aligned with trace bounds (**UTC calendar days** from `YYYY-MM-DD`).
- Long windows are capped by **`LASTFM_MAX_PAGES`** × **`LASTFM_PAGE_LIMIT`** (see **`src/constants.ts`**).
- Payload shape for `plugin_entity_data.data` is **`LastfmTracePayload`** in **`src/lastfm-trace-data.ts`** (`schemaVersion: 1`).
