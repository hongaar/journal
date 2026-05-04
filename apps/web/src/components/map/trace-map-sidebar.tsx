import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@curolia/ui/badge";
import { Button, buttonVariants } from "@curolia/ui/button";
import { FloatingPanel } from "@/components/layout/floating-panel";
import { formatTraceLocationLine } from "@/lib/trace-dates";
import { TraceMetadataFooter } from "@/components/traces/trace-metadata-footer";
import { contrastingForeground } from "@/lib/utils";
import type { TraceWithTags } from "@/lib/trace-with-tags";
import { useTracePhotosSignedUrls } from "@/lib/use-trace-photos";
import { TracePhotoLightbox, TracePhotoThumb } from "@/components/traces/trace-photo-lightbox";
import { photosToLightboxItems } from "@/lib/trace-photo-lightbox-items";

type TraceSidebarRow = TraceWithTags & {
  creator?: { display_name: string | null } | null;
  modifier?: { display_name: string | null } | null;
};

type TraceMapSidebarProps = {
  traceId: string;
  journalId: string | null;
  onClose: () => void;
};

export function TraceMapSidebar({ traceId, journalId, onClose }: TraceMapSidebarProps) {
  const [photoLightbox, setPhotoLightbox] = useState<{ photoId: string } | null>(null);

  const traceQuery = useQuery({
    queryKey: ["trace", traceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("traces")
        .select(
          `*,
          trace_tags ( tag_id, tags ( id, name, color, icon_emoji ) ),
          creator:profiles!traces_created_by_user_id_fkey ( display_name ),
          modifier:profiles!traces_modified_by_user_id_fkey ( display_name )`,
        )
        .eq("id", traceId)
        .maybeSingle();
      if (error) throw error;
      return data as TraceSidebarRow | null;
    },
    enabled: Boolean(traceId),
  });

  const trace = traceQuery.data;
  const { photos, signedUrlByPhotoId } = useTracePhotosSignedUrls(traceId);
  const wrongJournal = trace && journalId && trace.journal_id !== journalId;

  const lightboxItems = useMemo(() => photosToLightboxItems(photos, signedUrlByPhotoId), [photos, signedUrlByPhotoId]);

  const tagBadges = useMemo(() => {
    const rows = trace?.trace_tags ?? [];
    return rows.map((tt) => tt.tags).filter(Boolean) as { id: string; name: string; color: string; icon_emoji: string }[];
  }, [trace]);

  return (
    <FloatingPanel className="pointer-events-auto fixed top-[4.5rem] right-3 bottom-4 z-40 flex w-[min(calc(100vw-1.5rem),22rem)] max-w-full flex-col gap-3 overflow-hidden p-4 shadow-2xl sm:top-[5.25rem] sm:right-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-display text-foreground text-lg leading-tight font-semibold tracking-tight">
          {traceQuery.isLoading ? "Loading…" : trace?.title || "Untitled place"}
        </h2>
        <Button type="button" variant="ghost" size="icon-sm" className="shrink-0 rounded-lg" onClick={onClose} aria-label="Close">
          <X className="size-4" />
        </Button>
      </div>

      {traceQuery.isLoading ? (
        <p className="text-muted-foreground text-sm">Fetching trace…</p>
      ) : !trace || wrongJournal ? (
        <p className="text-muted-foreground text-sm">Trace not found or not in this journal.</p>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            {formatTraceLocationLine(trace.date, trace.end_date, trace.lat, trace.lng, 4)}
          </p>
          {trace.location_label ? (
            <p className="text-muted-foreground text-sm leading-snug">{trace.location_label}</p>
          ) : null}
          {tagBadges.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {tagBadges.map((t) => (
                <Badge
                  key={t.id}
                  variant="secondary"
                  className="border-0"
                  style={{ backgroundColor: t.color, color: contrastingForeground(t.color) }}
                >
                  {t.icon_emoji} {t.name}
                </Badge>
              ))}
            </div>
          ) : null}
          {trace.description ? (
            <p className="text-foreground max-h-40 overflow-y-auto text-sm whitespace-pre-wrap">{trace.description}</p>
          ) : null}
          {photos.length > 0 ? (
            <div className="min-h-0 shrink-0">
              <p className="text-muted-foreground mb-1.5 text-xs font-medium tracking-wide uppercase">Photos</p>
              <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {photos.map((p) => {
                  const url = signedUrlByPhotoId[p.id];
                  return url ? (
                    <TracePhotoThumb
                      key={p.id}
                      url={url}
                      className="border-border size-20 shrink-0 overflow-hidden rounded-lg border sm:size-24"
                      onOpen={() => setPhotoLightbox({ photoId: p.id })}
                    />
                  ) : (
                    <div key={p.id} className="bg-muted size-20 shrink-0 animate-pulse rounded-lg border sm:size-24" />
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className="mt-auto flex flex-col gap-3">
            <Link
              to={`/traces/${trace.id}`}
              className={buttonVariants({ variant: "secondary", size: "sm", className: "inline-flex gap-2 rounded-xl" })}
            >
              <ExternalLink className="size-4" />
              Open full page
            </Link>
            <TraceMetadataFooter
              createdAt={trace.created_at}
              updatedAt={trace.updated_at}
              creatorDisplayName={trace.creator?.display_name}
              modifierDisplayName={trace.modifier?.display_name}
            />
          </div>
          <TracePhotoLightbox
            open={photoLightbox !== null}
            onOpenChange={(o) => {
              if (!o) setPhotoLightbox(null);
            }}
            items={lightboxItems}
            initialPhotoId={photoLightbox?.photoId ?? null}
            title={trace.title?.trim() || "Untitled place"}
          />
        </>
      )}
    </FloatingPanel>
  );
}
