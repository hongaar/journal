import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import type { Json } from "@/lib/database.types";
import { startPluginOAuth } from "@/lib/plugin-oauth-start";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { pluginList } from "@/plugins/registry";
import { Button } from "@curolia/ui/button";
import { Switch } from "@curolia/ui/switch";
import { Label } from "@curolia/ui/label";
import type { UserPlugin } from "@/types/database";
import { FloatingPanel } from "@/components/layout/floating-panel";
import { PageBackButton } from "@/components/layout/page-back-button";
import type { PluginDefinition } from "@curolia/plugin-contract";

function PluginRow({
  plugin,
  up,
  onToggle,
  toggleDisabled,
  onLinkGooglePhotos,
  linkGooglePhotosBusy,
}: {
  plugin: PluginDefinition;
  up: UserPlugin | undefined;
  onToggle: (enabled: boolean) => void;
  toggleDisabled: boolean;
  onLinkGooglePhotos?: () => void;
  linkGooglePhotosBusy?: boolean;
}) {
  const Icon = plugin.icon;
  const implemented = plugin.implemented;
  const enabled = up?.enabled ?? false;
  const showGoogleLink =
    plugin.id === "google_photos" &&
    implemented &&
    enabled &&
    typeof onLinkGooglePhotos === "function";

  return (
    <div className="flex flex-col gap-2 border-b border-border/60 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
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
      <div className="flex flex-wrap items-center justify-end gap-2">
        {showGoogleLink ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={linkGooglePhotosBusy}
            onClick={onLinkGooglePhotos}
          >
            Link Google Photos
          </Button>
        ) : null}
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
  );
}

export function PluginsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [oauthBusy, setOauthBusy] = useState(false);

  useEffect(() => {
    const status = searchParams.get("plugin_oauth");
    if (!status) return;
    const reason = searchParams.get("reason");
    if (status === "success") {
      toast.success("Google Photos linked.");
    } else if (status === "error") {
      toast.error(
        reason
          ? `Could not complete linking (${reason}).`
          : "Could not complete linking.",
      );
    }
    const next = new URLSearchParams(searchParams);
    next.delete("plugin_oauth");
    next.delete("reason");
    setSearchParams(next, { replace: true });
    void qc.invalidateQueries({ queryKey: ["user_plugins", user?.id] });
  }, [searchParams, setSearchParams, qc, user?.id]);

  async function linkGooglePhotos() {
    setOauthBusy(true);
    try {
      const redirect = `${window.location.origin}/settings/plugins`;
      await startPluginOAuth("google_photos", redirect);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "OAuth failed");
      setOauthBusy(false);
    }
  }

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
    const existingConfig = (up?.config ?? {}) as Record<string, unknown>;
    const config = existingConfig as Json;
    const { error } = await supabase.from("user_plugins").upsert(
      {
        user_id: user.id,
        plugin_type_id: pluginTypeId,
        enabled,
        config,
        status: enabled ? "connected" : "disabled",
      },
      { onConflict: "user_id,plugin_type_id" },
    );
    if (!error) {
      await qc.invalidateQueries({ queryKey: ["user_plugins", user.id] });
    }
  }

  return (
    <div className="h-full overflow-y-auto px-3 pt-[4.75rem] pb-10 sm:px-6 sm:pt-[5.25rem]">
      <div className="mx-auto max-w-2xl space-y-4">
        <PageBackButton />
        <FloatingPanel className="p-5 sm:p-6">
          <div className="mb-4">
            <h1 className="font-display text-foreground text-2xl font-semibold tracking-tight">
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
                  onLinkGooglePhotos={
                    plugin.id === "google_photos"
                      ? () => void linkGooglePhotos()
                      : undefined
                  }
                  linkGooglePhotosBusy={oauthBusy}
                />
              );
            })}
          </div>
        </FloatingPanel>
      </div>
    </div>
  );
}
