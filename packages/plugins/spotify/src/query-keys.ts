import { spotifyPluginMeta } from "./plugin-meta";

/**
 * React Query key for Spotify Edge sync. Includes trace dates so a new fetch runs when
 * the shell passes updated dates after save (no extra invalidation logic in the web app).
 */
export function spotifyTraceSyncQueryKey(
  traceId: string,
  traceDate: string | null | undefined,
  traceEndDate: string | null | undefined,
) {
  return [
    "spotify_trace_sync",
    spotifyPluginMeta.typeId,
    traceId,
    traceDate ?? "",
    traceEndDate ?? "",
  ] as const;
}

/** Cache key for reading `plugin_entity_data` rows client-side. */
export function pluginEntityDataRowQueryKey(
  pluginTypeId: string,
  entityType: string,
  entityId: string,
) {
  return ["plugin_entity_data", pluginTypeId, entityType, entityId] as const;
}
