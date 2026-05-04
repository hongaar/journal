import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { getConnectorDefinition } from "@/connectors/registry";
import { ConnectorJournalSettings } from "@/connectors/journal-settings/connector-journal-settings";
import { FloatingPanel } from "@/components/layout/floating-panel";
import type { ConnectorType, JournalConnector, UserConnector } from "@/types/database";

type Props = {
  journalId: string;
  isOwner: boolean;
  roleLoading: boolean;
};

/**
 * For each account-level enabled connector, shows per-journal settings. Owners edit; other roles do not see this block.
 */
export function JournalConnectorsSection({ journalId, isOwner, roleLoading }: Props) {
  const { user } = useAuth();

  const typesQuery = useQuery({
    queryKey: ["connector_types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("connector_types").select("*").order("display_name");
      if (error) throw error;
      return (data ?? []) as ConnectorType[];
    },
  });

  const userConnectorsQuery = useQuery({
    queryKey: ["user_connectors", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("user_connectors").select("*").eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []) as UserConnector[];
    },
    enabled: Boolean(user) && isOwner,
  });

  const journalConnectorsQuery = useQuery({
    queryKey: ["journal_connectors", journalId],
    queryFn: async () => {
      const { data, error } = await supabase.from("journal_connectors").select("*").eq("journal_id", journalId);
      if (error) throw error;
      return (data ?? []) as JournalConnector[];
    },
    enabled: Boolean(journalId) && isOwner,
  });

  if (roleLoading || !isOwner) {
    return null;
  }

  const enabledTypeIds = new Set(
    (userConnectorsQuery.data ?? []).filter((uc) => uc.enabled).map((uc) => uc.connector_type_id),
  );

  const implementedEnabled = (typesQuery.data ?? []).filter((ct) => {
    const def = getConnectorDefinition(ct.id);
    return (def?.implemented ?? false) && enabledTypeIds.has(ct.id);
  });

  if (userConnectorsQuery.isLoading || typesQuery.isLoading) {
    return (
      <FloatingPanel className="p-5 sm:p-6">
        <p className="text-muted-foreground text-sm">Loading connectors…</p>
      </FloatingPanel>
    );
  }

  if (implementedEnabled.length === 0) {
    return (
      <FloatingPanel className="p-5 sm:p-6">
        <h2 className="font-display text-foreground text-lg font-semibold tracking-tight">Connectors</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Enable integrations under Connectors in the user menu, then configure each journal here.
        </p>
      </FloatingPanel>
    );
  }

  return (
    <>
      {implementedEnabled.map((ct) => {
        const def = getConnectorDefinition(ct.id);
        const title = def?.contributions?.journalSettings?.title ?? ct.display_name;
        const jc = journalConnectorsQuery.data?.find((c) => c.connector_type_id === ct.id);
        return (
          <FloatingPanel key={ct.id} className="p-5 sm:p-6">
            <h2 className="font-display text-foreground text-lg font-semibold tracking-tight">{title}</h2>
            <p className="text-muted-foreground mt-1 text-sm">{ct.description}</p>
            <ConnectorJournalSettings
              connectorTypeId={ct.id}
              journalId={journalId}
              jc={jc}
              connectorGloballyEnabled
              readOnly={false}
            />
          </FloatingPanel>
        );
      })}
    </>
  );
}
