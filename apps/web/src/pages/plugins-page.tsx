import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import type { PluginDefinition } from "@curolia/plugin-contract";
import {
  fetchPluginOAuthLinkStatus,
  unlinkPluginOAuth,
} from "@/lib/plugin-oauth-api";
import { startPluginOAuth } from "@/lib/plugin-oauth-start";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { pluginList } from "@/plugins/registry";
import { Switch } from "@curolia/ui/switch";
import { Label } from "@curolia/ui/label";
import type { Json } from "@/lib/database.types";
import type { UserPlugin } from "@/types/database";
import { FloatingPanel } from "@/components/layout/floating-panel";
import { PageBackButton } from "@/components/layout/page-back-button";

/**
 * React Strict Mode runs effects twice with the same URL before `setSearchParams` applies,
 * which duplicated OAuth result toasts. Skip duplicate handling for identical redirect params.
 */
let oauthRedirectHandledSig = "";

function PluginRow({
  plugin,
  up,
  onToggle,
  toggleDisabled,
  accessToken,
  onRefreshAccountPanels,
}: {
  plugin: PluginDefinition;
  up: UserPlugin | undefined;
  onToggle: (enabled: boolean) => void;
  toggleDisabled: boolean;
  accessToken: string | null;
  onRefreshAccountPanels: () => Promise<void>;
}) {
  const Icon = plugin.icon;
  const implemented = plugin.implemented;
  const enabled = up?.enabled ?? false;
  const Panel = plugin.AccountSettingsPanel;

  const oauthHandlers = useMemo(() => {
    const hasOAuth = Boolean(plugin.contributions?.oauth?.length);
    if (!hasOAuth || !accessToken) return undefined;
    return {
      fetchLinkStatus: () => fetchPluginOAuthLinkStatus(plugin.id),
      unlink: () => unlinkPluginOAuth(plugin.id),
      startOAuth: (redirectAfter: string) =>
        startPluginOAuth(plugin.id, redirectAfter),
    };
  }, [plugin.contributions?.oauth?.length, plugin.id, accessToken]);

  const userSnapshot = useMemo(
    () =>
      up
        ? {
            enabled: up.enabled,
            status: up.status,
            config: up.config,
          }
        : undefined,
    [up],
  );

  return (
    <div className="border-b border-border/60 py-4 last:border-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Icon className="text-muted-foreground size-4" />
            <p className="font-medium">{plugin.displayName}</p>
          </div>
          <p className="text-muted-foreground text-sm">
            {plugin.description ?? "Plugin integration."}
          </p>
          {!implemented ? (
            <p className="text-muted-foreground mt-1 text-xs">
              Sync and linking are not implemented yet.
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Label
            htmlFor={`sw-${plugin.id}`}
            className="text-muted-foreground text-sm"
          >
            Enabled
          </Label>
          <Switch
            id={`sw-${plugin.id}`}
            checked={enabled}
            disabled={!implemented || toggleDisabled}
            onCheckedChange={(c) => {
              if (!implemented) return;
              onToggle(c === true);
            }}
          />
        </div>
      </div>

      {Panel && implemented && enabled ? (
        <Panel
          pluginTypeId={plugin.id}
          pluginEnabled={enabled}
          userPlugin={userSnapshot}
          accessToken={accessToken}
          onRefresh={onRefreshAccountPanels}
          oauth={oauthHandlers}
        />
      ) : null}
    </div>
  );
}

export function PluginsPage() {
  const { user, session } = useAuth();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const status = searchParams.get("plugin_oauth");
    if (!status) {
      oauthRedirectHandledSig = "";
      return;
    }

    const sig = `${status}:${searchParams.get("reason") ?? ""}:${searchParams.toString()}`;
    const duplicateStrictPass = sig === oauthRedirectHandledSig;

    const finishRedirect = () => {
      const next = new URLSearchParams(searchParams);
      next.delete("plugin_oauth");
      next.delete("reason");
      setSearchParams(next, { replace: true });
      void qc.invalidateQueries({ queryKey: ["user_plugins", user?.id] });
      void qc.invalidateQueries({
        queryKey: ["plugin_oauth_link_status"],
        exact: false,
      });
    };

    if (duplicateStrictPass) {
      finishRedirect();
      return;
    }
    oauthRedirectHandledSig = sig;

    const reason = searchParams.get("reason");
    if (status === "success") {
      toast.success("Account linked.");
    } else if (status === "error") {
      toast.error(
        reason
          ? `Could not complete linking (${reason}).`
          : "Could not complete linking.",
      );
    }
    finishRedirect();
  }, [searchParams, setSearchParams, qc, user?.id]);

  const userPluginsQuery = useQuery({
    queryKey: ["user_plugins", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_plugins")
        .select("*")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []) as UserPlugin[];
    },
    enabled: Boolean(user),
  });

  async function toggle(pluginTypeId: string, enabled: boolean) {
    if (!user) return;
    const up = userPluginsQuery.data?.find(
      (c) => c.plugin_type_id === pluginTypeId,
    );
    const existingConfig = (up?.config ?? {}) as Json;
    const { error } = await supabase.from("user_plugins").upsert(
      {
        user_id: user.id,
        plugin_type_id: pluginTypeId,
        enabled,
        config: existingConfig,
        status: enabled ? (up?.status ?? "pending") : "disabled",
      },
      { onConflict: "user_id,plugin_type_id" },
    );
    if (!error) {
      await qc.invalidateQueries({ queryKey: ["user_plugins", user.id] });
      await qc.invalidateQueries({
        queryKey: ["plugin_oauth_link_status"],
        exact: false,
      });
    }
  }

  async function onRefreshAccountPanels() {
    await qc.invalidateQueries({ queryKey: ["user_plugins", user?.id] });
    await qc.invalidateQueries({
      queryKey: ["plugin_oauth_link_status"],
      exact: false,
    });
  }

  return (
    <div className="h-full overflow-y-auto px-3 pt-[4.75rem] pb-10 sm:px-6 sm:pt-[5.25rem]">
      <div className="mx-auto max-w-2xl space-y-4">
        <PageBackButton />
        <FloatingPanel className="p-5 sm:p-6">
          <div className="mb-4">
            <h1 className="font-display text-foreground text-2xl font-normal tracking-tight">
              Plugins
            </h1>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Choose which integrations are available for your account (for
              example signing in to Google Photos). Journal-specific
              options—such as publishing an iCalendar feed—are configured in
              each journal&apos;s settings.
            </p>
          </div>
          <div>
            {pluginList.map((plugin) => {
              const up = userPluginsQuery.data?.find(
                (c) => c.plugin_type_id === plugin.id,
              );
              return (
                <PluginRow
                  key={plugin.id}
                  plugin={plugin}
                  up={up}
                  onToggle={(en) => void toggle(plugin.id, en)}
                  toggleDisabled={!user || userPluginsQuery.isLoading}
                  accessToken={session?.access_token ?? null}
                  onRefreshAccountPanels={onRefreshAccountPanels}
                />
              );
            })}
          </div>
        </FloatingPanel>
      </div>
    </div>
  );
}
