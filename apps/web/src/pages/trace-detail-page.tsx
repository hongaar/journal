import { useMemo, useState } from "react";
import { TraceGooglePhotosSuggestions } from "@/components/traces/trace-google-photos-suggestions";
import { TracePhotoLightbox, TracePhotoThumb } from "@/components/traces/trace-photo-lightbox";
import { photosToLightboxItems } from "@/lib/trace-photo-lightbox-items";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useJournal } from "@/providers/journal-provider";
import type { Trace } from "@/types/database";
import { useTracePhotosSignedUrls } from "@/lib/use-trace-photos";
import { TraceFormDialog } from "@/components/traces/trace-form-dialog";
import { PageBackButton } from "@/components/layout/page-back-button";
import { Button, buttonVariants } from "@curolia/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@curolia/ui/card";
import { Badge } from "@curolia/ui/badge";
import { formatTraceLocationLine } from "@/lib/trace-dates";
import { TraceMetadataFooter } from "@/components/traces/trace-metadata-footer";
import { contrastingForeground } from "@/lib/utils";

type TraceRow = Trace & {
  trace_tags?: { tag_id: string; tags: { id: string; name: string; color: string; icon_emoji: string } | null }[];
  creator?: { display_name: string | null } | null;
  modifier?: { display_name: string | null } | null;
};

export function TraceDetailPage() {
  const { traceId } = useParams<{ traceId: string }>();
  const navigate = useNavigate();
  const { activeJournalId } = useJournal();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [photoLightbox, setPhotoLightbox] = useState<{ photoId: string } | null>(null);

  const traceQuery = useQuery({
    queryKey: ["trace", traceId],
    queryFn: async () => {
      if (!traceId) return null;
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
      return data as TraceRow | null;
    },
    enabled: Boolean(traceId),
  });

  const { photos, signedUrlByPhotoId } = useTracePhotosSignedUrls(traceId);

  const trace = traceQuery.data;
  const wrongJournal = trace && activeJournalId && trace.journal_id !== activeJournalId;

  const tagBadges = useMemo(() => {
    const rows = trace?.trace_tags ?? [];
    return rows.map((tt) => tt.tags).filter(Boolean) as { id: string; name: string; color: string; icon_emoji: string }[];
  }, [trace]);

  const lightboxItems = useMemo(() => photosToLightboxItems(photos, signedUrlByPhotoId), [photos, signedUrlByPhotoId]);

  async function onUploadPhotos(files: FileList | null) {
    if (!files?.length || !trace || !activeJournalId) return;
    let sort = photos.length;
    for (const file of Array.from(files)) {
      const path = `${activeJournalId}/${trace.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("trace-photos").upload(path, file, {
        upsert: false,
      });
      if (upErr) {
        console.error(upErr);
        continue;
      }
      const { error: insErr } = await supabase.from("photos").insert({
        journal_id: activeJournalId,
        trace_id: trace.id,
        storage_path: path,
        sort_order: sort++,
      });
      if (insErr) console.error(insErr);
    }
    await qc.invalidateQueries({ queryKey: ["photos", traceId] });
    await qc.invalidateQueries({ queryKey: ["photo-urls", traceId] });
    if (activeJournalId) {
      await qc.invalidateQueries({ queryKey: ["journal-trace-photos", activeJournalId] });
      await qc.invalidateQueries({ queryKey: ["photo-urls-batch", activeJournalId] });
    }
  }

  if (traceQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-muted-foreground text-sm">Loading trace…</p>
      </div>
    );
  }

  if (!trace || wrongJournal) {
    return (
      <div className="flex h-full flex-col items-start gap-4 px-4 pt-[4.75rem] pb-8 sm:px-6 sm:pt-[5.25rem]">
        <p className="text-muted-foreground text-sm">Trace not found or not in this journal.</p>
        <button
          type="button"
          className={buttonVariants({ variant: "outline", className: "inline-flex gap-1 rounded-xl" })}
          onClick={() => navigate("/")}
        >
          Home
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-3 pt-[4.75rem] pb-10 sm:px-6 sm:pt-[5.25rem]">
      <div className="mx-auto max-w-2xl space-y-4">
        <PageBackButton />
        <Card className="border-[var(--panel-border)] bg-[var(--panel-bg)] shadow-[var(--panel-shadow)] backdrop-blur-xl">
          <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="font-display text-2xl font-semibold tracking-tight">
              {trace.title || "Untitled place"}
            </CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              {formatTraceLocationLine(trace.date, trace.end_date, trace.lat, trace.lng, 5)}
            </p>
            {trace.location_label ? (
              <p className="text-muted-foreground mt-1 text-sm leading-snug">{trace.location_label}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-1">
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
          </div>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              Edit
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
          {trace.description ? <p className="text-sm whitespace-pre-wrap">{trace.description}</p> : null}
          <div>
            <h3 className="mb-2 text-sm font-medium">Photos</h3>
            <div className="flex flex-wrap gap-2">
              {photos.map((p) => {
                const url = signedUrlByPhotoId[p.id];
                return url ? (
                  <TracePhotoThumb
                    key={p.id}
                    url={url}
                    className="h-24 w-24 shrink-0 overflow-hidden rounded-md border"
                    onOpen={() => setPhotoLightbox({ photoId: p.id })}
                  />
                ) : (
                  <div key={p.id} className="text-muted-foreground flex h-24 w-24 items-center justify-center rounded-md border text-xs">
                    …
                  </div>
                );
              })}
            </div>
            <div className="mt-2">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <Upload className="size-4" />
                <span>Upload photos</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => void onUploadPhotos(e.target.files)}
                />
              </label>
            </div>
            <TraceGooglePhotosSuggestions traceId={trace.id} journalId={trace.journal_id} />
          </div>
          <TraceMetadataFooter
            createdAt={trace.created_at}
            updatedAt={trace.updated_at}
            creatorDisplayName={trace.creator?.display_name}
            modifierDisplayName={trace.modifier?.display_name}
          />
          </CardContent>
        </Card>
      <TraceFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        journalId={trace.journal_id}
        trace={trace}
      />
      <TracePhotoLightbox
        open={photoLightbox !== null}
        onOpenChange={(o) => {
          if (!o) setPhotoLightbox(null);
        }}
        items={lightboxItems}
        initialPhotoId={photoLightbox?.photoId ?? null}
        title={trace.title?.trim() || "Untitled place"}
      />
      </div>
    </div>
  );
}
