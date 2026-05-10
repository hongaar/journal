import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const PHOTOSPICKER_SESSIONS = "https://photospicker.googleapis.com/v1/sessions";
const PHOTOSPICKER_MEDIA_ITEMS =
  "https://photospicker.googleapis.com/v1/mediaItems";

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

/** Decode Postgres `bytea` as returned over PostgREST / supabase-js (hex, base64, or binary). */
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

/**
 * PostgREST serializes `Uint8Array` in JSON as `{"0":n,...}`, which does not
 * round-trip as Postgres `bytea`. Send hex text (`\\x...`) instead.
 */
function byteaInsertValue(buf: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < buf.length; i++) {
    hex += buf[i]!.toString(16).padStart(2, "0");
  }
  return "\\x" + hex;
}

type TraceRow = {
  id: string;
  journal_id: string;
  date: string | null;
  end_date: string | null;
  lat: number;
  lng: number;
};

type PickerMediaItem = {
  id: string;
  createTime?: string;
  type?: string;
  mediaFile?: {
    baseUrl: string;
    mimeType?: string;
    filename?: string;
  };
};

type Body =
  | {
      action: "import";
      traceId: string;
      mediaItemIds: string[];
      pickerSessionId: string;
    }
  | { action: "picker_create"; traceId?: string }
  | { action: "picker_session"; sessionId: string }
  | { action: "picker_list"; sessionId: string }
  | {
      action: "picker_thumbnails";
      sessionId: string;
      mediaItemIds: string[];
    };

type GoogleTokenResult =
  | { ok: true; accessToken: string }
  | {
      ok: false;
      reason: "not_linked" | "decrypt_failed" | "refresh_failed";
    };

