import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/** Keep in sync with `packages/plugins/spotify/src/constants.ts`. */
const TOP_TRACKS_LIMIT = 3;
const RECENT_PAGE_LIMIT = 50;
const MAX_RECENT_PAGES = 12;

const SPOTIFY_TOKEN = "https://accounts.spotify.com/api/token";
const SPOTIFY_RECENT = "https://api.spotify.com/v1/me/player/recently-played";

function cors(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

function getEncryptionKey(): Uint8Array {
  let b64 = (Deno.env.get("PLUGIN_OAUTH_ENCRYPTION_KEY") ?? "").trim();
  if (!b64) throw new Error("PLUGIN_OAUTH_ENCRYPTION_KEY is not set");
  b64 = b64.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad) b64 += "=".repeat(4 - pad);
  let bin: Uint8Array;
  try {
    bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  } catch {
    throw new Error("PLUGIN_OAUTH_ENCRYPTION_KEY is not valid base64");
  }
  if (bin.length !== 32) {
    throw new Error(
      `PLUGIN_OAUTH_ENCRYPTION_KEY must decode to 32 bytes (got ${bin.length}); use: openssl rand -base64 32`,
    );
  }
  return bin;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function parseBytea(val: unknown): Uint8Array {
  if (val instanceof Uint8Array) return val;
  if (val instanceof ArrayBuffer) return new Uint8Array(val);
  if (Array.isArray(val) && val.every((x) => typeof x === "number")) {
    return new Uint8Array(val as number[]);
  }
  if (typeof val === "string") {
    const s = val.trim();
    if (s.startsWith("\\x")) {
      const hex = s.slice(2);
      if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
        return hexToBytes(hex);
      }
    }
    if (/^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0 && s.length >= 2) {
      return hexToBytes(s);
    }
    try {
      let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
      const p = b64.length % 4;
      if (p) b64 += "=".repeat(4 - p);
      const bin = atob(b64);
      return Uint8Array.from(bin, (c) => c.charCodeAt(0));
    } catch {
      /* fall through */
    }
  }
  console.error("parseBytea: unsupported shape", typeof val);
  throw new Error("unsupported bytea format");
}

async function decryptSecret(ct: Uint8Array): Promise<string> {
  const keyRaw = getEncryptionKey();
  const iv = ct.slice(0, 12);
  const data = ct.slice(12);
  const key = await importAesKey(keyRaw);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(pt);
}

function byteaInsertValue(buf: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < buf.length; i++) {
    hex += buf[i]!.toString(16).padStart(2, "0");
  }
  return "\\x" + hex;
}

async function encryptRefreshPlain(plaintext: string): Promise<Uint8Array> {
  const keyRaw = getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importAesKey(keyRaw);
  const enc = new TextEncoder().encode(plaintext);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc),
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return out;
}

type SpotifyTokenResult =
  | { ok: true; accessToken: string }
  | {
      ok: false;
      reason: "not_linked" | "decrypt_failed" | "refresh_failed";
    };

async function getSpotifyAccessToken(
  admin: ReturnType<typeof createClient>,
  userId: string,
  spotifyClientId: string,
  spotifyClientSecret: string,
): Promise<SpotifyTokenResult> {
  const { data: row, error } = await admin
    .from("user_plugin_oauth_tokens")
    .select(
      "refresh_token_ciphertext, access_token_ciphertext, access_token_expires_at",
    )
    .eq("user_id", userId)
    .eq("plugin_type_id", "spotify")
    .maybeSingle();

  if (error || !row) return { ok: false, reason: "not_linked" };

  const r = row as {
    refresh_token_ciphertext: unknown;
    access_token_ciphertext: unknown | null;
    access_token_expires_at: string | null;
  };

  let refreshBuf: Uint8Array;
  try {
    refreshBuf = parseBytea(r.refresh_token_ciphertext);
  } catch (e) {
    console.error("refresh_token bytea parse failed", e);
    return { ok: false, reason: "decrypt_failed" };
  }

  let refreshPlain: string;
  try {
    refreshPlain = await decryptSecret(refreshBuf);
  } catch (e) {
    console.error("refresh_token decrypt failed", e);
    return { ok: false, reason: "decrypt_failed" };
  }

  const exp = r.access_token_expires_at
    ? new Date(r.access_token_expires_at)
    : null;
  if (exp && exp > new Date(Date.now() + 60_000) && r.access_token_ciphertext) {
    try {
      const at = await decryptSecret(parseBytea(r.access_token_ciphertext));
      return { ok: true, accessToken: at };
    } catch {
      /* fall through to refresh */
    }
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshPlain,
    client_id: spotifyClientId,
  });
  if (spotifyClientSecret.trim()) {
    body.set("client_secret", spotifyClientSecret);
  }

  const res = await fetch(SPOTIFY_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tok = (await res.json()) as Record<string, unknown>;
  if (!res.ok || typeof tok.access_token !== "string") {
    console.error("spotify refresh failed", tok);
    return { ok: false, reason: "refresh_failed" };
  }

  const expiresIn = Number(tok.expires_in ?? 3600);
  const accessExpires = new Date(Date.now() + expiresIn * 1000).toISOString();

  const keyRaw = getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importAesKey(keyRaw);
  const encAt = new TextEncoder().encode(tok.access_token as string);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encAt),
  );
  const accessCt = new Uint8Array(iv.length + ct.length);
  accessCt.set(iv, 0);
  accessCt.set(ct, iv.length);

  const updatePayload: Record<string, unknown> = {
    access_token_ciphertext: byteaInsertValue(accessCt),
    access_token_expires_at: accessExpires,
    updated_at: new Date().toISOString(),
  };

  const newRt = tok.refresh_token;
  if (typeof newRt === "string" && newRt.trim()) {
    const rtBuf = await encryptRefreshPlain(newRt);
    updatePayload.refresh_token_ciphertext = byteaInsertValue(rtBuf);
  }

  await admin
    .from("user_plugin_oauth_tokens")
    .update(updatePayload)
    .eq("user_id", userId)
    .eq("plugin_type_id", "spotify");

  return { ok: true, accessToken: tok.access_token as string };
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

