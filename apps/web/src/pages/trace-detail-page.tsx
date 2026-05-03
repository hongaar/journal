import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useJournal } from "@/providers/journal-provider";
import type { Photo, Trace } from "@/types/database";
import { TraceFormDialog } from "@/components/traces/trace-form-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type TraceRow = Trace & {
  trace_tags?: { tag_id: string; tags: { id: string; name: string; color: string; icon_emoji: string } | null }[];
};

export function TraceDetailPage() {
  const { traceId } = useParams<{ traceId: string }>();
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

  const photosQuery = useQuery({
    queryKey: ["photos", traceId],
    queryFn: async () => {
      if (!traceId) return [];
      const { data, error } = await supabase.from("photos").select("*").eq("trace_id", traceId).order("sort_order");
      if (error) throw error;
      return (data ?? []) as Photo[];
    },
    enabled: Boolean(traceId),
  });

  const photoIdsKey = (photosQuery.data ?? [])
    .map((p) => `${p.id}:${p.storage_path ?? ""}`)
    .join("|");

  const signedUrls = useQuery({
    queryKey: ["photo-urls", traceId, photoIdsKey],
    queryFn: async () => {
      const photos = photosQuery.data ?? [];
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
    enabled: Boolean(traceId) && (photosQuery.data?.length ?? 0) > 0,
  });

  const trace = traceQuery.data;
  const wrongJournal = trace && activeJournalId && trace.journal_id !== activeJournalId;

  const tagBadges = useMemo(() => {
    const rows = trace?.trace_tags ?? [];
    return rows.map((tt) => tt.tags).filter(Boolean) as { id: string; name: string; color: string; icon_emoji: string }[];
  }, [trace]);

  async function onUploadPhotos(files: FileList | null) {
    if (!files?.length || !trace || !activeJournalId) return;
    let sort = (photosQuery.data ?? []).length;
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
  }

  if (traceQuery.isLoading) {
    return <div className="text-muted-foreground p-6 text-sm">Loading trace…</div>;
  }

  if (!trace || wrongJournal) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground text-sm">Trace not found or not in this journal.</p>
        <Link to="/" className={buttonVariants({ variant: "outline", className: "mt-4 inline-flex" })}>
          Back to map
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Link to="/" className={buttonVariants({ variant: "ghost", size: "sm", className: "inline-flex gap-1" })}>
          <ArrowLeft className="size-4" />
          Map
        </Link>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle>{trace.title || "Untitled place"}</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              {new Date(trace.visited_at).toLocaleString()} · {trace.lat.toFixed(5)}, {trace.lng.toFixed(5)}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {tagBadges.map((t) => (
                <Badge key={t.id} variant="secondary" style={{ borderColor: t.color }}>
                  {t.icon_emoji} {t.name}
                </Badge>
              ))}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            Edit
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {trace.description ? <p className="text-sm whitespace-pre-wrap">{trace.description}</p> : null}
          <div>
            <h3 className="mb-2 text-sm font-medium">Photos</h3>
            <div className="flex flex-wrap gap-2">
              {(photosQuery.data ?? []).map((p) => {
                const url = signedUrls.data?.[p.id];
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
  );
}
