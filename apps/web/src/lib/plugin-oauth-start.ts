import { supabase } from "@/lib/supabase";

/**
 * Starts PKCE OAuth for a plugin Edge flow; redirects the browser to the provider.
 * Callback is handled by `plugin-oauth`, which redirects back with `?plugin_oauth=success|error`.
 */
export async function startPluginOAuth(
  pluginTypeId: string,
  redirectAfter?: string,
): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("sign_in_required");

  const base = (import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  const res = await fetch(`${base}/functions/v1/plugin-oauth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: key,
    },
    body: JSON.stringify({
      action: "start",
      plugin_type_id: pluginTypeId,
      redirect_after: redirectAfter ?? null,
    }),
  });

  const json = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || typeof json.url !== "string") {
    throw new Error(json.error ?? "oauth_start_failed");
  }
  window.location.assign(json.url);
}
