import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  authorizeScopesSpaceSeparated,
  oauthProviderIdsForPlugin,
} from "./scopes-registry.gen.ts";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";

const SPOTIFY_AUTH = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN = "https://accounts.spotify.com/api/token";

function cors(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
}

function supportsPluginOAuth(pluginTypeId: string): boolean {
  return oauthProviderIdsForPlugin(pluginTypeId).length > 0;
}

/** Each plugin manifest must declare exactly one OAuth provider for this Edge flow. */
function oauthProviderForPlugin(pluginTypeId: string): string | null {
  const ids = oauthProviderIdsForPlugin(pluginTypeId);
  if (ids.length !== 1) return null;
  return ids[0]!;
}

type StartBody = {
  action: "start";
  plugin_type_id: string;
  redirect_after?: string;
};

type UnlinkBody = {
  action: "unlink";
  plugin_type_id: string;
};

type LinkStatusBody = {
  action: "link_status";
  plugin_type_id: string;
};

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

function callbackUrl(): string {
  const explicit = Deno.env.get("PLUGIN_OAUTH_CALLBACK_URL");
  if (explicit) return explicit;

  let base = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
  try {
    const u = new URL(base || "http://invalid");
    if (u.hostname === "kong") {
      const port = Deno.env.get("SUPABASE_PUBLIC_PORT") ?? "54321";
      base = `http://127.0.0.1:${port}`;
    }
  } catch {
    /* fall through */
  }

  return `${base}/functions/v1/plugin-oauth?action=callback`;
}