type RecentItem = {
  played_at: string;
  track: {
    id: string;
    name: string;
    artists?: { name: string }[];
  } | null;
};

async function fetchRecentPage(
  accessToken: string,
  beforeMs: number,
): Promise<RecentItem[]> {
  const u = new URL(SPOTIFY_RECENT);
  u.searchParams.set("limit", String(RECENT_PAGE_LIMIT));
  u.searchParams.set("before", String(beforeMs));
  const res = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json()) as { items?: RecentItem[]; error?: unknown };
  if (!res.ok) {
    console.error("spotify recently-played failed", json);
    throw new Error("spotify_recent_failed");
  }
  return json.items ?? [];
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
  const spotifyClientId = Deno.env.get("SPOTIFY_CLIENT_ID") ?? "";
  const spotifyClientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET") ?? "";

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

  const admin = createClient(supabaseUrl, serviceKey);

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
    return new Response(
      JSON.stringify({
        added: 0,
        skippedExisting: 0,
        scannedPages: 0,
        playsInRange: 0,
        limitedByPagination: false,
        skippedReason: "no_trace_date",
      }),
      {
        status: 200,
        headers: { ...cors(), "Content-Type": "application/json" },
      },
    );
  }

  const { startMs, endMs } = bounds;

  if (!spotifyClientId) {
    return new Response(
      JSON.stringify({ error: "SPOTIFY_CLIENT_ID not configured" }),
      {
        status: 500,
        headers: { ...cors(), "Content-Type": "application/json" },
      },
    );
  }

  const tok = await getSpotifyAccessToken(
    admin,
    userId,
    spotifyClientId,
    spotifyClientSecret,
  );
  if (!tok.ok) {
    const status = tok.reason === "not_linked" ? 401 : 503;
    return new Response(
      JSON.stringify({
        error: "spotify_oauth_unavailable",
        reason: tok.reason,
      }),
      {
        status,
        headers: { ...cors(), "Content-Type": "application/json" },
      },
    );
  }

  const counts = new Map<string, { title: string; n: number }>();

  let beforeCursor = endMs;
  let scannedPages = 0;
  let playsInRange = 0;

  while (scannedPages < MAX_RECENT_PAGES) {
    let items: RecentItem[];
    try {
      items = await fetchRecentPage(tok.accessToken, beforeCursor);
    } catch {
      return new Response(JSON.stringify({ error: "spotify_api_failed" }), {
        status: 502,
        headers: { ...cors(), "Content-Type": "application/json" },
      });
    }

    scannedPages += 1;

    if (items.length === 0) break;

    for (const it of items) {
      const played = Date.parse(it.played_at);
      if (played > endMs) continue;
      if (played < startMs) continue;
      const tr = it.track;
      const tid = tr?.id;
      if (!tid || !tr?.name) continue;
      playsInRange += 1;
      const artists =
        tr.artists
          ?.map((a) => a.name)
          .filter(Boolean)
          .join(", ") ?? "";
      const title = artists ? `${tr.name} — ${artists}` : tr.name;
      const prev = counts.get(tid);
      if (prev) prev.n += 1;
      else counts.set(tid, { title, n: 1 });
    }

    const oldest = items[items.length - 1];
    const oldestPlayed = Date.parse(oldest.played_at);

    if (oldestPlayed < startMs) break;

    if (items.length < RECENT_PAGE_LIMIT) break;

    beforeCursor = oldestPlayed - 1;
    if (beforeCursor < startMs) break;
  }

  const limitedByPagination = scannedPages >= MAX_RECENT_PAGES;

  const ranked = [...counts.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, TOP_TRACKS_LIMIT);

  const { data: existingRows } = await admin
    .from("trace_links")
    .select("url")
    .eq("trace_id", t.id);

  const existing = new Set((existingRows ?? []).map((r) => r.url as string));

  const { data: sortRow } = await admin
    .from("trace_links")
    .select("sort_order")
    .eq("trace_id", t.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  let sortOrder =
    typeof sortRow?.sort_order === "number" ? sortRow.sort_order : -1;

  let added = 0;
  let skippedExisting = 0;

  for (const [trackId, { title }] of ranked) {
    const url = `https://open.spotify.com/track/${trackId}`;
    if (existing.has(url)) {
      skippedExisting += 1;
      continue;
    }
    sortOrder += 1;
    const { error: insErr } = await admin.from("trace_links").insert({
      trace_id: t.id,
      url,
      title,
      favicon_url: "https://open.spotify.com/favicon.ico",
      sort_order: sortOrder,
    });
    if (!insErr) {
      added += 1;
      existing.add(url);
    }
  }

  return new Response(
    JSON.stringify({
      added,
      skippedExisting,
      scannedPages,
      playsInRange,
      limitedByPagination,
    }),
    {
      status: 200,
      headers: { ...cors(), "Content-Type": "application/json" },
    },
  );
});
