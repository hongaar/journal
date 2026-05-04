import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useJournal } from "@/providers/journal-provider";
import type { Trace } from "@/types/database";
import { useTracePhotosSignedUrls } from "@/lib/use-trace-photos";
import { TraceFormDialog } from "@/components/traces/trace-form-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { contrastingForeground } from "@/lib/utils";

type TraceRow = Trace & {
  trace_tags?: { tag_id: string; tags: { id: string; name: string; color: string; icon_emoji: string } | null }[];
};

export function TraceDetailPage() {
  const { traceId } = useParams<{ traceId: string }>();
  const navigate = useNavigate();
  const { activeJournalId } = useJournal();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const traceQuery = useQuery({
    queryKey: ["trace", traceId],
    queryFn: async () => {
      if (!traceId) return null;
      const { data, error } = await supabase
        .from("traces")
        .select(
          `*,
          trace_tags ( tag_id, tags ( id, name, color, icon_emoji ) )`,
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
        <button
          type="button"
          className={buttonVariants({
            variant: "secondary",
            size: "sm",
            className: "inline-flex gap-1.5 rounded-xl border-0 bg-foreground/5 shadow-sm hover:bg-foreground/10",
          })}
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
        <Card className="border-[var(--panel-border)] bg-[var(--panel-bg)] shadow-[var(--panel-shadow)] backdrop-blur-xl">
          <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="font-display text-2xl font-semibold tracking-tight">
              {trace.title || "Untitled place"}
            </CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              {new Date(trace.visited_at).toLocaleString()} · {trace.lat.toFixed(5)}, {trace.lng.toFixed(5)}
            </p>
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
                  <a key={p.id} href={url} target="_blank" rel="noreferrer" className="block">
                    <img src={url} alt="" className="h-24 w-24 rounded-md border object-cover" />
                  </a>
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
          </div>
          </CardContent>
        </Card>
      <TraceFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        journalId={trace.journal_id}
        trace={trace}
      />
      </div>
    </div>
  );
}
