import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const PHOTOS_SEARCH =
  "https://photoslibrary.googleapis.com/v1/mediaItems:search";

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
  const b64 = Deno.env.get("PLUGIN_OAUTH_ENCRYPTION_KEY") ?? "";
  if (!b64) throw new Error("PLUGIN_OAUTH_ENCRYPTION_KEY is not set");
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (bin.length !== 32)
    throw new Error("PLUGIN_OAUTH_ENCRYPTION_KEY must decode to 32 bytes");
  return bin;
}

function parseBytea(val: unknown): Uint8Array {
  if (val instanceof Uint8Array) return val;
  if (typeof val === "string") {
    const hex = val.startsWith("\\x") ? val.slice(2) : val.replace(/^\\x/, "");
    if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
      const out = new Uint8Array(hex.length / 2);
      for (let i = 0; i < out.length; i++)
        out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      return out;
    }
  }
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

type TraceRow = {
  id: string;
  journal_id: string;
  date: string | null;
  end_date: string | null;
  lat: number;
  lng: number;
};

type Body =
  | { action: "search"; traceId: string }
  | { action: "import"; traceId: string; mediaItemIds: string[] };

async function getGoogleAccessToken(
  admin: ReturnType<typeof createClient>,
  userId: string,
  googleClientId: string,
  googleClientSecret: string,
): Promise<string | null> {
  const { data: row, error } = await admin
    .from("user_plugin_oauth_tokens")
    .select(
      "refresh_token_ciphertext, access_token_ciphertext, access_token_expires_at",
    )
    .eq("user_id", userId)
    .eq("plugin_type_id", "google_photos")
    .maybeSingle();

  if (error || !row) return null;

  const r = row as {
    refresh_token_ciphertext: unknown;
    access_token_ciphertext: unknown | null;
    access_token_expires_at: string | null;
  };

  const refreshPlain = await decryptSecret(
    parseBytea(r.refresh_token_ciphertext),
  );

  const exp = r.access_token_expires_at
    ? new Date(r.access_token_expires_at)
    : null;
  if (exp && exp > new Date(Date.now() + 60_000) && r.access_token_ciphertext) {
    try {
      return await decryptSecret(parseBytea(r.access_token_ciphertext));
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
    return null;
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
      access_token_ciphertext: accessCt,
      access_token_expires_at: accessExpires,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("plugin_type_id", "google_photos");

  return tok.access_token as string;
}

function ymdParts(ymd: string): { year: number; month: number; day: number } {
  const [y, m, d] = ymd.split("-").map(Number);
  return { year: y, month: m, day: d };
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

  const accessToken = await getGoogleAccessToken(
    admin,
    userId,
    googleClientId,
    googleClientSecret,
  );
  if (!accessToken) {
    return new Response(
      JSON.stringify({ error: "google_not_linked", suggestions: [] }),
      {
        status: 200,
        headers: { ...cors(), "Content-Type": "application/json" },
      },
    );
  }

  if (body.action === "search") {
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

    const startDate = t.date ?? new Date().toISOString().slice(0, 10);
    const endDate = t.end_date ?? startDate;
    const sd = ymdParts(startDate);
    const ed = ymdParts(endDate);

    const radiusM = 15_000;
    const searchBody = {
      filters: {
        dateFilter: {
          ranges: [
            {
              startDate: sd,
              endDate: ed,
            },
          ],
        },
        locationFilter: {
          locations: [
            {
              latLng: { latitude: t.lat, longitude: t.lng },
              radius: { value: radiusM, unit: "METERS" as const },
            },
          ],
        },
      },
      pageSize: 24,
    };

    const res = await fetch(PHOTOS_SEARCH, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(searchBody),
    });

    const json = (await res.json()) as {
      mediaItems?: Array<{
        id: string;
        mimeType?: string;
        filename?: string;
        mediaMetadata?: {
          creationTime?: string;
          width?: string;
          height?: string;
        };
        productUrl?: string;
        baseUrl?: string;
      }>;
    };

    if (!res.ok) {
      console.error("photos search error", json);
      return new Response(
        JSON.stringify({ error: "google_api_error", details: json }),
        {
          status: 502,
          headers: { ...cors(), "Content-Type": "application/json" },
        },
      );
    }

    const suggestions =
      json.mediaItems?.map((m) => ({
        externalId: m.id,
        title: m.filename ?? null,
        capturedAt: m.mediaMetadata?.creationTime ?? null,
        thumbnailUrl: m.baseUrl ? `${m.baseUrl}=w320-h320-c` : undefined,
        meta: {
          productUrl: m.productUrl ?? null,
          mimeType: m.mimeType ?? null,
        },
      })) ?? [];

    return new Response(JSON.stringify({ suggestions }), {
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

    for (const mediaId of body.mediaItemIds) {
      const metaRes = await fetch(
        `https://photoslibrary.googleapis.com/v1/mediaItems/${mediaId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      const meta = (await metaRes.json()) as {
        id?: string;
        baseUrl?: string;
        mimeType?: string;
        mediaMetadata?: { creationTime?: string };
        productUrl?: string;
      };
      if (!metaRes.ok || !meta.baseUrl) continue;

      const imgUrl = `${meta.baseUrl}=w1600-h1600`;
      const imgRes = await fetch(imgUrl);
      if (!imgRes.ok) continue;
      const buf = new Uint8Array(await imgRes.arrayBuffer());
      const ext = meta.mimeType?.includes("png") ? "png" : "jpg";
      const path = `${t.journal_id}/${t.id}/gp-${mediaId}.${ext}`;

      const { error: upErr } = await admin.storage
        .from("trace-photos")
        .upload(path, buf, {
          contentType: meta.mimeType ?? "image/jpeg",
          upsert: false,
        });
      if (upErr) {
        console.error(upErr);
        continue;
      }

      sort += 1;
      const capturedAt = meta.mediaMetadata?.creationTime;
      const external_ref = {
        kind: "google_photos",
        mediaItemId: mediaId,
        productUrl: meta.productUrl ?? null,
      };

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
