import { FloatingPanel } from "@/components/layout/floating-panel";
import { EmojiPicker } from "@/components/traces/emoji-picker";
import { PresetColorPicker } from "@/components/traces/preset-color-picker";
import { TraceActionsToolbar } from "@/components/traces/trace-actions-toolbar";
import { TraceFormDialog } from "@/components/traces/trace-form-dialog";
import { TracePhotoLightbox, TracePhotoThumb } from "@/components/traces/trace-photo-lightbox";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  applyFilterTagIdsToSearchParams,
  parseFilterTagIdsFromSearchParams,
} from "@/lib/map-view-params";
import { formatTraceDateRange } from "@/lib/trace-dates";
import { DEFAULT_TRACE_TAG_COLOR } from "@/lib/preset-trace-tag-colors";
import { supabase } from "@/lib/supabase";
import { photosToLightboxItems } from "@/lib/trace-photo-lightbox-items";
import { filterTracesByTags, type TraceWithTags } from "@/lib/trace-with-tags";
import { useJournalTracesPhotosSignedUrls } from "@/lib/use-trace-photos";
import { contrastingForeground } from "@/lib/utils";
import { useJournal } from "@/providers/journal-provider";
import type { Tag } from "@/types/database";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState, type SetStateAction } from "react";
import { Link, useSearchParams } from "react-router-dom";

