/** Map camera in the URL: sharable and restored when returning from other routes. */

export const MAP_VIEW_PARAM = {
  lat: "lat",
  lng: "lng",
  zoom: "zoom",
  /** West,south,east,north (WGS84), optional — fit map to this extent. */
  bbox: "bbox",
  /** Open map sidebar for this trace (UUID). */
  trace: "trace",
  /** Comma-separated URL tag slugs (OR filter within the journal). */
  filter: "filter",
  /** Legacy: comma-separated tag UUIDs (still read when present). */
  tags: "tags",
} as const;

/** Tag slugs persisted in URL `filter=` (aligned with Postgres `tags.slug` check constraint). */
export const TAG_FILTER_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseFilterTagSlugsFromSearchParams(
  searchParams: URLSearchParams,
): Set<string> {
  const raw = searchParams.get(MAP_VIEW_PARAM.filter)?.trim();
  if (!raw) return new Set();
  const out = new Set<string>();
  for (const part of raw.split(",")) {
    const slug = part.trim().toLowerCase();
    if (slug && TAG_FILTER_SLUG_RE.test(slug)) out.add(slug);
  }
  return out;
}

/** Zoom used when focusing the map on a single trace (deep links / search). */
export const TRACE_FOCUS_ZOOM = 10;

export const TRACE_ID_PARAM_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseSelectedTraceIdFromSearchParams(
  searchParams: URLSearchParams,
): string | null {
  const raw = searchParams.get(MAP_VIEW_PARAM.trace)?.trim();
  if (!raw) return null;
  if (!TRACE_ID_PARAM_RE.test(raw)) return null;
  return raw;
}

export function parseFilterTagIdsFromSearchParams(
  searchParams: URLSearchParams,
): Set<string> {
  const raw = searchParams.get(MAP_VIEW_PARAM.tags)?.trim();
  if (!raw) return new Set();
  const out = new Set<string>();
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (id && TRACE_ID_PARAM_RE.test(id)) out.add(id);
  }
  return out;
}

/** Resolves UUID `tags` plus slug `filter` into tag ids for the loaded journal tags list. */
export function resolveFilterTagIdsFromSearchParams(
  searchParams: URLSearchParams,
  tags: { id: string; slug: string }[],
): Set<string> {
  const fromUuid = parseFilterTagIdsFromSearchParams(searchParams);
  const slugSet = parseFilterTagSlugsFromSearchParams(searchParams);
  const out = new Set<string>(fromUuid);
  for (const t of tags) {
    if (slugSet.has(t.slug.toLowerCase())) out.add(t.id);
  }
  return out;
}

/** Persist filter as lowercase tag slugs; drops legacy UUID `tags` key. */
export function applyFilterTagsToSearchParams(
  searchParams: URLSearchParams,
  tagIds: Set<string>,
  tags: { id: string; slug: string }[],
): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  next.delete(MAP_VIEW_PARAM.tags);
  next.delete(MAP_VIEW_PARAM.filter);
  if (tagIds.size === 0) return next;
  const slugById = new Map(tags.map((t) => [t.id, t.slug]));
  const slugs = [...tagIds]
    .map((id) => slugById.get(id))
    .filter((s): s is string => Boolean(s && TAG_FILTER_SLUG_RE.test(s)))
    .map((s) => s.toLowerCase());
  slugs.sort();
  if (slugs.length === 0) return next;
  next.set(MAP_VIEW_PARAM.filter, slugs.join(","));
  return next;
}

/** Removes tag filter keys (used when switching journals). */
export function stripJournalTagFiltersFromSearchParams(
  searchParams: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  next.delete(MAP_VIEW_PARAM.filter);
  next.delete(MAP_VIEW_PARAM.tags);
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

/** Geographic bounding box (west/south/east/north in degrees). */
export type MapBbox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export function isValidMapBbox(b: MapBbox): boolean {
  const { west, south, east, north } = b;
  if (![west, south, east, north].every((x) => Number.isFinite(x)))
    return false;
  if (west >= east || south >= north) return false;
  if (south < -90 || north > 90 || west < -180 || east > 180) return false;
  return true;
}

export function normalizeBboxForUrl(b: MapBbox): MapBbox {
  return {
    west: Number(b.west.toFixed(5)),
    south: Number(b.south.toFixed(5)),
    east: Number(b.east.toFixed(5)),
    north: Number(b.north.toFixed(5)),
  };
}

export function bboxToSyncKey(b: MapBbox): string {
  const n = normalizeBboxForUrl(b);
  return `${n.west},${n.south},${n.east},${n.north}`;
}

export function parseMapBboxFromSearchParams(
  searchParams: URLSearchParams,
): MapBbox | null {
  const raw = searchParams.get(MAP_VIEW_PARAM.bbox)?.trim();
  if (!raw) return null;
  const parts = raw.split(",").map((s) => Number(s.trim()));
  if (parts.length !== 4 || parts.some((x) => !Number.isFinite(x))) return null;
  const [west, south, east, north] = parts;
  const b = { west, south, east, north };
  return isValidMapBbox(b) ? b : null;
}

/** Set or remove `bbox` (comma-separated west,south,east,north). */
export function applyMapBboxToSearchParams(
  searchParams: URLSearchParams,
  bbox: MapBbox | null,
): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  if (bbox == null || !isValidMapBbox(bbox)) {
    next.delete(MAP_VIEW_PARAM.bbox);
    return next;
  }
  const n = normalizeBboxForUrl(bbox);
  next.set(MAP_VIEW_PARAM.bbox, `${n.west},${n.south},${n.east},${n.north}`);
  return next;
}

export function stripMapBboxFromSearchParams(
  searchParams: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  next.delete(MAP_VIEW_PARAM.bbox);
  return next;
}

export function parseMapCameraFromSearchParams(
  searchParams: URLSearchParams,
): MapCamera | null {
  const latRaw = searchParams.get(MAP_VIEW_PARAM.lat);
  const lngRaw = searchParams.get(MAP_VIEW_PARAM.lng);
  const zoomRaw = searchParams.get(MAP_VIEW_PARAM.zoom);
  // Missing keys must not parse as 0 — `Number(null)` is 0.
  if (latRaw == null || lngRaw == null || zoomRaw == null) return null;
  if (latRaw.trim() === "" || lngRaw.trim() === "" || zoomRaw.trim() === "")
    return null;

  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  const zoom = Number(zoomRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(zoom))
    return null;
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
export function applyMapCameraToSearchParams(
  searchParams: URLSearchParams,
  c: MapCamera,
): URLSearchParams {
  const n = normalizeCameraForUrl(c);
  const next = new URLSearchParams(searchParams);
  next.set(MAP_VIEW_PARAM.lat, String(n.lat));
  next.set(MAP_VIEW_PARAM.lng, String(n.lng));
  next.set(MAP_VIEW_PARAM.zoom, String(n.zoom));
  return next;
}
