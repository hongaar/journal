import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Json } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { icalFeedPublicUrl } from "@/lib/ical-feed-url";
import { journalPluginConfigRecord, mergeJournalPluginConfig } from "@curolia/plugin-contract";
import { ICAL_PLUGIN_ID, parseIcalJournalConfig } from "@curolia/plugin-ical";
import type { JournalPlugin } from "@/types/database";
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

export function IcalPluginJournalSettings({
  journalId,
  jp,
  pluginGloballyEnabled,
  readOnly = false,
}: {
  journalId: string;
  jp: JournalPlugin | undefined;
  pluginGloballyEnabled: boolean;
  readOnly?: boolean;
}) {
  const qc = useQueryClient();
  const parsed = parseIcalJournalConfig(journalPluginConfigRecord(jp));

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
    enabled: Boolean(journalId) && pluginGloballyEnabled && parsed.publishFeed,
  });

  const saveConfig = useMutation({
    mutationFn: async (next: { publishFeed: boolean }) => {
      let token: string | null = tokenQuery.data ?? null;
      if (next.publishFeed) {
        token = await ensureIcalFeedToken(journalId);
      }
      const config = mergeJournalPluginConfig(ICAL_PLUGIN_ID, journalPluginConfigRecord(jp), {
        publishFeed: next.publishFeed,
      }) as Json;
      const { error } = await supabase.from("journal_plugins").upsert(
        {
          journal_id: journalId,
          plugin_type_id: ICAL_PLUGIN_ID,
          enabled: true,
          config,
          status: "connected",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "journal_id,plugin_type_id" },
      );
      if (error) throw error;
      return { token: next.publishFeed ? token : null };
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["journal_plugins", journalId] });
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
          disabled={readOnly || saveConfig.isPending || !pluginGloballyEnabled}
          onCheckedChange={(c) => void saveConfig.mutateAsync({ publishFeed: c === true })}
        />
      </div>
      {!pluginGloballyEnabled ? (
        <p className="text-muted-foreground text-xs">
          Turn on iCalendar under Plugins (user menu) to publish a feed for this journal.
        </p>
      ) : null}
      {parsed.publishFeed && pluginGloballyEnabled ? (
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
