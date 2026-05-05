import { isValidMapBbox, type MapBbox } from "@/lib/map-view-params";

export type PhotonPlace = {
  id: string;
  /** Best short label for the list row (ties to the search query when possible). */
  primaryName: string;
  /** Full address / place line (detail). */
  fullLabel: string;
  lat: number;
  lng: number;
  /** Photon/OSM extent when present — used to fit the map more tightly than a point zoom. */
  bbox?: MapBbox;
};

type PhotonResponse = {
  features?: {
    /** GeoJSON Feature bbox: west, south, east, north (minLon, minLat, maxLon, maxLat). */
    bbox?: [number, number, number, number];
    geometry?: { type?: string; coordinates?: [number, number] };
    properties?: {
      name?: string;
      street?: string;
      city?: string;
      town?: string;
      village?: string;
      state?: string;
      country?: string;
      type?: string;
      /** Some Photon builds expose OSM extent as four numbers. */
      extent?: unknown;
    };
  }[];
};

type PhotonProps = NonNullable<
  PhotonResponse["features"]
>[number]["properties"];

export function photonLabel(props: PhotonProps | undefined): string {
  if (!props) return "Place";
  const parts: string[] = [];
  const primary = props.name ?? props.street;
  if (primary) parts.push(primary);
  const locality = props.city ?? props.town ?? props.village ?? props.state;
  if (locality && locality !== primary) parts.push(locality);
  if (props.country) parts.push(props.country);
  const joined = parts.filter(Boolean).join(", ");
  return joined || "Place";
}

/** Short row title: prefer the smallest field that contains the query, else a sensible default. */
export function photonPrimaryTitle(
  query: string,
  props: PhotonProps | undefined,
  fullLabel: string,
): string {
  const q = query.trim().toLowerCase();
  const full = fullLabel.trim();
  if (!q) {
    return (
      props?.name?.trim() ||
      props?.street?.trim() ||
      full.split(",")[0]?.trim() ||
      full ||
      "Place"
    );
  }

  const candidates: string[] = [];
  const push = (s: string | undefined) => {
    const t = s?.trim();
    if (t) candidates.push(t);
  };
  push(props?.name);
  push(props?.street);
  push(props?.village);
  push(props?.town);
  push(props?.city);
  push(props?.state);
  push(props?.country);

  const matching = candidates.filter((c) => c.toLowerCase().includes(q));
  if (matching.length > 0) {
    matching.sort((a, b) => a.length - b.length);
    return matching[0]!;
  }

  const prefix = candidates.find((c) => c.toLowerCase().startsWith(q));
  if (prefix) return prefix;

  for (const segment of full
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)) {
    if (segment.toLowerCase().includes(q)) return segment;
  }

  return (
    props?.name?.trim() ||
    props?.street?.trim() ||
    full.split(",")[0]?.trim() ||
    full ||
    "Place"
  );
}

type PhotonFeature = NonNullable<PhotonResponse["features"]>[number];

/**
 * Photon/OSM bbox arrays pair longitudes at indices 0 & 2 and latitudes at 1 & 3.
 * Order may be GeoJSON [west,south,east,north] or [west,north,east,south]; min/max fixes both.
 */
function bboxFromLonLatQuadruple(
  nums: readonly [number, number, number, number],
): MapBbox {
  return {
    west: Math.min(nums[0], nums[2]),
    east: Math.max(nums[0], nums[2]),
    south: Math.min(nums[1], nums[3]),
    north: Math.max(nums[1], nums[3]),
  };
}

function photonFeatureToBbox(f: PhotonFeature): MapBbox | undefined {
  const raw = f.bbox;
  if (Array.isArray(raw) && raw.length === 4) {
    const nums = raw.map((x) => Number(x));
    if (nums.every((n) => Number.isFinite(n))) {
      const box = bboxFromLonLatQuadruple(
        nums as [number, number, number, number],
      );
      if (isValidMapBbox(box)) return box;
    }
  }

  const ext = f.properties?.extent;
  if (Array.isArray(ext) && ext.length === 4) {
    const nums = ext.map((x) => Number(x));
    if (nums.every((n) => Number.isFinite(n))) {
      const box = bboxFromLonLatQuadruple(
        nums as [number, number, number, number],
      );
      if (isValidMapBbox(box)) return box;
    }
  }

  return undefined;
}

/** Komoot Photon — public, no API key; usable from the browser (CORS). */
export async function searchPhotonPlaces(
  query: string,
): Promise<PhotonPlace[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "8");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Geocoding request failed");

  const data = (await res.json()) as PhotonResponse;
  const features = data.features ?? [];
  const out: PhotonPlace[] = [];

  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    const coords = f.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    const [lng, lat] = coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const fullLabel = photonLabel(f.properties);
    const primaryName = photonPrimaryTitle(q, f.properties, fullLabel);
    const bbox = photonFeatureToBbox(f);
    out.push({
      id: `photon-${i}-${lng.toFixed(4)},${lat.toFixed(4)}`,
      primaryName,
      fullLabel,
      lat,
      lng,
      ...(bbox ? { bbox } : {}),
    });
  }

  return out;
}

/** Reverse geocode coordinates to a single friendly label (Photon). */
export async function reversePhotonLocationLabel(
  lat: number,
  lng: number,
): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const url = new URL("https://photon.komoot.io/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("lang", "en");

  const res = await fetch(url.toString());
  if (!res.ok) return null;

  const data = (await res.json()) as PhotonResponse;
  const f = data.features?.[0];
  if (!f?.geometry?.coordinates) return null;
  const label = photonLabel(f.properties).trim();
  return label || null;
}