async function getGoogleAccessToken(
  admin: ReturnType<typeof createClient>,
  userId: string,
  googleClientId: string,
  googleClientSecret: string,
): Promise<GoogleTokenResult> {
  const { data: row, error } = await admin
    .from("user_plugin_oauth_tokens")
    .select(
      "refresh_token_ciphertext, access_token_ciphertext, access_token_expires_at",
    )
    .eq("user_id", userId)
    .eq("plugin_type_id", "google_photos")
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
    client_id: googleClientId,
    client_secret: googleClientSecret,
    refresh_token: refreshPlain,
    grant_type: "refresh_token",
  });

  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tok = (await res.json()) as Record<string, unknown>;
  if (!res.ok || typeof tok.access_token !== "string") {
    console.error("refresh failed", tok);
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

  await admin
    .from("user_plugin_oauth_tokens")
    .update({
      access_token_ciphertext: byteaInsertValue(accessCt),
      access_token_expires_at: accessExpires,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("plugin_type_id", "google_photos");

  return { ok: true, accessToken: tok.access_token as string };
}

async function traceContextForUser(
  admin: ReturnType<typeof createClient>,
  userId: string,
  traceId: string,
): Promise<
  | {
      trace: TraceRow;
      hint: {
        startDate: string;
        endDate: string;
        lat: number;
        lng: number;
      };
    }
  | { error: "trace_not_found" | "forbidden" }
> {
  const { data: trace, error: te } = await admin
    .from("traces")
    .select("id, journal_id, date, end_date, lat, lng")
    .eq("id", traceId)
    .maybeSingle();

  if (te || !trace) return { error: "trace_not_found" };

  const t = trace as TraceRow;
  const { data: mem } = await admin
    .from("journal_members")
    .select("user_id")
    .eq("journal_id", t.journal_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!mem) return { error: "forbidden" };

  const startDate = t.date ?? new Date().toISOString().slice(0, 10);
  const endDate = t.end_date ?? startDate;

  return {
    trace: t,
    hint: {
      startDate,
      endDate,
      lat: t.lat,
      lng: t.lng,
    },
  };
}

async function listPickerMediaPage(
  accessToken: string,
  sessionId: string,
  pageToken?: string,
): Promise<{ items: PickerMediaItem[]; nextPageToken?: string }> {
  const u = new URL(PHOTOSPICKER_MEDIA_ITEMS);
  u.searchParams.set("sessionId", sessionId);
  u.searchParams.set("pageSize", "100");
  if (pageToken) u.searchParams.set("pageToken", pageToken);
  const res = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json()) as {
    mediaItems?: PickerMediaItem[];
    nextPageToken?: string;
  };
  if (!res.ok) {
    console.error("picker mediaItems.list failed", json);
    throw new Error("picker_list_failed");
  }
  return {
    items: json.mediaItems ?? [],
    nextPageToken: json.nextPageToken,
  };
}

async function listAllPickerMedia(
  accessToken: string,
  sessionId: string,
): Promise<PickerMediaItem[]> {
  const out: PickerMediaItem[] = [];
  let pageToken: string | undefined;
  do {
    const { items, nextPageToken } = await listPickerMediaPage(
      accessToken,
      sessionId,
      pageToken,
    );
    out.push(...items);
    pageToken = nextPageToken;
  } while (pageToken);
  return out;
}

/** Google Photos Picker `baseUrl` requests require an OAuth bearer. */
async function fetchGooglePhotoBytes(
  accessToken: string,
  baseUrl: string,
  sizeParam: string,
): Promise<Uint8Array | null> {
  const imgRes = await fetch(`${baseUrl}${sizeParam}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!imgRes.ok) return null;
  return new Uint8Array(await imgRes.arrayBuffer());
}

async function thumbDataUrl(
  accessToken: string,
  baseUrl: string,
): Promise<string | undefined> {
  const buf = await fetchGooglePhotoBytes(accessToken, baseUrl, "=w320-h320-c");
  if (!buf) return undefined;
  let binary = "";
  for (let i = 0; i < buf.byteLength; i++)
    binary += String.fromCharCode(buf[i]!);
  const b64 = btoa(binary);
  return `data:image/jpeg;base64,${b64}`;
}

async function deletePickerSession(
  accessToken: string,
  sessionId: string,
): Promise<void> {
  await fetch(`${PHOTOSPICKER_SESSIONS}/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
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
  const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
  const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";

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

  const admin = createClient(supabaseUrl, serviceKey);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response(JSON.stringify({ error: "bad_json" }), {
      status: 400,
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  }

  const gt = await getGoogleAccessToken(
    admin,
    userId,
    googleClientId,
    googleClientSecret,
  );
  if (!gt.ok) {
    if (gt.reason === "decrypt_failed") {
      return new Response(
        JSON.stringify({
          error: "oauth_decrypt_failed",
          message:
            "Stored tokens could not be decrypted. Use the same PLUGIN_OAUTH_ENCRYPTION_KEY in every Edge env as when you linked, or unlink Google Photos under Settings → Plugins and link again.",
        }),
        {
          status: 503,
          headers: { ...cors(), "Content-Type": "application/json" },
        },
      );
    }
    if (gt.reason === "refresh_failed") {
      return new Response(
        JSON.stringify({
          error: "google_refresh_failed",
          message:
            "Google rejected the refresh token. Unlink and link Google Photos again.",
        }),
        {
          status: 502,
          headers: { ...cors(), "Content-Type": "application/json" },
        },
      );
    }
    return new Response(
      JSON.stringify({ error: "google_not_linked", suggestions: [] }),
      {
        status: 200,
        headers: { ...cors(), "Content-Type": "application/json" },
      },
    );
  }
  const accessToken = gt.accessToken;

  if (body.action === "picker_create") {
    let pickerHint: {
      startDate: string;
      endDate: string;
      lat: number;
      lng: number;
    } | null = null;

    if (body.traceId) {
      const ctx = await traceContextForUser(admin, userId, body.traceId);
      if ("error" in ctx) {
        const status = ctx.error === "trace_not_found" ? 404 : 403;
        return new Response(JSON.stringify({ error: ctx.error }), {
          status,
          headers: { ...cors(), "Content-Type": "application/json" },
        });
      }
      pickerHint = ctx.hint;
    }

    const res = await fetch(PHOTOSPICKER_SESSIONS, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const json = (await res.json()) as {
      id?: string;
      pickerUri?: string;
      expireTime?: string;
    };
    if (!res.ok || !json.id || !json.pickerUri) {
      console.error("picker sessions.create failed", json);
      return new Response(
        JSON.stringify({
          error: "picker_session_create_failed",
          details: json,
        }),
        {
          status: 502,
          headers: { ...cors(), "Content-Type": "application/json" },
        },
      );
    }
    return new Response(
      JSON.stringify({
        sessionId: json.id,
        pickerUri: json.pickerUri,
        expireTime: json.expireTime ?? null,
        pickerHint,
      }),
      {
        status: 200,
        headers: { ...cors(), "Content-Type": "application/json" },
      },
    );
  }

  if (body.action === "picker_session") {
    if (!body.sessionId) {
      return new Response(JSON.stringify({ error: "missing_session_id" }), {
        status: 400,
        headers: { ...cors(), "Content-Type": "application/json" },
      });
    }
    const res = await fetch(
      `${PHOTOSPICKER_SESSIONS}/${encodeURIComponent(body.sessionId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "picker_session_failed", details: json }),
        {
          status: 502,
          headers: { ...cors(), "Content-Type": "application/json" },
        },
      );
    }
    return new Response(JSON.stringify(json), {
      status: 200,
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  }

  if (body.action === "picker_list") {
    if (!body.sessionId) {
      return new Response(JSON.stringify({ error: "missing_session_id" }), {
        status: 400,
        headers: { ...cors(), "Content-Type": "application/json" },
      });
    }
    let items: PickerMediaItem[];
    try {
      items = await listAllPickerMedia(accessToken, body.sessionId);
    } catch {
      return new Response(
        JSON.stringify({
          error: "picker_list_failed",
          message:
            "Could not list picked items. Finish picking in Google Photos first, then try again.",
        }),
        {
          status: 502,
          headers: { ...cors(), "Content-Type": "application/json" },
        },
      );
    }

    const suggestions = items.map((m) => ({
      externalId: m.id,
      title: m.mediaFile?.filename ?? null,
      capturedAt: m.createTime ?? null,
      meta: {
        mimeType: m.mediaFile?.mimeType ?? null,
        picker: true,
        mediaType: m.type ?? null,
      },
    }));

    return new Response(JSON.stringify({ suggestions }), {
      status: 200,
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  }

  if (body.action === "picker_thumbnails") {
    if (!body.sessionId || !Array.isArray(body.mediaItemIds)) {
      return new Response(
        JSON.stringify({ error: "missing_session_or_media_ids" }),
        {
          status: 400,
          headers: { ...cors(), "Content-Type": "application/json" },
        },
      );
    }
    const ids = body.mediaItemIds
      .filter((x): x is string => typeof x === "string")
      .slice(0, 24);

    let items: PickerMediaItem[];
    try {
      items = await listAllPickerMedia(accessToken, body.sessionId);
    } catch {
      return new Response(
        JSON.stringify({
          error: "picker_thumbnails_failed",
          message:
            "Could not load picked items for thumbnails. Finish picking first.",
        }),
        {
          status: 502,
          headers: { ...cors(), "Content-Type": "application/json" },
        },
      );
    }

    const byId = new Map(items.map((i) => [i.id, i]));
    const thumbnails: Record<string, string> = {};
    for (const id of ids) {
      const m = byId.get(id);
      const base = m?.mediaFile?.baseUrl;
      if (!base || m?.type === "VIDEO") continue;
      const dataUrl = await thumbDataUrl(accessToken, base);
      if (dataUrl) thumbnails[id] = dataUrl;
    }

    return new Response(JSON.stringify({ thumbnails }), {
      status: 200,
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  }

  if (body.action === "import") {
    const { data: trace, error: te } = await admin
      .from("traces")
      .select("id, journal_id, date, end_date, lat, lng")
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

    const imported: string[] = [];
    let sort =
      (
        await admin
          .from("photos")
          .select("sort_order")
          .eq("trace_id", t.id)
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data?.sort_order ?? -1;

    const pickerSessionId = body.pickerSessionId;
    if (
      !pickerSessionId ||
      typeof pickerSessionId !== "string" ||
      !pickerSessionId.trim()
    ) {
      return new Response(
        JSON.stringify({
          error: "missing_picker_session",
          message:
            "Imports require an active Google Photos picker session. Pick photos again.",
        }),
        {
          status: 400,
          headers: { ...cors(), "Content-Type": "application/json" },
        },
      );
    }

    let pickerById: Map<string, PickerMediaItem>;
    try {
      const items = await listAllPickerMedia(accessToken, pickerSessionId);
      pickerById = new Map(items.map((i) => [i.id, i]));
    } catch (e) {
      console.error(e);
      return new Response(
        JSON.stringify({
          error: "picker_import_resolve_failed",
          message:
            "Could not load picked media from Google. Try picking again.",
        }),
        {
          status: 502,
          headers: { ...cors(), "Content-Type": "application/json" },
        },
      );
    }

    for (const mediaId of body.mediaItemIds) {
      let buf: Uint8Array | null = null;
      let mime = "image/jpeg";
      let ext = "jpg";
      let capturedAt: string | null = null;
      const external_ref: Record<string, unknown> = {
        kind: "google_photos",
        mediaItemId: mediaId,
        source: "picker",
      };

      const picked = pickerById.get(mediaId);
      const mf = picked?.mediaFile;
      if (!mf?.baseUrl) continue;
      capturedAt = picked?.createTime ?? null;

      const isVideo = picked?.type === "VIDEO";
      if (isVideo) {
        mime = mf.mimeType ?? "video/mp4";
        ext = mime.includes("quicktime") ? "mov" : "mp4";
        const vidRes = await fetch(`${mf.baseUrl}=dv`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!vidRes.ok) continue;
        buf = new Uint8Array(await vidRes.arrayBuffer());
      } else {
        mime = mf.mimeType ?? "image/jpeg";
        ext = mime.includes("png") ? "png" : "jpg";
        buf = await fetchGooglePhotoBytes(
          accessToken,
          mf.baseUrl,
          "=w1600-h1600",
        );
      }

      if (!buf) continue;

      const path = `${t.journal_id}/${t.id}/gp-${mediaId}.${ext}`;

      const { error: upErr } = await admin.storage
        .from("trace-photos")
        .upload(path, buf, {
          contentType: mime,
          upsert: false,
        });
      if (upErr) {
        console.error(upErr);
        continue;
      }

      sort += 1;

      const { data: ins, error: insErr } = await admin
        .from("photos")
        .insert({
          journal_id: t.journal_id,
          trace_id: t.id,
          storage_path: path,
          sort_order: sort,
          source_plugin_id: "google_photos",
          external_ref,
          captured_at: capturedAt ? new Date(capturedAt).toISOString() : null,
        })
        .select("id")
        .single();

      if (!insErr && ins?.id) imported.push(ins.id as string);
    }

    if (pickerSessionId) {
      await deletePickerSession(accessToken, pickerSessionId);
    }

    return new Response(JSON.stringify({ importedIds: imported }), {
      status: 200,
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "unknown_action" }), {
    status: 400,
    headers: { ...cors(), "Content-Type": "application/json" },
  });
});
