import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { pluginList } from "@/plugins/registry";
import { PluginJournalSettings } from "@/plugins/journal-settings/plugin-journal-settings";
import { FloatingPanel } from "@/components/layout/floating-panel";
import type { JournalPlugin, UserPlugin } from "@/types/database";

type Props = {
  journalId: string;
  isOwner: boolean;
  roleLoading: boolean;
};

/**
 * For each account-level enabled plugin, shows per-journal settings. Owners edit; other roles do not see this block.
 */
export function JournalPluginsSection({
  journalId,
  isOwner,
  roleLoading,
}: Props) {
  const { user } = useAuth();

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
    enabled: Boolean(user) && isOwner,
  });

  const journalPluginsQuery = useQuery({
    queryKey: ["journal_plugins", journalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_plugins")
        .select("*")
        .eq("journal_id", journalId);
      if (error) throw error;
      return (data ?? []) as JournalPlugin[];
    },
    enabled: Boolean(journalId) && isOwner,
  });

  if (roleLoading || !isOwner) {
    return null;
  }

  const enabledTypeIds = new Set(
    (userPluginsQuery.data ?? [])
      .filter((up) => up.enabled)
      .map((up) => up.plugin_type_id),
  );

  const implementedEnabled = pluginList.filter(
    (plugin) => plugin.implemented && enabledTypeIds.has(plugin.id),
  );

  if (userPluginsQuery.isLoading) {
    return (
      <FloatingPanel className="p-5 sm:p-6">
        <p className="text-muted-foreground text-sm">Loading plugins…</p>
      </FloatingPanel>
    );
  }

  if (implementedEnabled.length === 0) {
    return (
      <FloatingPanel className="p-5 sm:p-6">
        <h2 className="font-display text-foreground text-lg font-normal tracking-tight">
          Plugins
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Enable integrations under Plugins in the user menu, then configure
          each journal here.
        </p>
      </FloatingPanel>
    );
  }

  return (
    <>
      {implementedEnabled.map((plugin) => {
        const Icon = plugin.icon;
        const title =
          plugin.contributions?.journalSettings?.title ?? plugin.displayName;
        const jp = journalPluginsQuery.data?.find(
          (c) => c.plugin_type_id === plugin.id,
        );
        return (
          <FloatingPanel key={plugin.id} className="p-5 sm:p-6">
            <h2 className="font-display text-foreground flex items-center gap-2 text-lg font-normal tracking-tight">
              <Icon className="text-muted-foreground size-4" />
              {title}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {plugin.description ?? "Plugin journal settings."}
            </p>
            <PluginJournalSettings
              pluginTypeId={plugin.id}
              journalId={journalId}
              jp={jp}
              pluginGloballyEnabled
              readOnly={false}
            />
          </FloatingPanel>
        );
      })}
    </>
  );
}
