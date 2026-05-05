import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Photo } from "@/types/database";

function photoIdsKey(photos: Photo[]) {
  return photos.map((p) => `${p.id}:${p.storage_path ?? ""}`).join("|");
}

export function useTracePhotosSignedUrls(traceId: string | undefined) {
  const photosQuery = useQuery({
    queryKey: ["photos", traceId],
    queryFn: async () => {
      if (!traceId) return [];
      const { data, error } = await supabase
        .from("photos")
        .select("*")
        .eq("trace_id", traceId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Photo[];
    },
    enabled: Boolean(traceId),
  });

  const photos = useMemo(() => photosQuery.data ?? [], [photosQuery.data]);
  const idsKey = photoIdsKey(photos);

  const signedUrlsQuery = useQuery({
    queryKey: ["photo-urls", traceId, idsKey],
    queryFn: async () => {
      const out: Record<string, string> = {};
      for (const p of photos) {
        if (!p.storage_path) continue;
        const { data, error } = await supabase.storage
          .from("trace-photos")
          .createSignedUrl(p.storage_path, 3600);
        if (!error && data?.signedUrl) out[p.id] = data.signedUrl;
      }
      return out;
    },
    enabled: Boolean(traceId) && photos.length > 0,
  });

  return {
    photos,
    signedUrlByPhotoId: signedUrlsQuery.data ?? {},
    isLoading:
      photosQuery.isLoading || (photos.length > 0 && signedUrlsQuery.isLoading),
  };
}

/** Photos for many traces at once (e.g. blog list), grouped by trace_id. */
export function useJournalTracesPhotosSignedUrls(
  journalId: string | undefined,
  traceIds: string[],
) {
  const sortedIdsKey = useMemo(
    () => [...traceIds].sort().join(","),
    [traceIds],
  );

  const photosQuery = useQuery({
    queryKey: ["journal-trace-photos", journalId, sortedIdsKey],
    queryFn: async () => {
      if (!journalId || traceIds.length === 0) return [];
      const { data, error } = await supabase
        .from("photos")
        .select("*")
        .eq("journal_id", journalId)
        .in("trace_id", traceIds)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Photo[];
    },
    enabled: Boolean(journalId) && traceIds.length > 0,
  });

  const photos = useMemo(() => photosQuery.data ?? [], [photosQuery.data]);
  const idsKey = photoIdsKey(photos);

  const signedUrlsQuery = useQuery({
    queryKey: ["photo-urls-batch", journalId, idsKey],
    queryFn: async () => {
      const out: Record<string, string> = {};
      for (const p of photos) {
        if (!p.storage_path) continue;
        const { data, error } = await supabase.storage
          .from("trace-photos")
          .createSignedUrl(p.storage_path, 3600);
        if (!error && data?.signedUrl) out[p.id] = data.signedUrl;
      }
      return out;
    },
    enabled: Boolean(journalId) && photos.length > 0,
  });

  const photosByTraceId = useMemo(() => {
    const m = new Map<string, Photo[]>();
    for (const p of photos) {
      const list = m.get(p.trace_id) ?? [];
      list.push(p);
      m.set(p.trace_id, list);
    }
    return m;
  }, [photos]);

  return {
    photosByTraceId,
    signedUrlByPhotoId: signedUrlsQuery.data ?? {},
    isLoading:
      photosQuery.isLoading || (photos.length > 0 && signedUrlsQuery.isLoading),
  };
}
