import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const PHOTOS_SCOPE = "https://www.googleapis.com/auth/photoslibrary.readonly";

type StartBody = {
  action: "start";
  plugin_type_id: string;
  redirect_after?: string;
};

function cors(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
}

function base64UrlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++)
    binary += String.fromCharCode(bytes[i]!);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(hash);
}

function randomUrlSafe(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes.buffer);
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

/** IV (12) || ciphertext for AES-GCM */
async function encryptSecret(plaintext: string): Promise<Uint8Array> {
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

function callbackUrl(): string {
  const base = Deno.env.get("SUPABASE_URL") ?? "";
  const override = Deno.env.get("PLUGIN_OAUTH_CALLBACK_URL");
  if (override) return override;
  return `${base.replace(/\/$/, "")}/functions/v1/plugin-oauth?action=callback`;
}

async function handleStart(body: StartBody, jwt: string): Promise<Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";

  if (!jwt) {
    return new Response(JSON.stringify({ error: "missing Authorization" }), {
      status: 401,
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  }

  if (body.action !== "start" || !body.plugin_type_id) {
    return new Response(JSON.stringify({ error: "invalid body" }), {
      status: 400,
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  }

  if (body.plugin_type_id !== "google_photos") {
    return new Response(
      JSON.stringify({ error: "unsupported plugin_type_id" }),
      {
        status: 400,
        headers: { ...cors(), "Content-Type": "application/json" },
      },
    );
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: "invalid session" }), {
      status: 401,
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  }
  const userId = userData.user.id;

  if (!googleClientId) {
    return new Response(
      JSON.stringify({ error: "GOOGLE_CLIENT_ID not configured" }),
      {
        status: 500,
        headers: { ...cors(), "Content-Type": "application/json" },
      },
    );
  }

  const codeVerifier = randomUrlSafe(48);
  const codeChallenge = await sha256Base64Url(codeVerifier);
  const state = randomUrlSafe(24);

  const admin = createClient(supabaseUrl, serviceKey);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const { error: pendErr } = await admin.from("plugin_oauth_pending").insert({
    state,
    user_id: userId,
    plugin_type_id: body.plugin_type_id,
    code_verifier: codeVerifier,
    redirect_after: body.redirect_after ?? null,
    expires_at: expiresAt,
  });
  if (pendErr) {
    console.error(pendErr);
    return new Response(
      JSON.stringify({ error: "could not store oauth state" }),
      {
        status: 500,
        headers: { ...cors(), "Content-Type": "application/json" },
      },
    );
  }

  const redirectUri = callbackUrl();
  const params = new URLSearchParams({
    client_id: googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: PHOTOS_SCOPE,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
  });

  const authorizeUrl = `${GOOGLE_AUTH}?${params.toString()}`;
  return new Response(JSON.stringify({ url: authorizeUrl }), {
    status: 200,
    headers: { ...cors(), "Content-Type": "application/json" },
  });
}

async function handleCallback(req: Request, url: URL): Promise<Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
  const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
  const defaultOrigin =
    Deno.env.get("PUBLIC_APP_ORIGIN") ?? "http://127.0.0.1:5173";

  function redirectBack(
    target: string,
    params: Record<string, string>,
  ): Response {
    const u = target.startsWith("http")
      ? new URL(target)
      : new URL(target, defaultOrigin);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return Response.redirect(u.toString(), 302);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  const admin = createClient(supabaseUrl, serviceKey);

  if (err) {
    return redirectBack(`${defaultOrigin}/settings/plugins`, {
      plugin_oauth: "error",
      reason: err,
    });
  }

  if (!code || !state) {
    return redirectBack(`${defaultOrigin}/settings/plugins`, {
      plugin_oauth: "error",
      reason: "missing_code_or_state",
    });
  }

  const { data: pending, error: pe } = await admin
    .from("plugin_oauth_pending")
    .select("*")
    .eq("state", state)
    .maybeSingle();

  if (pe || !pending) {
    return redirectBack(`${defaultOrigin}/settings/plugins`, {
      plugin_oauth: "error",
      reason: "invalid_state",
    });
  }

  if (new Date((pending as { expires_at: string }).expires_at) < new Date()) {
    await admin.from("plugin_oauth_pending").delete().eq("state", state);
    return redirectBack(`${defaultOrigin}/settings/plugins`, {
      plugin_oauth: "error",
      reason: "expired",
    });
  }

  const p = pending as {
    user_id: string;
    plugin_type_id: string;
    code_verifier: string;
    redirect_after: string | null;
  };

  const redirectUri = callbackUrl();
  const tokenBody = new URLSearchParams({
    client_id: googleClientId,
    client_secret: googleClientSecret,
    code,
    code_verifier: p.code_verifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const tokenRes = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody,
  });
  const tokenJson = (await tokenRes.json()) as Record<string, unknown>;

  if (!tokenRes.ok) {
    console.error("google token error", tokenJson);
    await admin.from("plugin_oauth_pending").delete().eq("state", state);
    const base = p.redirect_after ?? `${defaultOrigin}/settings/plugins`;
    return redirectBack(base, {
      plugin_oauth: "error",
      reason: "token_exchange_failed",
    });
  }

  const refreshToken = tokenJson.refresh_token as string | undefined;
  const accessToken = tokenJson.access_token as string | undefined;
  const expiresIn = Number(tokenJson.expires_in ?? 3600);

  if (!refreshToken) {
    await admin.from("plugin_oauth_pending").delete().eq("state", state);
    const base = p.redirect_after ?? `${defaultOrigin}/settings/plugins`;
    return redirectBack(base, {
      plugin_oauth: "error",
      reason: "missing_refresh_token_retry_consent",
    });
  }

  const refreshCt = await encryptSecret(refreshToken);
  const accessCt = accessToken ? await encryptSecret(accessToken) : null;
  const accessExpires = accessToken
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null;

  const row = {
    user_id: p.user_id,
    plugin_type_id: p.plugin_type_id,
    provider: "google",
    refresh_token_ciphertext: refreshCt,
    access_token_ciphertext: accessCt,
    access_token_expires_at: accessExpires,
    updated_at: new Date().toISOString(),
    revoked_at: null,
  };

  const { error: tokErr } = await admin
    .from("user_plugin_oauth_tokens")
    .upsert(row, {
      onConflict: "user_id,plugin_type_id",
    });

  if (tokErr) {
    console.error(tokErr);
    await admin.from("plugin_oauth_pending").delete().eq("state", state);
    const base = p.redirect_after ?? `${defaultOrigin}/settings/plugins`;
    return redirectBack(base, {
      plugin_oauth: "error",
      reason: "db_token_store_failed",
    });
  }

  await admin.from("user_plugins").upsert(
    {
      user_id: p.user_id,
      plugin_type_id: p.plugin_type_id,
      enabled: true,
      status: "connected",
      config: {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,plugin_type_id" },
  );

  await admin.from("plugin_oauth_pending").delete().eq("state", state);

  const base = p.redirect_after ?? `${defaultOrigin}/settings/plugins`;
  return redirectBack(base, { plugin_oauth: "success" });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors() });
  }

  const url = new URL(req.url);

  if (req.method === "GET" && url.searchParams.get("action") === "callback") {
    return handleCallback(req, url);
  }

  if (req.method === "POST") {
    try {
      const authHeader = req.headers.get("Authorization");
      const jwt = authHeader?.replace(/^Bearer\s+/i, "") ?? "";
      const body = (await req.json()) as StartBody;
      if (body.action === "start") return await handleStart(body, jwt);
    } catch (e) {
      console.error(e);
      return new Response(JSON.stringify({ error: "bad_json" }), {
        status: 400,
        headers: { ...cors(), "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "not_found" }), {
    status: 404,
    headers: { ...cors(), "Content-Type": "application/json" },
  });
});
