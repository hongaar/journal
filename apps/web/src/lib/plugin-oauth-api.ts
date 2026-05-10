import { supabase } from "@/lib/supabase";

async function pluginOAuthFetch(
  body: Record<string, unknown>,
): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("sign_in_required");

  const base = (import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  return fetch(`${base}/functions/v1/plugin-oauth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: key,
    },
    body: JSON.stringify(body),
  });
}

export type PluginOAuthLinkStatus = {
  linked: boolean;
  email: string | null;
  sub: string | null;
  status: string | null;
};

export async function fetchPluginOAuthLinkStatus(
  pluginTypeId: string,
): Promise<PluginOAuthLinkStatus> {
  const res = await pluginOAuthFetch({
    action: "link_status",
    plugin_type_id: pluginTypeId,
  });
  const json = (await res.json()) as PluginOAuthLinkStatus & { error?: string };
  if (!res.ok) throw new Error(json.error ?? "link_status_failed");
  return {
    linked: Boolean(json.linked),
    email: typeof json.email === "string" ? json.email : null,
    sub: typeof json.sub === "string" ? json.sub : null,
    status: typeof json.status === "string" ? json.status : null,
  };
}

export async function unlinkPluginOAuth(pluginTypeId: string): Promise<void> {
  const res = await pluginOAuthFetch({
    action: "unlink",
    plugin_type_id: pluginTypeId,
  });
  const json = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok || !json.ok) throw new Error(json.error ?? "unlink_failed");
}
