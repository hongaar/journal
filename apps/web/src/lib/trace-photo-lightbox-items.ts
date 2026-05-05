import type { Photo } from "@/types/database";

export type TracePhotoLightboxItem = { id: string; url: string; originalProductUrl?: string };

function productUrlFromRef(ref: Record<string, unknown> | null): string | undefined {
  if (!ref) return undefined;
  const u = ref.productUrl;
  return typeof u === "string" && u.length > 0 ? u : undefined;
}

export function photosToLightboxItems(
  photos: Photo[],
  signedUrlByPhotoId: Record<string, string>,
): TracePhotoLightboxItem[] {
  const out: TracePhotoLightboxItem[] = [];
  for (const p of photos) {
    const url = signedUrlByPhotoId[p.id];
    if (url) {
      const originalProductUrl = productUrlFromRef(p.external_ref);
      out.push({ id: p.id, url, ...(originalProductUrl ? { originalProductUrl } : {}) });
    }
  }
  return out;
}
