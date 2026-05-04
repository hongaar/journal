import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Json } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { getPluginDefinition } from "@/plugins/registry";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { PluginType, UserPlugin } from "@/types/database";
import { FloatingPanel } from "@/components/layout/floating-panel";
import { PageBackButton } from "@/components/layout/page-back-button";

function PluginRow({
  ct,
  up,
  onToggle,
  toggleDisabled,
}: {
  ct: PluginType;
  up: UserPlugin | undefined;
  onToggle: (enabled: boolean) => void;
  toggleDisabled: boolean;
}) {
  const def = getPluginDefinition(ct.id);
  const implemented = def?.implemented ?? false;
  const enabled = up?.enabled ?? false;

  return (
    <div className="flex flex-col gap-2 border-b border-border/60 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">{ct.display_name}</p>
        <p className="text-muted-foreground text-sm">{ct.description}</p>
        {!implemented ? (
          <p className="text-muted-foreground mt-1 text-xs">Sync and linking are not implemented yet.</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor={`sw-${ct.id}`} className="text-muted-foreground text-sm">
          Enabled
        </Label>
        <Switch
          id={`sw-${ct.id}`}
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

  const typesQuery = useQuery({
    queryKey: ["plugin_types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plugin_types").select("*").order("display_name");
      if (error) throw error;
      return (data ?? []) as PluginType[];
    },
  });

  const userPluginsQuery = useQuery({
    queryKey: ["user_plugins", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("user_plugins").select("*").eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []) as UserPlugin[];
    },
    enabled: Boolean(user),
  });

  async function toggle(pluginTypeId: string, enabled: boolean) {
    if (!user) return;
    const up = userPluginsQuery.data?.find((c) => c.plugin_type_id === pluginTypeId);
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
            <h1 className="font-display text-foreground text-2xl font-semibold tracking-tight">Plugins</h1>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Choose which integrations are available for your account (for example signing in to Google Photos).
              Journal-specific options—such as publishing an iCalendar feed—are configured in each journal&apos;s settings.
            </p>
          </div>
          <div>
            {(typesQuery.data ?? []).map((ct) => {
              const up = userPluginsQuery.data?.find((c) => c.plugin_type_id === ct.id);
              return (
                <PluginRow
                  key={ct.id}
                  ct={ct}
                  up={up}
                  onToggle={(en) => void toggle(ct.id, en)}
                  toggleDisabled={!user || userPluginsQuery.isLoading}
                />
              );
            })}
          </div>
        </FloatingPanel>
      </div>
    </div>
  );
}
