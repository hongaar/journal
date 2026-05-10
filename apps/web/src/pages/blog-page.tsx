import { FloatingPanel } from "@/components/layout/floating-panel";
import { JournalViewInitialLoader } from "@/components/layout/journal-view-initial-loader";
import { AddTraceFab } from "@/components/traces/add-trace-fab";
import { EmojiPicker } from "@/components/traces/emoji-picker";
import { PresetColorPicker } from "@/components/traces/preset-color-picker";
import { TraceFormDialog } from "@/components/traces/trace-form-dialog";
import {
  TracePhotoLightbox,
  TracePhotoThumb,
} from "@/components/traces/trace-photo-lightbox";
import { useBlogTraceListOrder } from "@/hooks/use-blog-trace-list-order";
import { orderedBlogTraceList } from "@/lib/blog-trace-list-order";
import { DEFAULT_TRACE_TAG_COLOR } from "@/lib/preset-trace-tag-colors";
import { supabase } from "@/lib/supabase";
import { formatTraceDateRange } from "@/lib/trace-dates";
import { photosToLightboxItems } from "@/lib/trace-photo-lightbox-items";
import { filterTracesByTags, type TraceWithTags } from "@/lib/trace-with-tags";
import { useJournalTracesPhotosSignedUrls } from "@/lib/use-trace-photos";
import { cn, contrastingForeground } from "@/lib/utils";
import { useJournal } from "@/providers/journal-provider";
import { useMountTagSidebarRegistration } from "@/providers/tag-sidebar-provider";
import type { Tag } from "@/types/database";
import { Button, buttonVariants } from "@curolia/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@curolia/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@curolia/ui/dropdown-menu";
import { Input } from "@curolia/ui/input";
import { Label } from "@curolia/ui/label";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useCallback, useMemo, useState, type SetStateAction } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { useJournalSlugRouteSync } from "@/hooks/use-journal-slug-route-sync";
import { traceDetailHref } from "@/lib/app-paths";
import {
  applyFilterTagsToSearchParams,
  resolveFilterTagIdsFromSearchParams,
} from "@/lib/map-view-params";

