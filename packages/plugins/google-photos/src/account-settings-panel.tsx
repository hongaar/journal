import type { PluginAccountPanelProps } from "@curolia/plugin-contract";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@curolia/ui/button";
import { toast } from "sonner";

export function GooglePhotosAccountSettingsPanel(
  props: PluginAccountPanelProps,
) {
  const { pluginEnabled, accessToken, userPlugin, onRefresh, oauth } = props;

  const statusQuery = useQuery({
    queryKey: ["plugin_oauth_link_status", props.pluginTypeId, accessToken],
    queryFn: () => oauth!.fetchLinkStatus(),
    enabled: Boolean(oauth && accessToken && pluginEnabled),
  });

  const unlinkMut = useMutation({
    mutationFn: () => oauth!.unlink(),
    onSuccess: async () => {
      toast.success("Google Photos unlinked.");
      await onRefresh();
      await statusQuery.refetch();
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Could not unlink.");
    },
  });

  async function onLink() {
    if (!oauth) return;
    try {
      await oauth.startOAuth(`${window.location.origin}/settings/plugins`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "OAuth failed");
    }
  }

  if (!oauth) {
    return (
      <div className="border-border/60 bg-muted/25 mt-3 rounded-xl border px-3 py-2.5">
        <p className="text-muted-foreground text-sm">
          OAuth is not configured for this environment.
        </p>
      </div>
    );
  }

  const linked = statusQuery.data?.linked === true;

  const oauthCfg =
    typeof userPlugin?.config === "object" &&
    userPlugin.config !== null &&
    "oauth" in userPlugin.config &&
    typeof (userPlugin.config as { oauth?: unknown }).oauth === "object" &&
    (userPlugin.config as { oauth: object }).oauth !== null
      ? ((userPlugin.config as { oauth: Record<string, unknown> }).oauth ?? {})
      : null;

  const email =
    statusQuery.data?.email ??
    (oauthCfg && typeof oauthCfg.email === "string" ? oauthCfg.email : null);

  const sub =
    statusQuery.data?.sub ??
    (oauthCfg && typeof oauthCfg.sub === "string" ? oauthCfg.sub : null);

  /** Prefer email from Google userinfo; fall back to OpenID `sub` when missing (legacy links). */
  const accountLabel = email ?? sub;

  return (
    <div className="border-border/60 bg-muted/25 mt-3 rounded-xl border px-3 py-3">
      <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
        Account
      </p>
      {statusQuery.isLoading ? (
        <p className="text-muted-foreground text-sm">Checking link status…</p>
      ) : linked ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-foreground text-sm">
            Linked as{" "}
            <span className="break-all font-medium">
              {accountLabel ?? "Google account"}
            </span>
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 rounded-xl"
            disabled={unlinkMut.isPending}
            onClick={() => unlinkMut.mutate()}
          >
            Unlink Google Photos
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm">
            Connect your library to search and import photos on traces.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 rounded-xl"
            onClick={() => void onLink()}
          >
            Link Google Photos
          </Button>
        </div>
      )}
    </div>
  );
}
