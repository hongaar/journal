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
  SPOTIFY_SYNC_STALE_TIME_MS,
  SPOTIFY_TOP_TRACKS_LIMIT,
} from "./constants";
import { SpotifyIcon } from "./icon";
import { spotifyPluginMeta } from "./plugin-meta";
import {
  pluginEntityDataRowQueryKey,
  spotifyTraceSyncQueryKey,
} from "./query-keys";
import { spotifySyncTraceListening } from "./spotify-edge";
import { parseSpotifyTracePayload } from "./spotify-trace-data";

export function SpotifyTraceDetailSection({
  supabase,
  userId,
  traceId,
  traceDate,
  traceEndDate,
}: TraceContextProps) {
  const qc = useQueryClient();
  const pid = spotifyPluginMeta.typeId;

  const userPluginQuery = useQuery({
    queryKey: ["user_plugins", userId, pid],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("user_plugins")
        .select("enabled, status")
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
    userPluginQuery.data?.status === "connected" &&
    spotifyPluginMeta.implemented;

  const hasPeriod = Boolean(traceDate?.trim());

  const dataRowQueryKey = useMemo(
    () => pluginEntityDataRowQueryKey(pid, "trace", traceId),
    [pid, traceId],
  );

  const syncQuery = useQuery({
    queryKey: spotifyTraceSyncQueryKey(traceId, traceDate, traceEndDate),
    queryFn: () => spotifySyncTraceListening(supabase, traceId),
    enabled: pluginReady && hasPeriod,
    staleTime: SPOTIFY_SYNC_STALE_TIME_MS,
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
          <SpotifyIcon className="text-muted-foreground size-5 shrink-0" />
          <CardTitle className="font-display text-base font-normal tracking-tight">
            Spotify
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Add a date to this trace to load your most-played tracks on Spotify
            during that period (up to {SPOTIFY_TOP_TRACKS_LIMIT}).
          </p>
        </CardContent>
      </Card>
    );
  }

  const rawData = rowQuery.data?.data;
  const payload = parseSpotifyTracePayload(rawData);
  const busy = syncQuery.isFetching || rowQuery.isFetching;
  const syncFailed = syncQuery.isError;
  const errMsg =
    syncQuery.error instanceof Error ? syncQuery.error.message : null;

  return (
    <Card className="border-border/60 bg-muted/10 border shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <SpotifyIcon className="text-muted-foreground size-5 shrink-0" />
          <CardTitle className="font-display text-base font-normal tracking-tight">
            Spotify
          </CardTitle>
        </div>
        {busy ? (
          <Loader2 className="text-muted-foreground size-4 animate-spin" />
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {syncFailed ? (
          <p className="text-destructive text-sm">
            {errMsg ?? "Could not sync Spotify data."}
          </p>
        ) : null}
        {!payload?.tracks?.length && !busy && !syncFailed ? (
          <div className="text-muted-foreground space-y-2 text-sm leading-relaxed">
            <p>
              No streams in this trace&apos;s dates matched Spotify&apos;s
              recently-played feed from the Web API.
            </p>
            <p className="text-xs">
              Spotify’s Web API only returns a shallow, rolling “recently
              played” stream—not full playback history by calendar day—so
              listening from older periods usually isn’t visible here. Trace
              dates use UTC calendar boundaries (midnight–end of day UTC).
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
            Partial history: pagination cap reached; counts may not reflect your
            full listening for this window.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
