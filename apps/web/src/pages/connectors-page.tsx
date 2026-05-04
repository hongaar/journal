import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Json } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { getConnectorDefinition } from "@/connectors/registry";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { ConnectorType, UserConnector } from "@/types/database";
import { FloatingPanel } from "@/components/layout/floating-panel";
import { PageBackButton } from "@/components/layout/page-back-button";

function ConnectorRow({
  ct,
  uc,
  onToggle,
  toggleDisabled,
}: {
  ct: ConnectorType;
  uc: UserConnector | undefined;
  onToggle: (enabled: boolean) => void;
  toggleDisabled: boolean;
}) {
  const def = getConnectorDefinition(ct.id);
  const implemented = def?.implemented ?? false;
  const enabled = uc?.enabled ?? false;

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

export function ConnectorsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

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
    enabled: Boolean(user),
  });

  async function toggle(connectorTypeId: string, enabled: boolean) {
    if (!user) return;
    const uc = userConnectorsQuery.data?.find((c) => c.connector_type_id === connectorTypeId);
    const existingConfig = (uc?.config ?? {}) as Record<string, unknown>;
    const config = existingConfig as Json;
    const { error } = await supabase.from("user_connectors").upsert(
      {
        user_id: user.id,
        connector_type_id: connectorTypeId,
        enabled,
        config,
        status: enabled ? "connected" : "disabled",
      },
      { onConflict: "user_id,connector_type_id" },
    );
    if (!error) {
      await qc.invalidateQueries({ queryKey: ["user_connectors", user.id] });
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
              Choose which integrations are available for your account (for example signing in to Google Photos).
              Journal-specific options—such as publishing an iCalendar feed—are configured in each journal&apos;s settings.
            </p>
          </div>
          <div>
            {(typesQuery.data ?? []).map((ct) => {
              const uc = userConnectorsQuery.data?.find((c) => c.connector_type_id === ct.id);
              return (
                <ConnectorRow
                  key={ct.id}
                  ct={ct}
                  uc={uc}
                  onToggle={(en) => void toggle(ct.id, en)}
                  toggleDisabled={!user || userConnectorsQuery.isLoading}
                />
              );
            })}
          </div>
        </FloatingPanel>
      </div>
    </div>
  );
}