async function insertPendingOauth(
  admin: ReturnType<typeof createClient>,
  args: {
    state: string;
    userId: string;
    pluginTypeId: string;
    codeVerifier: string;
    redirectAfter: string | null;
  },
): Promise<Response | null> {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const { error: pendErr } = await admin.from("plugin_oauth_pending").insert({
    state: args.state,
    user_id: args.userId,
    plugin_type_id: args.pluginTypeId,
    code_verifier: args.codeVerifier,
    redirect_after: args.redirectAfter,
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
  return null;
}

async function handleStart(body: StartBody, jwt: string): Promise<Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

  const oauthProviderId = oauthProviderForPlugin(body.plugin_type_id);
  if (!oauthProviderId || !supportsPluginOAuth(body.plugin_type_id)) {
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

  const codeVerifier = randomUrlSafe(48);
  const codeChallenge = await sha256Base64Url(codeVerifier);
  const state = randomUrlSafe(24);

  const admin = createClient(supabaseUrl, serviceKey);
  const pendErrResp = await insertPendingOauth(admin, {
    state,
    userId,
    pluginTypeId: body.plugin_type_id,
    codeVerifier,
    redirectAfter: body.redirect_after ?? null,
  });
  if (pendErrResp) return pendErrResp;

  const redirectUri = callbackUrl();
  const scope = authorizeScopesSpaceSeparated(
    body.plugin_type_id,
    oauthProviderId,
  );

  if (oauthProviderId === "google") {
    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
    if (!googleClientId) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_CLIENT_ID not configured" }),
        {
          status: 500,
          headers: { ...cors(), "Content-Type": "application/json" },
        },
      );
    }
    const params = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope,
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

  if (oauthProviderId === "spotify") {
    const spotifyClientId = Deno.env.get("SPOTIFY_CLIENT_ID") ?? "";
    if (!spotifyClientId) {
      return new Response(
        JSON.stringify({ error: "SPOTIFY_CLIENT_ID not configured" }),
        {
          status: 500,
          headers: { ...cors(), "Content-Type": "application/json" },
        },
      );
    }
    const params = new URLSearchParams({
      client_id: spotifyClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    const authorizeUrl = `${SPOTIFY_AUTH}?${params.toString()}`;
    return new Response(JSON.stringify({ url: authorizeUrl }), {
      status: 200,
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ error: "oauth_provider_not_implemented" }),
    {
      status: 500,
      headers: { ...cors(), "Content-Type": "application/json" },
    },
  );
}

async function handleUnlink(body: UnlinkBody, jwt: string): Promise<Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!jwt) {
    return new Response(JSON.stringify({ error: "missing Authorization" }), {
      status: 401,
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  }

  if (body.action !== "unlink" || !body.plugin_type_id) {
    return new Response(JSON.stringify({ error: "invalid body" }), {
      status: 400,
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  }

  if (!oauthProviderForPlugin(body.plugin_type_id)) {
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

  const admin = createClient(supabaseUrl, serviceKey);
  const { error: delErr } = await admin
    .from("user_plugin_oauth_tokens")
    .delete()
    .eq("user_id", userId)
    .eq("plugin_type_id", body.plugin_type_id);

  if (delErr) {
    console.error(delErr);
    return new Response(JSON.stringify({ error: "unlink_failed" }), {
      status: 500,
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  }

  const { data: upRow } = await admin
    .from("user_plugins")
    .select("config")
    .eq("user_id", userId)
    .eq("plugin_type_id", body.plugin_type_id)
    .maybeSingle();

  const prevRaw = upRow?.config;
  const prev =
    prevRaw &&
    typeof prevRaw === "object" &&
    prevRaw !== null &&
    !Array.isArray(prevRaw)
      ? { ...(prevRaw as Record<string, unknown>) }
      : {};
  delete prev.oauth;

  const { error: upErr } = await admin
    .from("user_plugins")
    .update({
      config: prev,
      status: "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("plugin_type_id", body.plugin_type_id);

  if (upErr) console.error(upErr);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...cors(), "Content-Type": "application/json" },
  });
}

async function handleLinkStatus(
  body: LinkStatusBody,
  jwt: string,
): Promise<Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!jwt) {
    return new Response(JSON.stringify({ error: "missing Authorization" }), {
      status: 401,
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  }

  if (body.action !== "link_status" || !body.plugin_type_id) {
    return new Response(JSON.stringify({ error: "invalid body" }), {
      status: 400,
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  }

  if (!oauthProviderForPlugin(body.plugin_type_id)) {
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

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: tok } = await admin
    .from("user_plugin_oauth_tokens")
    .select("id")
    .eq("user_id", userId)
    .eq("plugin_type_id", body.plugin_type_id)
    .maybeSingle();

  const { data: up } = await admin
    .from("user_plugins")
    .select("config, status")
    .eq("user_id", userId)
    .eq("plugin_type_id", body.plugin_type_id)
    .maybeSingle();

  const cfg = up?.config;
  let email: string | null = null;
  let sub: string | null = null;
  if (cfg && typeof cfg === "object" && cfg !== null && !Array.isArray(cfg)) {
    const oauth = (cfg as Record<string, unknown>).oauth;
    if (oauth && typeof oauth === "object" && oauth !== null) {
      const o = oauth as Record<string, unknown>;
      if (typeof o.email === "string") email = o.email;
      if (typeof o.sub === "string") sub = o.sub;
    }
  }

  return new Response(
    JSON.stringify({
      linked: Boolean(tok),
      email,
      sub,
      status: up?.status ?? null,
    }),
    {
      status: 200,
      headers: { ...cors(), "Content-Type": "application/json" },
    },
  );
}

async function handleCallback(req: Request, url: URL): Promise<Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
  const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
  const spotifyClientId = Deno.env.get("SPOTIFY_CLIENT_ID") ?? "";
  const spotifyClientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET") ?? "";
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

  const oauthProviderId = oauthProviderForPlugin(p.plugin_type_id);
  if (!oauthProviderId) {
    await admin.from("plugin_oauth_pending").delete().eq("state", state);
    return redirectBack(`${defaultOrigin}/settings/plugins`, {
      plugin_oauth: "error",
      reason: "unsupported_plugin",
    });
  }

  const redirectUri = callbackUrl();
  let tokenJson: Record<string, unknown>;
  let tokenRes: Response;

  if (oauthProviderId === "google") {
    const tokenBody = new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      code,
      code_verifier: p.code_verifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });

    tokenRes = await fetch(GOOGLE_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody,
    });
    tokenJson = (await tokenRes.json()) as Record<string, unknown>;
  } else if (oauthProviderId === "spotify") {
    const body = new URLSearchParams({
      client_id: spotifyClientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: p.code_verifier,
    });
    if (spotifyClientSecret.trim()) {
      body.set("client_secret", spotifyClientSecret);
    }

    tokenRes = await fetch(SPOTIFY_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    tokenJson = (await tokenRes.json()) as Record<string, unknown>;
  } else {
    await admin.from("plugin_oauth_pending").delete().eq("state", state);
    return redirectBack(`${defaultOrigin}/settings/plugins`, {
      plugin_oauth: "error",
      reason: "oauth_provider_not_implemented",
    });
  }

  if (!tokenRes.ok) {
    console.error("oauth token error", oauthProviderId, tokenJson);
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
    provider: oauthProviderId,
    refresh_token_ciphertext: byteaInsertValue(refreshCt),
    access_token_ciphertext: accessCt ? byteaInsertValue(accessCt) : null,
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

  const { data: existingUp } = await admin
    .from("user_plugins")
    .select("config")
    .eq("user_id", p.user_id)
    .eq("plugin_type_id", p.plugin_type_id)
    .maybeSingle();

  const oauthMeta: Record<string, unknown> = {
    provider: oauthProviderId,
    linked_at: new Date().toISOString(),
  };

  if (oauthProviderId === "google" && accessToken) {
    try {
      const ui = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (ui.ok) {
        const j = (await ui.json()) as Record<string, unknown>;
        if (typeof j.email === "string") oauthMeta.email = j.email;
        if (typeof j.picture === "string") oauthMeta.picture = j.picture;
        if (typeof j.sub === "string") oauthMeta.sub = j.sub;
      }
    } catch (e) {
      console.error("google userinfo failed", e);
    }
  }

  if (oauthProviderId === "spotify" && accessToken) {
    try {
      const ui = await fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (ui.ok) {
        const j = (await ui.json()) as Record<string, unknown>;
        const dn = j.display_name;
        const id = j.id;
        if (typeof dn === "string" && dn.trim()) oauthMeta.email = dn;
        if (typeof id === "string") oauthMeta.sub = id;
      }
    } catch (e) {
      console.error("spotify me failed", e);
    }
  }

  const prevRaw = existingUp?.config;
  const prevConfig =
    prevRaw &&
    typeof prevRaw === "object" &&
    prevRaw !== null &&
    !Array.isArray(prevRaw)
      ? { ...(prevRaw as Record<string, unknown>) }
      : {};
  const nextConfig = { ...prevConfig, oauth: oauthMeta };

  await admin.from("user_plugins").upsert(
    {
      user_id: p.user_id,
      plugin_type_id: p.plugin_type_id,
      enabled: true,
      status: "connected",
      config: nextConfig,
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
      const body = (await req.json()) as Record<string, unknown>;
      const action = body.action;
      if (action === "start") {
        return await handleStart(body as StartBody, jwt);
      }
      if (action === "unlink") {
        return await handleUnlink(body as UnlinkBody, jwt);
      }
      if (action === "link_status") {
        return await handleLinkStatus(body as LinkStatusBody, jwt);
      }
      return new Response(JSON.stringify({ error: "unknown_action" }), {
        status: 400,
        headers: { ...cors(), "Content-Type": "application/json" },
      });
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
