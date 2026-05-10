/** Shape stored in `plugin_entity_data.data` for `plugin_type_id = spotify`, `entity_type = trace`. */
export type SpotifyTracePayload = {
  schemaVersion: 1;
  /** Trace period used for this snapshot (YYYY-MM-DD). */
  periodStart: string | null;
  periodEnd: string | null;
  syncedAt: string;
  limitedByPagination: boolean;
  scannedPages: number;
  playsInRange: number;
  tracks: SpotifyTraceTrackRow[];
};

export type SpotifyTraceTrackRow = {
  trackId: string;
  title: string;
  openUrl: string;
  playCount: number;
};

export function parseSpotifyTracePayload(
  raw: unknown,
): SpotifyTracePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== 1) return null;
  if (!Array.isArray(o.tracks)) return null;
  return raw as SpotifyTracePayload;
}
