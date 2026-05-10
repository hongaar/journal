/** Shape stored in `plugin_entity_data.data` for `plugin_type_id = lastfm`, `entity_type = trace`. */
export type LastfmTracePayload = {
  schemaVersion: 1;
  periodStart: string | null;
  periodEnd: string | null;
  syncedAt: string;
  limitedByPagination: boolean;
  scannedPages: number;
  playsInRange: number;
  tracks: LastfmTraceTrackRow[];
};

export type LastfmTraceTrackRow = {
  /** Stable id for UI keys — Last.fm track URL. */
  trackId: string;
  title: string;
  openUrl: string;
  playCount: number;
};

export function parseLastfmTracePayload(
  raw: unknown,
): LastfmTracePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== 1) return null;
  if (!Array.isArray(o.tracks)) return null;
  return raw as LastfmTracePayload;
}
