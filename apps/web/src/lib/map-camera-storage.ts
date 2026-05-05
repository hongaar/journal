import type { MapCamera } from "@/lib/map-view-params";
import { normalizeCameraForUrl } from "@/lib/map-view-params";

const STORAGE_KEY = "journal:lastMapCamera";

type StoredPayload = {
  v: 1;
  journalId: string;
  camera: MapCamera;
};

function isValidCamera(c: MapCamera): boolean {
  const { lat, lng, zoom } = c;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(zoom))
    return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (zoom < 0 || zoom > 22) return false;
  return true;
}

export function readStoredMapCamera(
  journalId: string | null,
): MapCamera | null {
  if (!journalId) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return null;
    const o = data as Partial<StoredPayload>;
    if (
      o.v !== 1 ||
      typeof o.journalId !== "string" ||
      o.journalId !== journalId
    )
      return null;
    const cam = o.camera;
    if (!cam || typeof cam !== "object") return null;
    const camera = cam as MapCamera;
    if (!isValidCamera(camera)) return null;
    return normalizeCameraForUrl(camera);
  } catch {
    return null;
  }
}

export function writeStoredMapCamera(
  journalId: string | null,
  camera: MapCamera,
): void {
  if (!journalId) return;
  const normalized = normalizeCameraForUrl(camera);
  if (!isValidCamera(normalized)) return;
  try {
    const payload: StoredPayload = { v: 1, journalId, camera: normalized };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}
