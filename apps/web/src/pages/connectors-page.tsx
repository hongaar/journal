import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useJournal } from "@/providers/journal-provider";
import { getConnectorDefinition } from "@/connectors/registry";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { ConnectorType, JournalConnector } from "@/types/database";
import { FloatingPanel } from "@/components/layout/floating-panel";

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
          disabled={!journalId}
          onCheckedChange={(c) => onToggle(c === true)}
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
    const { error } = await supabase.from("journal_connectors").upsert(
      {
        journal_id: activeJournalId,
        connector_type_id: connectorTypeId,
        enabled,
        config: {},
        status: "disabled",
      },
      { onConflict: "journal_id,connector_type_id" },
    );
    if (!error) {
      await qc.invalidateQueries({ queryKey: ["journal_connectors", activeJournalId] });
    }
  }

  return (
    <div className="h-full overflow-y-auto px-3 pt-[4.75rem] pb-10 sm:px-6 sm:pt-[5.25rem]">
      <div className="mx-auto max-w-2xl">
        <FloatingPanel className="p-5 sm:p-6">
          <div className="mb-4">
            <h1 className="font-display text-foreground text-2xl font-semibold tracking-tight">Connectors</h1>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Enable integrations for this journal. Actual sync with Google Maps, OsmAnd, Google Photos, and Immich will
              ship later.
            </p>
          </div>
          <div>
            {(typesQuery.data ?? []).map((ct) => (
              <ConnectorRow
                key={ct.id}
                ct={ct}
                journalId={activeJournalId ?? ""}
                jc={connectorsQuery.data?.find((c) => c.connector_type_id === ct.id)}
                onToggle={(en) => void toggle(ct.id, en)}
              />
            ))}
          </div>
        </FloatingPanel>
      </div>
    </div>
  );
}
