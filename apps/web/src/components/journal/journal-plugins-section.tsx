import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { getPluginDefinition } from "@/plugins/registry";
import { PluginJournalSettings } from "@/plugins/journal-settings/plugin-journal-settings";
import { FloatingPanel } from "@/components/layout/floating-panel";
import type { JournalPlugin, PluginType, UserPlugin } from "@/types/database";

type Props = {
  journalId: string;
  isOwner: boolean;
  roleLoading: boolean;
};

/**
 * For each account-level enabled plugin, shows per-journal settings. Owners edit; other roles do not see this block.
 */
export function JournalPluginsSection({ journalId, isOwner, roleLoading }: Props) {
  const { user } = useAuth();

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
    enabled: Boolean(user) && isOwner,
  });

  const journalPluginsQuery = useQuery({
    queryKey: ["journal_plugins", journalId],
    queryFn: async () => {
      const { data, error } = await supabase.from("journal_plugins").select("*").eq("journal_id", journalId);
      if (error) throw error;
      return (data ?? []) as JournalPlugin[];
    },
    enabled: Boolean(journalId) && isOwner,
  });

  if (roleLoading || !isOwner) {
    return null;
  }

  const enabledTypeIds = new Set(
    (userPluginsQuery.data ?? []).filter((up) => up.enabled).map((up) => up.plugin_type_id),
  );

  const implementedEnabled = (typesQuery.data ?? []).filter((ct) => {
    const def = getPluginDefinition(ct.id);
    return (def?.implemented ?? false) && enabledTypeIds.has(ct.id);
  });

  if (userPluginsQuery.isLoading || typesQuery.isLoading) {
    return (
      <FloatingPanel className="p-5 sm:p-6">
        <p className="text-muted-foreground text-sm">Loading plugins…</p>
      </FloatingPanel>
    );
  }

  if (implementedEnabled.length === 0) {
    return (
      <FloatingPanel className="p-5 sm:p-6">
        <h2 className="font-display text-foreground text-lg font-semibold tracking-tight">Plugins</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Enable integrations under Plugins in the user menu, then configure each journal here.
        </p>
      </FloatingPanel>
    );
  }

  return (
    <>
      {implementedEnabled.map((ct) => {
        const def = getPluginDefinition(ct.id);
        const title = def?.contributions?.journalSettings?.title ?? ct.display_name;
        const jp = journalPluginsQuery.data?.find((c) => c.plugin_type_id === ct.id);
        return (
          <FloatingPanel key={ct.id} className="p-5 sm:p-6">
            <h2 className="font-display text-foreground text-lg font-semibold tracking-tight">{title}</h2>
            <p className="text-muted-foreground mt-1 text-sm">{ct.description}</p>
            <PluginJournalSettings
              pluginTypeId={ct.id}
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
