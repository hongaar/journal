import { lastfmPluginMeta } from "./plugin-meta";

/**
 * React Query key for Last.fm Edge sync. Includes trace dates so a new fetch runs when
 * the shell passes updated dates after save.
 */
export function lastfmTraceSyncQueryKey(
  traceId: string,
  traceDate: string | null | undefined,
  traceEndDate: string | null | undefined,
) {
  return [
    "lastfm_trace_sync",
    lastfmPluginMeta.typeId,
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
