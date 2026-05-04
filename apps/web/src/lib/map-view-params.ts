/** Map camera in the URL: sharable and restored when returning from other routes. */

export const MAP_VIEW_PARAM = {
  lat: "lat",
  lng: "lng",
  zoom: "zoom",
  /** Open map sidebar for this trace (UUID). */
  trace: "trace",
  /** Comma-separated tag UUIDs (OR filter). */
  tags: "tags",
} as const;

export const TRACE_ID_PARAM_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseSelectedTraceIdFromSearchParams(searchParams: URLSearchParams): string | null {
  const raw = searchParams.get(MAP_VIEW_PARAM.trace)?.trim();
  if (!raw) return null;
  if (!TRACE_ID_PARAM_RE.test(raw)) return null;
  return raw;
}

export function parseFilterTagIdsFromSearchParams(searchParams: URLSearchParams): Set<string> {
  const raw = searchParams.get(MAP_VIEW_PARAM.tags)?.trim();
  if (!raw) return new Set();
  const out = new Set<string>();
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (id && TRACE_ID_PARAM_RE.test(id)) out.add(id);
  }
  return out;
}

/** Set or remove `tags` while keeping other params. */
export function applyFilterTagIdsToSearchParams(searchParams: URLSearchParams, tagIds: Set<string>): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  if (tagIds.size === 0) {
    next.delete(MAP_VIEW_PARAM.tags);
    return next;
  }
  const sorted = [...tagIds].filter((id) => TRACE_ID_PARAM_RE.test(id)).sort();
  if (sorted.length === 0) {
    next.delete(MAP_VIEW_PARAM.tags);
    return next;
  }
  next.set(MAP_VIEW_PARAM.tags, sorted.join(","));
  return next;
}

/** Set or remove `trace` while keeping other params (e.g. camera). */
export function applySelectedTraceToSearchParams(
  searchParams: URLSearchParams,
  traceId: string | null,
): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  if (traceId == null || traceId === "") {
    next.delete(MAP_VIEW_PARAM.trace);
  } else {
    next.set(MAP_VIEW_PARAM.trace, traceId);
  }
  return next;
}

export type MapCamera = { lat: number; lng: number; zoom: number };

export function parseMapCameraFromSearchParams(searchParams: URLSearchParams): MapCamera | null {
  const latRaw = searchParams.get(MAP_VIEW_PARAM.lat);
  const lngRaw = searchParams.get(MAP_VIEW_PARAM.lng);
  const zoomRaw = searchParams.get(MAP_VIEW_PARAM.zoom);
  // Missing keys must not parse as 0 — `Number(null)` is 0.
  if (latRaw == null || lngRaw == null || zoomRaw == null) return null;
  if (latRaw.trim() === "" || lngRaw.trim() === "" || zoomRaw.trim() === "") return null;

  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  const zoom = Number(zoomRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(zoom)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (zoom < 0 || zoom > 22) return null;
  return { lat, lng, zoom };
}

export function normalizeCameraForUrl(c: MapCamera): MapCamera {
  return {
    lat: Number(c.lat.toFixed(5)),
    lng: Number(c.lng.toFixed(5)),
    zoom: Number(c.zoom.toFixed(2)),
  };
}

export function cameraToSyncKey(c: MapCamera): string {
  const n = normalizeCameraForUrl(c);
  return `${n.lng},${n.lat},${n.zoom}`;
}

/** Apply camera to existing params (preserves unrelated keys). */
export function applyMapCameraToSearchParams(searchParams: URLSearchParams, c: MapCamera): URLSearchParams {
  const n = normalizeCameraForUrl(c);
  const next = new URLSearchParams(searchParams);
  next.set(MAP_VIEW_PARAM.lat, String(n.lat));
  next.set(MAP_VIEW_PARAM.lng, String(n.lng));
  next.set(MAP_VIEW_PARAM.zoom, String(n.zoom));
  return next;
}
