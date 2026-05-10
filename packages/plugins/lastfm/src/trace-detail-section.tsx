import type { TraceContextProps } from "@curolia/plugin-contract";
import { Card, CardContent, CardHeader, CardTitle } from "@curolia/ui/card";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Loader2, Music } from "lucide-react";
import { useEffect, useMemo } from "react";
import {
  LASTFM_SYNC_STALE_TIME_MS,
  LASTFM_TOP_TRACKS_LIMIT,
} from "./constants";
import { LastfmIcon } from "./icon";
import { lastfmPluginMeta } from "./plugin-meta";
import {
  lastfmTraceSyncQueryKey,
  pluginEntityDataRowQueryKey,
} from "./query-keys";
import { lastfmSyncTraceListening } from "./lastfm-edge";
import { parseLastfmTracePayload } from "./lastfm-trace-data";

function hasLastfmUsername(config: unknown): boolean {
  if (!config || typeof config !== "object") return false;
  const lf = (config as { lastfm?: unknown }).lastfm;
  if (!lf || typeof lf !== "object") return false;
  const u = (lf as { username?: unknown }).username;
  return typeof u === "string" && u.trim().length > 0;
}

export function LastfmTraceDetailSection({
  supabase,
  userId,
  traceId,
  traceDate,
  traceEndDate,
}: TraceContextProps) {
  const qc = useQueryClient();
  const pid = lastfmPluginMeta.typeId;

  const userPluginQuery = useQuery({
    queryKey: ["user_plugins", userId, pid],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("user_plugins")
        .select("enabled, config")
        .eq("user_id", userId)
        .eq("plugin_type_id", pid)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(userId),
    placeholderData: keepPreviousData,
  });

  const pluginReady =
    Boolean(userPluginQuery.data?.enabled) &&
    hasLastfmUsername(userPluginQuery.data?.config) &&
    lastfmPluginMeta.implemented;

  const hasPeriod = Boolean(traceDate?.trim());

  const dataRowQueryKey = useMemo(
    () => pluginEntityDataRowQueryKey(pid, "trace", traceId),
    [pid, traceId],
  );

  const syncQuery = useQuery({
    queryKey: lastfmTraceSyncQueryKey(traceId, traceDate, traceEndDate),
    queryFn: () => lastfmSyncTraceListening(supabase, traceId),
    enabled: pluginReady && hasPeriod,
    staleTime: LASTFM_SYNC_STALE_TIME_MS,
    retry: false,
  });

  const rowQuery = useQuery({
    queryKey: dataRowQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plugin_entity_data")
        .select("data, updated_at")
        .eq("entity_type", "trace")
        .eq("entity_id", traceId)
        .eq("plugin_type_id", pid)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: pluginReady,
  });

  useEffect(() => {
    if (!syncQuery.isSuccess || !syncQuery.data) return;
    const d = syncQuery.data;
    if ("synced" in d && d.synced) {
      void qc.invalidateQueries({ queryKey: [...dataRowQueryKey] });
    }
    if ("skippedReason" in d && d.skippedReason === "no_trace_date") {
      void qc.invalidateQueries({ queryKey: [...dataRowQueryKey] });
    }
  }, [syncQuery.isSuccess, syncQuery.data, qc, dataRowQueryKey]);

  if (!pluginReady) return null;

  if (!hasPeriod) {
    return (
      <Card className="border-border/60 bg-muted/10 border shadow-none">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
          <LastfmIcon className="text-muted-foreground size-5 shrink-0" />
          <CardTitle className="font-display text-base font-normal tracking-tight">
            Last.fm
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Add a date to this trace to load your most-scrobbled tracks on
            Last.fm during that period (up to {LASTFM_TOP_TRACKS_LIMIT}).
          </p>
        </CardContent>
      </Card>
    );
  }

  const rawData = rowQuery.data?.data;
  const payload = parseLastfmTracePayload(rawData);
  const busy = syncQuery.isFetching || rowQuery.isFetching;
  const syncFailed = syncQuery.isError;
  const errMsg =
    syncQuery.error instanceof Error ? syncQuery.error.message : null;

  return (
    <Card className="border-border/60 bg-muted/10 border shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <LastfmIcon className="text-muted-foreground size-5 shrink-0" />
          <CardTitle className="font-display text-base font-normal tracking-tight">
            Last.fm
          </CardTitle>
        </div>
        {busy ? (
          <Loader2 className="text-muted-foreground size-4 animate-spin" />
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {syncFailed ? (
          <p className="text-destructive text-sm">
            {errMsg ?? "Could not sync Last.fm data."}
          </p>
        ) : null}
        {!payload?.tracks?.length && !busy && !syncFailed ? (
          <div className="text-muted-foreground space-y-2 text-sm leading-relaxed">
            <p>
              No scrobbles in this trace&apos;s date range were returned from
              Last.fm for your username.
            </p>
            <p className="text-xs">
              Trace dates use UTC calendar boundaries (midnight–end of day UTC).
              If your username or API access changed, check Plugins → Last.fm.
            </p>
          </div>
        ) : null}
        {payload?.tracks?.length ? (
          <ul className="space-y-2">
            {payload.tracks.map((row) => (
              <li key={row.trackId}>
                <a
                  href={row.openUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground inline-flex items-start gap-2 text-sm font-medium underline-offset-4 hover:underline"
                >
                  <Music className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <span>
                    {row.title}
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · {row.playCount}×
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {payload?.limitedByPagination ? (
          <p className="text-muted-foreground text-xs">
            Partial history: pagination cap reached; counts may not reflect
            every scrobble in this window.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
