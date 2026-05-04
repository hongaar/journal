import type { Photo } from "@/types/database";

export type TracePhotoLightboxItem = { id: string; url: string };

export function photosToLightboxItems(
  photos: Photo[],
  signedUrlByPhotoId: Record<string, string>,
): TracePhotoLightboxItem[] {
  const out: TracePhotoLightboxItem[] = [];
  for (const p of photos) {
    const url = signedUrlByPhotoId[p.id];
    if (url) out.push({ id: p.id, url });
  }
  return out;
}
