import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Json } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { icalFeedPublicUrl } from "@/lib/ical-feed-url";
import { journalConnectorConfigRecord, mergeJournalConnectorConfig } from "@curolia/connector-contract";
import { ICAL_CONNECTOR_ID, parseIcalJournalConfig } from "@curolia/connector-ical";
import type { JournalConnector } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Copy } from "lucide-react";
import { toast } from "sonner";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";

async function ensureIcalFeedToken(journalId: string): Promise<string> {
  const first = await supabase.from("journal_ical_feed_tokens").select("token").eq("journal_id", journalId).maybeSingle();
  if (first.error) throw first.error;
  if (first.data?.token) return first.data.token;

  const ins = await supabase.from("journal_ical_feed_tokens").insert({ journal_id: journalId }).select("token").single();
  if (!ins.error && ins.data?.token) return ins.data.token;

  const again = await supabase.from("journal_ical_feed_tokens").select("token").eq("journal_id", journalId).single();
  if (again.error) throw ins.error ?? again.error;
  if (!again.data?.token) throw new Error("Could not create feed token");
  return again.data.token;
}

export function IcalConnectorJournalSettings({
  journalId,
  jc,
  readOnly = false,
}: {
  journalId: string;
  jc: JournalConnector;
  readOnly?: boolean;
}) {
  const qc = useQueryClient();
  const parsed = parseIcalJournalConfig(journalConnectorConfigRecord(jc));

  const tokenQuery = useQuery({
    queryKey: ["journal_ical_feed_token", journalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_ical_feed_tokens")
        .select("token")
        .eq("journal_id", journalId)
        .maybeSingle();
      if (error) throw error;
      return data?.token ?? null;
    },
    enabled: Boolean(journalId) && jc.enabled && parsed.publishFeed,
  });

  const saveConfig = useMutation({
    mutationFn: async (next: { publishFeed: boolean }) => {
      let token: string | null = tokenQuery.data ?? null;
      if (next.publishFeed) {
        token = await ensureIcalFeedToken(journalId);
      }
      const config = mergeJournalConnectorConfig(ICAL_CONNECTOR_ID, journalConnectorConfigRecord(jc), {
        publishFeed: next.publishFeed,
      }) as Json;
      const { error } = await supabase
        .from("journal_connectors")
        .update({
          config,
          updated_at: new Date().toISOString(),
        })
        .eq("journal_id", journalId)
        .eq("connector_type_id", ICAL_CONNECTOR_ID);
      if (error) throw error;
      return { token: next.publishFeed ? token : null };
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["journal_connectors", journalId] });
      await qc.invalidateQueries({ queryKey: ["journal_ical_feed_token", journalId] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Could not update iCalendar settings");
    },
  });

  const feedUrl =
    parsed.publishFeed && tokenQuery.data && supabaseUrl
      ? icalFeedPublicUrl(supabaseUrl, tokenQuery.data)
      : null;

  return (
    <div className="border-border/50 mt-3 space-y-4 rounded-xl border bg-foreground/[0.02] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Label htmlFor="ical-publish" className="text-foreground font-medium">
            Publish as iCalendar file
          </Label>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
            Anyone with the secret link can subscribe in Apple Calendar, Google Calendar, etc. The URL is not guessable.
          </p>
        </div>
        <Switch
          id="ical-publish"
          checked={parsed.publishFeed}
          disabled={readOnly || saveConfig.isPending || !jc.enabled}
          onCheckedChange={(c) => void saveConfig.mutateAsync({ publishFeed: c === true })}
        />
      </div>
      {!jc.enabled ? (
        <p className="text-muted-foreground text-xs">Turn on the connector above to publish a feed.</p>
      ) : null}
      {parsed.publishFeed && jc.enabled ? (
        <div className="space-y-2">
          {tokenQuery.isLoading ? (
            <p className="text-muted-foreground text-xs">Preparing feed URL…</p>
          ) : feedUrl ? (
            <>
              <Label className="text-muted-foreground text-xs">Feed URL</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="bg-muted/60 text-foreground block max-w-full flex-1 truncate rounded-lg px-2 py-1.5 text-xs">
                  {feedUrl}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 rounded-lg"
                  onClick={() => {
                    void navigator.clipboard.writeText(feedUrl).then(() => toast.success("Copied feed URL"));
                  }}
                >
                  <Copy className="mr-1.5 size-3.5" />
                  Copy
                </Button>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-xs">Set up the Supabase project URL in the app environment to show the link.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
