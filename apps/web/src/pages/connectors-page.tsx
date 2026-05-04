import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Json } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { useJournal } from "@/providers/journal-provider";
import { getConnectorDefinition } from "@/connectors/registry";
import { journalConnectorConfigObject, mergeJournalConnectorConfig } from "@/connectors/journal-config";
import { ConnectorJournalSettings } from "@/connectors/journal-settings/connector-journal-settings";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { ConnectorType, JournalConnector } from "@/types/database";
import { FloatingPanel } from "@/components/layout/floating-panel";
import { PageBackButton } from "@/components/layout/page-back-button";

function ConnectorRow({
  ct,
  jc,
  journalId,
  onToggle,
}: {
  ct: ConnectorType;
  jc: JournalConnector | undefined;
  journalId: string;
  onToggle: (enabled: boolean) => void;
}) {
  const def = getConnectorDefinition(ct.id);
  const implemented = def?.implemented ?? false;
  const enabled = jc?.enabled ?? false;

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
          disabled={!journalId || !implemented}
          onCheckedChange={(c) => {
            if (!implemented) return;
            onToggle(c === true);
          }}
        />
      </div>
    </div>
  );
}

export function ConnectorsPage() {
  const { activeJournalId } = useJournal();
  const qc = useQueryClient();

  const typesQuery = useQuery({
    queryKey: ["connector_types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("connector_types").select("*").order("display_name");
      if (error) throw error;
      return (data ?? []) as ConnectorType[];
    },
  });

  const connectorsQuery = useQuery({
    queryKey: ["journal_connectors", activeJournalId],
    queryFn: async () => {
      if (!activeJournalId) return [];
      const { data, error } = await supabase
        .from("journal_connectors")
        .select("*")
        .eq("journal_id", activeJournalId);
      if (error) throw error;
      return (data ?? []) as JournalConnector[];
    },
    enabled: Boolean(activeJournalId),
  });

  async function toggle(connectorTypeId: string, enabled: boolean) {
    if (!activeJournalId) return;
    const jc = connectorsQuery.data?.find((c) => c.connector_type_id === connectorTypeId);
    const config = mergeJournalConnectorConfig(
      connectorTypeId,
      journalConnectorConfigObject(jc),
      {},
    ) as Json;
    const { error } = await supabase.from("journal_connectors").upsert(
      {
        journal_id: activeJournalId,
        connector_type_id: connectorTypeId,
        enabled,
        config,
        status: enabled ? "connected" : "disabled",
      },
      { onConflict: "journal_id,connector_type_id" },
    );
    if (!error) {
      await qc.invalidateQueries({ queryKey: ["journal_connectors", activeJournalId] });
    }
  }

  return (
    <div className="h-full overflow-y-auto px-3 pt-[4.75rem] pb-10 sm:px-6 sm:pt-[5.25rem]">
      <div className="mx-auto max-w-2xl space-y-4">
        <PageBackButton />
        <FloatingPanel className="p-5 sm:p-6">
          <div className="mb-4">
            <h1 className="font-display text-foreground text-2xl font-semibold tracking-tight">Connectors</h1>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Enable integrations for this journal. iCalendar publishing is available; other connectors will ship later.
            </p>
          </div>
          <div>
            {(typesQuery.data ?? []).map((ct) => {
              const jc = connectorsQuery.data?.find((c) => c.connector_type_id === ct.id);
              return (
                <div key={ct.id}>
                  <ConnectorRow
                    ct={ct}
                    journalId={activeJournalId ?? ""}
                    jc={jc}
                    onToggle={(en) => void toggle(ct.id, en)}
                  />
                  {getConnectorDefinition(ct.id)?.implemented && jc?.enabled ? (
                    <ConnectorJournalSettings connectorTypeId={ct.id} journalId={activeJournalId ?? ""} jc={jc} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </FloatingPanel>
      </div>
    </div>
  );
}
