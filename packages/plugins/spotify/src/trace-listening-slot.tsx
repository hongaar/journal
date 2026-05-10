import type { TracePhotoImportSlotProps } from "@curolia/plugin-contract";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { spotifyPluginMeta } from "./plugin-meta";
import { spotifySyncTopTracksForTrace } from "./spotify-edge";

/**
 * When the plugin is enabled and Spotify is linked, loads top tracks for the trace
 * date range (server-side, with pagination caps) and adds Spotify track links.
 * Renders nothing (side-effect only).
 */
export function SpotifyTraceListeningSlot({
  supabase,
  userId,
  traceId,
  traceDate,
  traceEndDate,
}: TracePhotoImportSlotProps) {
  const qc = useQueryClient();
  const lastInvalidateSig = useRef<string | null>(null);

  const userPluginQuery = useQuery({
    queryKey: ["user_plugins", userId, spotifyPluginMeta.typeId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("user_plugins")
        .select("enabled, status")
        .eq("user_id", userId)
        .eq("plugin_type_id", spotifyPluginMeta.typeId)
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

  const syncQuery = useQuery({
    queryKey: [
      "spotify_trace_top_tracks",
      traceId,
      traceDate ?? "",
      traceEndDate ?? "",
    ],
    queryFn: () => spotifySyncTopTracksForTrace(supabase, traceId),
    enabled: pluginReady && hasPeriod,
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (!syncQuery.isSuccess || !syncQuery.data) return;
    const d = syncQuery.data;
    const sig = `${traceId}:${d.added}:${d.skippedExisting}:${d.playsInRange}:${d.scannedPages}:${d.limitedByPagination}`;
    if (lastInvalidateSig.current === sig) return;
    lastInvalidateSig.current = sig;
    void qc.invalidateQueries({ queryKey: ["trace-links", traceId] });
  }, [syncQuery.isSuccess, syncQuery.data, traceId, qc]);

  if (!pluginReady || !hasPeriod) return null;

  if (syncQuery.isError) {
    console.warn("spotify trace sync failed", syncQuery.error);
  }

  return null;
}