export function BlogPage() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeJournalId, loading: journalLoading } = useJournal();
  const [formOpen, setFormOpen] = useState(false);
  const [photoLightbox, setPhotoLightbox] = useState<{ traceId: string; photoId: string } | null>(null);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [tagEditTarget, setTagEditTarget] = useState<Tag | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(DEFAULT_TRACE_TAG_COLOR);
  const [newTagEmoji, setNewTagEmoji] = useState("📍");
  const filterTagIds = useMemo(() => parseFilterTagIdsFromSearchParams(searchParams), [searchParams]);
  const setFilterTagIds = useCallback(
    (action: SetStateAction<Set<string>>) => {
      setSearchParams(
        (prev) => {
          const current = parseFilterTagIdsFromSearchParams(prev);
          const next = typeof action === "function" ? action(current) : action;
          return applyFilterTagIdsToSearchParams(prev, next);
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const tracesQuery = useQuery({
    queryKey: ["traces", activeJournalId, "blog"],
    queryFn: async () => {
      if (!activeJournalId) return [];
      const { data, error } = await supabase
        .from("traces")
        .select(
          `*,
          trace_tags ( tag_id, tags ( id, name, color, icon_emoji ) )`,
        )
        .eq("journal_id", activeJournalId)
        .order("date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as TraceWithTags[];
    },
    enabled: Boolean(activeJournalId) && !journalLoading,
  });

  const tagsQuery = useQuery({
    queryKey: ["tags", activeJournalId],
    queryFn: async () => {
      if (!activeJournalId) return [];
      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .eq("journal_id", activeJournalId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(activeJournalId) && !journalLoading,
  });

  const traces = useMemo(() => tracesQuery.data ?? [], [tracesQuery.data]);
  const visible = useMemo(() => filterTracesByTags(traces, filterTagIds), [traces, filterTagIds]);
  const visibleTraceIds = useMemo(() => visible.map((t) => t.id), [visible]);
  const { photosByTraceId, signedUrlByPhotoId } = useJournalTracesPhotosSignedUrls(
    activeJournalId ?? undefined,
    visibleTraceIds,
  );

  const blogLightboxItems = useMemo(() => {
    if (!photoLightbox) return [];
    const ps = photosByTraceId.get(photoLightbox.traceId) ?? [];
    return photosToLightboxItems(ps, signedUrlByPhotoId);
  }, [photoLightbox, photosByTraceId, signedUrlByPhotoId]);

  const blogLightboxTitle = useMemo(() => {
    if (!photoLightbox) return undefined;
    const t = visible.find((x) => x.id === photoLightbox.traceId);
    return t?.title?.trim() || "Untitled trace";
  }, [photoLightbox, visible]);

  const formDefaults = useMemo(() => {
    if (traces.length === 0) return { lat: 20, lng: 0 };
    const last = traces[traces.length - 1];
    return { lat: last.lat, lng: last.lng };
  }, [traces]);

  async function saveTag() {
    if (!activeJournalId || !newTagName.trim()) return;
    if (tagEditTarget) {
      const { error } = await supabase
        .from("tags")
        .update({
          name: newTagName.trim(),
          color: newTagColor,
          icon_emoji: newTagEmoji || "📍",
          updated_at: new Date().toISOString(),
        })
        .eq("id", tagEditTarget.id);
      if (!error) {
        setTagDialogOpen(false);
        setTagEditTarget(null);
        await qc.invalidateQueries({ queryKey: ["tags", activeJournalId] });
        await qc.invalidateQueries({ queryKey: ["traces", activeJournalId, "blog"] });
      }
      return;
    }
    const { error } = await supabase.from("tags").insert({
      journal_id: activeJournalId,
      name: newTagName.trim(),
      color: newTagColor,
      icon_emoji: newTagEmoji || "📍",
    });
    if (!error) {
      setNewTagName("");
      setTagDialogOpen(false);
      await qc.invalidateQueries({ queryKey: ["tags", activeJournalId] });
    }
  }

  if (journalLoading || !activeJournalId) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <FloatingPanel className="max-w-sm text-center">
          <p className="text-muted-foreground text-sm">
            {!activeJournalId ? "No journal available." : "Loading journal…"}
          </p>
        </FloatingPanel>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 z-10 p-3 pt-[4.75rem] sm:p-4 sm:pt-[5.25rem]">
        <TraceActionsToolbar
          mode="blog"
          onAddTrace={() => setFormOpen(true)}
          onNewTag={() => {
            setTagEditTarget(null);
            setTagDialogOpen(true);
          }}
          onEditTag={(tag) => {
            setTagEditTarget(tag);
            setTagDialogOpen(true);
          }}
          tags={tagsQuery.data ?? []}
          filterTagIds={filterTagIds}
          setFilterTagIds={setFilterTagIds}
        />
      </div>

      <div className="text-foreground h-full overflow-y-auto px-3 pt-[4.75rem] pb-16 sm:px-6 sm:pt-[5.25rem] sm:pb-20">
        <div className="mx-auto max-w-[40rem]">
          <header className="border-border/40 mb-10 border-b pb-8">
            <p className="text-muted-foreground font-display text-sm font-medium tracking-wide uppercase">
              Journal
            </p>
            <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Traces</h1>
            <p className="text-muted-foreground mt-3 max-w-lg text-sm leading-relaxed">
              Traces are listed in chronological order.
            </p>
          </header>

          {visible.length === 0 ? (
            <FloatingPanel className="p-8 text-center">
              <p className="text-muted-foreground text-sm">
                {traces.length === 0
                  ? "No traces yet — add one from the toolbar."
                  : "No traces match the current filters."}
              </p>
            </FloatingPanel>
          ) : (
            <ul className="flex flex-col gap-12 sm:gap-16">
              {visible.map((t) => {
                const tagRows = (t.trace_tags ?? []).map((tt) => tt.tags).filter(Boolean) as {
                  id: string;
                  name: string;
                  color: string;
                  icon_emoji: string;
                }[];
                const tracePhotos = photosByTraceId.get(t.id) ?? [];
                return (
                  <li key={t.id}>
                    <article>
                      {t.date ? (
                        <time
                          className="text-muted-foreground font-display text-sm font-medium tracking-wide"
                          dateTime={t.date}
                        >
                          {formatTraceDateRange(t.date, t.end_date)}
                        </time>
                      ) : null}
                      <h2
                        className={`font-display text-2xl font-semibold tracking-tight sm:text-[1.75rem] ${t.date ? "mt-2" : ""}`}
                      >
                        <Link
                          to={`/traces/${t.id}`}
                          className="hover:text-primary decoration-border/60 underline-offset-4 transition-colors hover:underline"
                        >
                          {t.title?.trim() || "Untitled trace"}
                        </Link>
                      </h2>
                      {tagRows.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {tagRows.map((tag) => (
                            <span
                              key={tag.id}
                              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                              style={{
                                backgroundColor: tag.color,
                                color: contrastingForeground(tag.color),
                              }}
                            >
                              <span>{tag.icon_emoji}</span>
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {t.description?.trim() ? (
                        <p className="text-muted-foreground mt-4 text-base leading-relaxed">{t.description.trim()}</p>
                      ) : null}
                      {tracePhotos.length > 0 ? (
                        <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {tracePhotos.map((p) => {
                            const url = signedUrlByPhotoId[p.id];
                            return url ? (
                              <li key={p.id} className="overflow-hidden rounded-xl border">
                                <TracePhotoThumb
                                  url={url}
                                  className="aspect-square size-full"
                                  onOpen={() => setPhotoLightbox({ traceId: t.id, photoId: p.id })}
                                />
                              </li>
                            ) : (
                              <li key={p.id}>
                                <div className="bg-muted aspect-square animate-pulse rounded-xl border" />
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                      <div className="mt-5">
                        <Link
                          to={`/traces/${t.id}`}
                          className={buttonVariants({ variant: "outline", size: "sm", className: "rounded-xl" })}
                        >
                          Read more
                        </Link>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <TracePhotoLightbox
        open={photoLightbox !== null}
        onOpenChange={(o) => {
          if (!o) setPhotoLightbox(null);
        }}
        items={blogLightboxItems}
        initialPhotoId={photoLightbox?.photoId ?? null}
        title={blogLightboxTitle}
      />

      <TraceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        journalId={activeJournalId}
        trace={null}
        defaultLat={formDefaults.lat}
        defaultLng={formDefaults.lng}
        anchorScreen={null}
      />

      <Dialog
        open={tagDialogOpen}
        onOpenChange={(open) => {
          setTagDialogOpen(open);
          if (!open) setTagEditTarget(null);
        }}
      >
        <DialogContent className="border-[var(--panel-border)] bg-[var(--panel-bg)] backdrop-blur-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-semibold">
              {tagEditTarget ? "Edit tag" : "New tag"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="blog-tag-name">Name</Label>
              <Input id="blog-tag-name" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} />
            </div>
            <PresetColorPicker
              id="blog-tag-color"
              label="Color"
              value={newTagColor}
              onChange={setNewTagColor}
            />
            <EmojiPicker
              id="blog-tag-emoji"
              label="Icon (emoji)"
              value={newTagEmoji}
              onChange={setNewTagEmoji}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTagDialogOpen(false);
                setTagEditTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void saveTag()}>{tagEditTarget ? "Save tag" : "Create tag"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