export function BlogPage() {
  const qc = useQueryClient();
  const { journalSlug } = useParams<{ journalSlug: string }>();
  useJournalSlugRouteSync(journalSlug);
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    activeJournalId,
    activeJournal,
    loading: journalLoading,
  } = useJournal();
  const { order: blogListOrder, setOrder: setBlogListOrder } =
    useBlogTraceListOrder(activeJournalId);

  const blogJournalSlug =
    journalSlug?.trim() || activeJournal?.slug?.trim() || "";
  const [formOpen, setFormOpen] = useState(false);
  const [photoLightbox, setPhotoLightbox] = useState<{
    traceId: string;
    photoId: string;
  } | null>(null);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [tagEditTarget, setTagEditTarget] = useState<Tag | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(DEFAULT_TRACE_TAG_COLOR);
  const [newTagEmoji, setNewTagEmoji] = useState("📍");
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

  const tags = useMemo(() => tagsQuery.data ?? [], [tagsQuery.data]);
  const filterTagIds = useMemo(
    () => resolveFilterTagIdsFromSearchParams(searchParams, tags),
    [searchParams, tags],
  );
  const setFilterTagIds = useCallback(
    (action: SetStateAction<Set<string>>) => {
      setSearchParams(
        (prev) => {
          const current = resolveFilterTagIdsFromSearchParams(prev, tags);
          const next = typeof action === "function" ? action(current) : action;
          return applyFilterTagsToSearchParams(prev, next, tags);
        },
        { replace: true },
      );
    },
    [tags, setSearchParams],
  );

  useMountTagSidebarRegistration({
    tags,
    filterTagIds,
    setFilterTagIds,
    onNewTag: () => {
      setTagEditTarget(null);
      setNewTagName("");
      setNewTagColor(DEFAULT_TRACE_TAG_COLOR);
      setNewTagEmoji("📍");
      setTagDialogOpen(true);
    },
    onEditTag: (tag) => {
      setTagEditTarget(tag);
      setNewTagName(tag.name);
      setNewTagColor(tag.color);
      setNewTagEmoji(tag.icon_emoji || "📍");
      setTagDialogOpen(true);
    },
  });

  const traces = useMemo(() => tracesQuery.data ?? [], [tracesQuery.data]);
  const visible = useMemo(
    () => filterTracesByTags(traces, filterTagIds),
    [traces, filterTagIds],
  );
  const orderedVisible = useMemo(
    () => orderedBlogTraceList(visible, blogListOrder),
    [visible, blogListOrder],
  );
  const visibleTraceIds = useMemo(
    () => orderedVisible.map((t) => t.id),
    [orderedVisible],
  );
  const { photosByTraceId, signedUrlByPhotoId } =
    useJournalTracesPhotosSignedUrls(
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
    const t = orderedVisible.find((x) => x.id === photoLightbox.traceId);
    return t?.title?.trim() || "Untitled trace";
  }, [photoLightbox, orderedVisible]);

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
        await qc.invalidateQueries({
          queryKey: ["traces", activeJournalId, "blog"],
        });
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

  if (journalLoading || (Boolean(activeJournalId) && tracesQuery.isPending)) {
    return <JournalViewInitialLoader />;
  }

  if (!activeJournalId) {
    return (
      <JournalViewInitialLoader label="No journal available." busy={false} />
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="pointer-events-none absolute right-4 bottom-6 z-10 sm:right-6">
        <AddTraceFab onClick={() => setFormOpen(true)} />
      </div>

      <div className="text-foreground h-full overflow-y-auto px-3 pt-[calc(var(--app-toolbar-h)+0.75rem)] pb-20 sm:px-6 sm:pt-[calc(var(--app-toolbar-h)+1rem)] sm:pb-24">
        <div className="mx-auto max-w-[40rem]">
          <header className="border-border/40 mb-10 border-b pb-8">
            <p className="text-muted-foreground font-display text-sm font-normal tracking-wide uppercase">
              Journal
            </p>
            <h1 className="font-display mt-2 text-3xl font-normal tracking-tight sm:text-4xl">
              {activeJournal?.name.trim() || journalSlug || "Journal"}
            </h1>
            <p className="text-muted-foreground mt-3 max-w-lg text-sm leading-relaxed">
              Traces are listed in{" "}
              <DropdownMenu>
                <DropdownMenuTrigger
                  type="button"
                  className={cn(
                    "text-foreground decoration-border/60 underline-offset-2",
                    "hover:text-primary focus-visible:ring-ring inline-flex cursor-pointer items-center gap-1 font-medium underline",
                    "focus-visible:rounded-sm focus-visible:ring-2 focus-visible:outline-none",
                  )}
                  aria-label={
                    blogListOrder === "chronological"
                      ? "Trace list order: chronological — change sorting"
                      : "Trace list order: alphabetical — change sorting"
                  }
                >
                  {blogListOrder === "chronological"
                    ? "chronological order"
                    : "alphabetical order"}
                  <ChevronDown
                    className="size-3.5 shrink-0 opacity-70"
                    aria-hidden
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[13rem]">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>List order</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={blogListOrder}
                      onValueChange={(v) => {
                        if (v === "chronological" || v === "alphabetical") {
                          setBlogListOrder(v);
                        }
                      }}
                    >
                      <DropdownMenuRadioItem value="chronological">
                        Chronological
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="alphabetical">
                        Alphabetical (by title)
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              .
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
              {orderedVisible.map((t) => {
                const tagRows = (t.trace_tags ?? [])
                  .map((tt) => tt.tags)
                  .filter(Boolean) as {
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
                          className="text-muted-foreground font-display text-sm font-normal tracking-wide"
                          dateTime={t.date}
                        >
                          {formatTraceDateRange(t.date, t.end_date)}
                        </time>
                      ) : null}
                      <h2
                        className={`font-display text-2xl font-normal tracking-tight sm:text-[1.75rem] ${t.date ? "mt-2" : ""}`}
                      >
                        <Link
                          to={
                            blogJournalSlug
                              ? traceDetailHref(blogJournalSlug, t.slug)
                              : "#"
                          }
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
                        <p className="text-muted-foreground mt-4 text-base leading-relaxed">
                          {t.description.trim()}
                        </p>
                      ) : null}
                      {tracePhotos.length > 0 ? (
                        <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {tracePhotos.map((p) => {
                            const url = signedUrlByPhotoId[p.id];
                            return url ? (
                              <li
                                key={p.id}
                                className="overflow-hidden rounded-xl border"
                              >
                                <TracePhotoThumb
                                  url={url}
                                  className="aspect-square size-full"
                                  onOpen={() =>
                                    setPhotoLightbox({
                                      traceId: t.id,
                                      photoId: p.id,
                                    })
                                  }
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
                          to={
                            blogJournalSlug
                              ? traceDetailHref(blogJournalSlug, t.slug)
                              : "#"
                          }
                          className={buttonVariants({
                            variant: "secondary",
                            size: "default",
                            className: "rounded-xl",
                          })}
                        >
                          View trace
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
            <DialogTitle className="font-display text-xl font-normal">
              {tagEditTarget ? "Edit tag" : "New tag"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="blog-tag-name">Name</Label>
              <Input
                id="blog-tag-name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
              />
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
            <Button onClick={() => void saveTag()}>
              {tagEditTarget ? "Save tag" : "Create tag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
