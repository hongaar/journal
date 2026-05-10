import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/** Keep in sync with `packages/plugins/lastfm/src/constants.ts`. */
const TOP_TRACKS_LIMIT = 3;
const PAGE_LIMIT = 200;
const MAX_PAGES = 50;

const LFM_API = "https://ws.audioscrobbler.com/2.0/";

function cors(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

type TraceRow = {
  id: string;
  journal_id: string;
  date: string | null;
  end_date: string | null;
};

function periodBoundsMs(
  trace: TraceRow,
): { startMs: number; endMs: number } | null {
  const startDay = trace.date?.trim();
  if (!startDay) return null;
  const endDay = (trace.end_date?.trim() || startDay) as string;
  const startMs = Date.parse(`${startDay}T00:00:00.000Z`);
  const endMs = Date.parse(`${endDay}T23:59:59.999Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return null;
  }
  return { startMs, endMs };
}

function readLastfmUsernameFromConfig(config: unknown): string | null {
  if (!config || typeof config !== "object") return null;
  const lf = (config as { lastfm?: unknown }).lastfm;
  if (!lf || typeof lf !== "object") return null;
  const u = (lf as { username?: unknown }).username;
  if (typeof u !== "string") return null;
  const t = u.trim();
  return t.length ? t : null;
}

function artistText(artist: unknown): string {
  if (typeof artist === "string") return artist;
  if (artist && typeof artist === "object" && "#text" in artist) {
    const t = (artist as { "#text"?: unknown })["#text"];
    if (typeof t === "string") return t;
  }
  return "";
}

type LfmTrack = {
  name?: string;
  url?: string;
  artist?: unknown;
  date?: { uts?: string };
  "@attr"?: { nowplaying?: string };
};

function normalizeTrackList(
  raw: LfmTrack | LfmTrack[] | undefined,
): LfmTrack[] {
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

async function fetchRecentTracksPage(
  apiKey: string,
  user: string,
  fromSec: number,
  toSec: number,
  page: number,
): Promise<{
  tracks: LfmTrack[];
  totalPages: number;
  error?: { code: number; message: string };
}> {
  const u = new URL(LFM_API);
  u.searchParams.set("method", "user.getrecenttracks");
  u.searchParams.set("user", user);
  u.searchParams.set("api_key", apiKey);
  u.searchParams.set("from", String(fromSec));
  u.searchParams.set("to", String(toSec));
  u.searchParams.set("limit", String(PAGE_LIMIT));
  u.searchParams.set("page", String(page));
  u.searchParams.set("format", "json");

  const res = await fetch(u.toString());
  const json = (await res.json()) as Record<string, unknown>;

  if (typeof json.error === "number") {
    return {
      tracks: [],
      totalPages: 0,
      error: {
        code: json.error,
        message:
          typeof json.message === "string" ? json.message : "lastfm_error",
      },
    };
  }

  const rt = json.recenttracks as Record<string, unknown> | undefined;
  const rawTracks = rt?.track as LfmTrack | LfmTrack[] | undefined;
  const attr = rt?.["@attr"] as Record<string, string> | undefined;
  const totalPages = Math.max(1, parseInt(attr?.totalPages ?? "1", 10) || 1);

  return {
    tracks: normalizeTrackList(rawTracks),
    totalPages,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors() });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lastfmApiKey = (Deno.env.get("LASTFM_API_KEY") ?? "").trim();

  const authHeader = req.headers.get("Authorization");
  const jwt = authHeader?.replace(/^Bearer\s+/i, "") ?? "";
  if (!jwt) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: "invalid_session" }), {
      status: 401,
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  }
  const userId = userData.user.id;

  let body: { action?: string; traceId?: string };
  try {
    body = (await req.json()) as { action?: string; traceId?: string };
  } catch {
    return new Response(JSON.stringify({ error: "bad_json" }), {
      status: 400,
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  }

  if (body.action !== "sync_top_tracks" || !body.traceId) {
    return new Response(JSON.stringify({ error: "invalid_body" }), {
      status: 400,
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  }

  if (!lastfmApiKey) {
    return new Response(
      JSON.stringify({ error: "LASTFM_API_KEY not configured" }),
      {
        status: 500,
        headers: { ...cors(), "Content-Type": "application/json" },
      },
    );
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: upRow } = await admin
    .from("user_plugins")
    .select("enabled, config")
    .eq("user_id", userId)
    .eq("plugin_type_id", "lastfm")
    .maybeSingle();

  const lastfmUser =
    upRow?.enabled === true ? readLastfmUsernameFromConfig(upRow.config) : null;

  if (!lastfmUser) {
    return new Response(
      JSON.stringify({
        error: "lastfm_not_configured",
        reason: "missing_username",
      }),
      {
        status: 401,
        headers: { ...cors(), "Content-Type": "application/json" },
      },
    );
  }

  const { data: trace, error: te } = await admin
    .from("traces")
    .select("id, journal_id, date, end_date")
    .eq("id", body.traceId)
    .maybeSingle();

  if (te || !trace) {
    return new Response(JSON.stringify({ error: "trace_not_found" }), {
      status: 404,
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  }

  const t = trace as TraceRow;
  const { data: mem } = await admin
    .from("journal_members")
    .select("user_id")
    .eq("journal_id", t.journal_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!mem) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  }

  const bounds = periodBoundsMs(t);
  if (!bounds) {
    await admin
      .from("plugin_entity_data")
      .delete()
      .eq("entity_type", "trace")
      .eq("entity_id", t.id)
      .eq("plugin_type_id", "lastfm");

    return new Response(
      JSON.stringify({
        skippedReason: "no_trace_date",
        cleared: true,
      }),
      {
        status: 200,
        headers: { ...cors(), "Content-Type": "application/json" },
      },
    );
  }

  const { startMs, endMs } = bounds;
  const fromSec = Math.floor(startMs / 1000);
  const toSec = Math.floor(endMs / 1000);

  const counts = new Map<
    string,
    { title: string; openUrl: string; n: number }
  >();

  let page = 1;
  let scannedPages = 0;
  let playsInRange = 0;
  let apiTotalPages = 1;

  while (scannedPages < MAX_PAGES && page <= apiTotalPages) {
    let result: Awaited<ReturnType<typeof fetchRecentTracksPage>>;
    try {
      result = await fetchRecentTracksPage(
        lastfmApiKey,
        lastfmUser,
        fromSec,
        toSec,
        page,
      );
    } catch (e) {
      console.error("lastfm fetch failed", e);
      return new Response(JSON.stringify({ error: "lastfm_api_failed" }), {
        status: 502,
        headers: { ...cors(), "Content-Type": "application/json" },
      });
    }

    if (result.error) {
      return new Response(
        JSON.stringify({
          error: "lastfm_api_error",
          message: result.error.message,
          code: result.error.code,
        }),
        {
          status: 502,
          headers: { ...cors(), "Content-Type": "application/json" },
        },
      );
    }

    scannedPages += 1;
    apiTotalPages = result.totalPages;

    if (result.tracks.length === 0) break;

    for (const tr of result.tracks) {
      if (tr["@attr"]?.nowplaying === "true") continue;
      const uts = tr.date?.uts;
      if (!uts) continue;
      const playedSec = parseInt(uts, 10);
      if (!Number.isFinite(playedSec)) continue;
      const playedMs = playedSec * 1000;
      if (playedMs < startMs || playedMs > endMs) continue;

      const name = tr.name?.trim();
      const url = tr.url?.trim();
      if (!name || !url) continue;

      playsInRange += 1;
      const artist = artistText(tr.artist);
      const title = artist ? `${name} — ${artist}` : name;

      const prev = counts.get(url);
      if (prev) prev.n += 1;
      else counts.set(url, { title, openUrl: url, n: 1 });
    }

    if (result.tracks.length < PAGE_LIMIT) break;

    page += 1;
  }

  const limitedByPagination =
    scannedPages >= MAX_PAGES && scannedPages < apiTotalPages;

  const ranked = [...counts.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, TOP_TRACKS_LIMIT);

  const payload = {
    schemaVersion: 1 as const,
    periodStart: t.date,
    periodEnd: t.end_date ?? t.date,
    syncedAt: new Date().toISOString(),
    limitedByPagination,
    scannedPages,
    playsInRange,
    tracks: ranked.map(([trackId, row]) => ({
      trackId,
      title: row.title,
      openUrl: row.openUrl,
      playCount: row.n,
    })),
  };

  const { error: upsertErr } = await admin.from("plugin_entity_data").upsert(
    {
      journal_id: t.journal_id,
      entity_type: "trace",
      entity_id: t.id,
      plugin_type_id: "lastfm",
      data: payload as unknown as Record<string, unknown>,
    },
    { onConflict: "entity_type,entity_id,plugin_type_id" },
  );

  if (upsertErr) {
    console.error("plugin_entity_data upsert failed", upsertErr);
    return new Response(JSON.stringify({ error: "db_upsert_failed" }), {
      status: 500,
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      synced: true,
      payload,
    }),
    {
      status: 200,
      headers: { ...cors(), "Content-Type": "application/json" },
    },
  );
});
