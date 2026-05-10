import { TraceLinksEditor } from "@/components/traces/trace-links-editor";
import {
  TracePhotoLightbox,
  TracePhotoThumb,
} from "@/components/traces/trace-photo-lightbox";
import { useMaxSm } from "@/hooks/use-max-sm";
import { journalViewHref, traceDetailHref } from "@/lib/app-paths";
import { mapAnchorPanelMiddleware } from "@/lib/map-anchor-floating-ui";
import { reversePhotonLocationLabel } from "@/lib/photon-geocode";
import { supabase } from "@/lib/supabase";
import { photosToLightboxItems } from "@/lib/trace-photo-lightbox-items";
import { useTracePhotosSignedUrls } from "@/lib/use-trace-photos";
import { cn } from "@/lib/utils";
import { pluginList } from "@/plugins/registry";
import { useAuth } from "@/providers/auth-provider";
import { useJournal } from "@/providers/journal-provider";
import type { Tag, Trace } from "@/types/database";
import { Button } from "@curolia/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@curolia/ui/card";
import { CautionPanel } from "@curolia/ui/caution-panel";
import { Checkbox } from "@curolia/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@curolia/ui/dialog";
import { Input } from "@curolia/ui/input";
import { Label } from "@curolia/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@curolia/ui/select";
import { Textarea } from "@curolia/ui/textarea";
import { autoUpdate, computePosition } from "@floating-ui/dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Upload } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type TraceFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journalId: string;
  trace: Trace | null;
  defaultLat?: number;
  defaultLng?: number;
  /** For new traces: screen anchor → floating panel (no modal blur). */
  anchorScreen?: { x: number; y: number } | null;
  /** Fires while creating a trace when tag selection changes (for map preview). */
  onNewTraceTagIdsChange?: (tagIds: string[]) => void;
};

export function TraceFormDialog({
  open,
  onOpenChange,
  journalId,
  trace,
  defaultLat = 0,
  defaultLng = 0,
  anchorScreen = null,
  onNewTraceTagIdsChange,
}: TraceFormDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { journals } = useJournal();
  const isNarrow = useMaxSm();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dateYmd, setDateYmd] = useState("");
  const [endDateYmd, setEndDateYmd] = useState("");
  const [lat, setLat] = useState(String(defaultLat));
  const [lng, setLng] = useState(String(defaultLng));
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [locationLabel, setLocationLabel] = useState("");
  const [locationLookupPending, setLocationLookupPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoLightbox, setPhotoLightbox] = useState<{
    photoId: string;
  } | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTargetJournalId, setMoveTargetJournalId] = useState("");
  const [moving, setMoving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const floatingRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<{ x: number; y: number } | null>(null);

  const editTraceId = trace?.id;
  const { photos, signedUrlByPhotoId } = useTracePhotosSignedUrls(editTraceId);
  const lightboxItems = useMemo(
    () => photosToLightboxItems(photos, signedUrlByPhotoId),
    [photos, signedUrlByPhotoId],
  );

  const floatingNew = Boolean(open && !trace && anchorScreen && !isNarrow);

  const virtualReference = useMemo(
    () => ({
      getBoundingClientRect() {
        const a = anchorRef.current;
        if (!a) return new DOMRect(0, 0, 0, 0);
        return new DOMRect(a.x, a.y, 0, 0);
      },
    }),
    [],
  );

  useLayoutEffect(() => {
    anchorRef.current = anchorScreen;
  }, [anchorScreen]);

  useLayoutEffect(() => {
    if (!floatingNew) return;
    const floating = floatingRef.current;
    if (!floating || !anchorRef.current) return;

    const run = () =>
      computePosition(virtualReference, floating, {
        placement: "right",
        strategy: "fixed",
        middleware: mapAnchorPanelMiddleware(),
      }).then((data) => {
        const el = floatingRef.current;
        if (!el) return;

        Object.assign(el.style, {
          position: "fixed",
          left: `${data.x}px`,
          top: `${data.y}px`,
          right: "auto",
          bottom: "auto",
        });
      });

    void run();
    return autoUpdate(virtualReference, floating, run, {
      animationFrame: true,
      layoutShift: true,
    });
  }, [floatingNew, virtualReference]);

  useEffect(() => {
    if (!floatingNew) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [floatingNew, onOpenChange]);

  const dialogTitle = trace ? "Edit trace" : "New trace";

  const otherJournals = useMemo(
    () => (trace ? journals.filter((j) => j.id !== trace.journal_id) : []),
    [journals, trace],
  );

  /** Base UI Select maps values → labels for `<SelectValue>` (otherwise the raw id is shown). */
  const journalSelectItems = useMemo(
    () =>
      Object.fromEntries(otherJournals.map((j) => [j.id, j.name])) as Record<
        string,
        string
      >,
    [otherJournals],
  );

  const moveTargetJournal = useMemo(
    () =>
      moveTargetJournalId
        ? (journals.find((j) => j.id === moveTargetJournalId) ?? null)
        : null,
    [journals, moveTargetJournalId],
  );

  const tagsQuery = useQuery({
    queryKey: ["tags", journalId],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from("tags")
        .select("*")
        .eq("journal_id", journalId)
        .order("name");
      if (err) throw err;
      return (data ?? []) as Tag[];
    },
    enabled: open && Boolean(journalId),
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (trace) {
      setTitle(trace.title ?? "");
      setDescription(trace.description ?? "");
      setDateYmd(trace.date ?? "");
      setEndDateYmd(trace.end_date ?? "");
      setLat(String(trace.lat));
      setLng(String(trace.lng));
      setLocationLabel(trace.location_label ?? "");
      void (async () => {
        const { data } = await supabase
          .from("trace_tags")
          .select("tag_id")
          .eq("trace_id", trace.id);
        setSelectedTags(new Set((data ?? []).map((r) => r.tag_id)));
      })();
    } else {
      setTitle("");
      setDescription("");
      setDateYmd("");
      setEndDateYmd("");
      setLat(String(defaultLat));
      setLng(String(defaultLng));
      setLocationLabel("");
      setSelectedTags(new Set());
    }
  }, [open, trace, defaultLat, defaultLng]);

  useEffect(() => {
    if (!open || trace) return;
    const latN = Number(lat);
    const lngN = Number(lng);
    if (Number.isNaN(latN) || Number.isNaN(lngN)) return;

    let cancelled = false;
    const t = window.setTimeout(() => {
      if (cancelled) return;
      setLocationLookupPending(true);
      void (async () => {
        try {
          const label = await reversePhotonLocationLabel(latN, lngN);
          if (!cancelled) setLocationLabel(label ?? "");
        } catch {
          if (!cancelled) setLocationLabel("");
        } finally {
          if (!cancelled) setLocationLookupPending(false);
        }
      })();
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
      setLocationLookupPending(false);
    };
  }, [open, trace, lat, lng]);

  useEffect(() => {
    if (!open || trace) return;
    onNewTraceTagIdsChange?.([...selectedTags]);
  }, [open, trace, selectedTags, onNewTraceTagIdsChange]);

  useEffect(() => {
    if (!open) {
      setPhotoLightbox(null);
      setMoveOpen(false);
      setMoveTargetJournalId("");
      setMoving(false);
      setDeleteOpen(false);
      setDeleting(false);
    }
  }, [open]);

  async function confirmMoveTrace() {
    if (!trace || !moveTargetJournalId) return;
    const targetJournal = journals.find((j) => j.id === moveTargetJournalId);
    if (!targetJournal) return;

    setMoving(true);
    setError(null);
    const oldJournalId = trace.journal_id;
    try {
      const { data: photoRows, error: phFetchErr } = await supabase
        .from("photos")
        .select("id, storage_path")
        .eq("trace_id", trace.id);
      if (phFetchErr) throw phFetchErr;

      for (const p of photoRows ?? []) {
        const path = p.storage_path?.trim();
        if (!path) continue;
        const segments = path.split("/").filter(Boolean);
        if (segments.length < 3) continue;
        const tail = segments.slice(2).join("/");
        const newPath = `${moveTargetJournalId}/${trace.id}/${tail}`;
        if (newPath === path) continue;

        const { data: blob, error: dlErr } = await supabase.storage
          .from("trace-photos")
          .download(path);
        if (dlErr || !blob) throw dlErr ?? new Error("Photo download failed");
        const { error: upErr } = await supabase.storage
          .from("trace-photos")
          .upload(newPath, blob, {
            upsert: false,
            contentType: blob.type || undefined,
          });
        if (upErr) throw upErr;

        const { error: uErr } = await supabase
          .from("photos")
          .update({
            journal_id: moveTargetJournalId,
            storage_path: newPath,
          })
          .eq("id", p.id);
        if (uErr) throw uErr;

        await supabase.storage.from("trace-photos").remove([path]);
      }

      const { error: ttErr } = await supabase
        .from("trace_tags")
        .delete()
        .eq("trace_id", trace.id);
      if (ttErr) throw ttErr;

      const { error: tlErr } = await supabase
        .from("trace_links")
        .update({ journal_id: moveTargetJournalId })
        .eq("trace_id", trace.id);
      if (tlErr) throw tlErr;

      const { data: traceRow, error: trErr } = await supabase
        .from("traces")
        .update({
          journal_id: moveTargetJournalId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", trace.id)
        .select("slug")
        .single();
      if (trErr || !traceRow?.slug) throw trErr ?? new Error("Move failed");

      await qc.invalidateQueries({ queryKey: ["traces", oldJournalId] });
      await qc.invalidateQueries({ queryKey: ["traces", moveTargetJournalId] });
      await qc.invalidateQueries({ queryKey: ["trace"] });
      await qc.invalidateQueries({ queryKey: ["trace", trace.id] });
      await qc.invalidateQueries({ queryKey: ["photos", trace.id] });
      await qc.invalidateQueries({ queryKey: ["photo-urls", trace.id] });
      await qc.invalidateQueries({
        queryKey: ["journal-trace-photos", oldJournalId],
      });
      await qc.invalidateQueries({
        queryKey: ["journal-trace-photos", moveTargetJournalId],
      });
      await qc.invalidateQueries({
        queryKey: ["photo-urls-batch", oldJournalId],
      });
      await qc.invalidateQueries({
        queryKey: ["photo-urls-batch", moveTargetJournalId],
      });

      setMoveOpen(false);
      setMoveTargetJournalId("");
      onOpenChange(false);
      toast.success(`Moved to ${targetJournal.name}`);
      navigate(
        traceDetailHref(targetJournal.slug.trim(), traceRow.slug.trim()),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not move trace");
    } finally {
      setMoving(false);
    }
  }

  async function confirmDeleteTrace() {
    if (!trace) return;
    setDeleting(true);
    try {
      const journalSlug =
        journals.find((j) => j.id === trace.journal_id)?.slug?.trim() ?? "";
      const { error } = await supabase
        .from("traces")
        .delete()
        .eq("id", trace.id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["traces", trace.journal_id] });
      await qc.invalidateQueries({ queryKey: ["trace"] });
      await qc.invalidateQueries({
        queryKey: ["journal-trace-photos", trace.journal_id],
      });
      setDeleteOpen(false);
      onOpenChange(false);
      toast.success("Trace deleted");
      navigate(journalSlug ? journalViewHref("map", journalSlug) : "/");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not delete this trace.",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    const latN = Number(lat);
    const lngN = Number(lng);
    if (Number.isNaN(latN) || Number.isNaN(lngN)) {
      setError("Latitude and longitude must be numbers.");
      setSaving(false);
      return;
    }

    const start = dateYmd.trim() || null;
    const end = endDateYmd.trim() || null;
    if (end && !start) {
      setError("Clear the end date or set a start date.");
      setSaving(false);
      return;
    }
    if (start && end && end < start) {
      setError("End date must be on or after the start date.");
      setSaving(false);
      return;
    }

    try {
      let traceId = trace?.id;
      if (trace) {
        const { error: uErr } = await supabase
          .from("traces")
          .update({
            title: title || null,
            description: description || null,
            location_label: locationLabel.trim() || null,
            lat: latN,
            lng: lngN,
            date: start,
            end_date: end,
            updated_at: new Date().toISOString(),
          })
          .eq("id", trace.id);
        if (uErr) throw uErr;
      } else {
        const { data: row, error: iErr } = await supabase
          .from("traces")
          .insert({
            journal_id: journalId,
            title: title || null,
            description: description || null,
            location_label: locationLabel.trim() || null,
            lat: latN,
            lng: lngN,
            date: start,
            end_date: end,
          })
          .select("id")
          .single();
        if (iErr || !row) throw iErr ?? new Error("No trace id");
        traceId = row.id;
      }

      if (!traceId) throw new Error("Missing trace id");

      const { error: dErr } = await supabase
        .from("trace_tags")
        .delete()
        .eq("trace_id", traceId);
      if (dErr) throw dErr;

      const tagRows = [...selectedTags].map((tag_id) => ({
        trace_id: traceId,
        tag_id,
      }));
      if (tagRows.length > 0) {
        const { error: tErr } = await supabase
          .from("trace_tags")
          .insert(tagRows);
        if (tErr) throw tErr;
      }

      await qc.invalidateQueries({ queryKey: ["traces", journalId] });
      if (trace) await qc.invalidateQueries({ queryKey: ["trace"] });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const idSuffix = trace ? "e" : "n";

  async function onUploadPhotos(files: FileList | null) {
    if (!files?.length || !trace || !journalId) return;
    let sort = photos.length;
    for (const file of Array.from(files)) {
      const path = `${journalId}/${trace.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("trace-photos")
        .upload(path, file, {
          upsert: false,
        });
      if (upErr) {
        console.error(upErr);
        continue;
      }
      const { error: insErr } = await supabase.from("photos").insert({
        journal_id: journalId,
        trace_id: trace.id,
        storage_path: path,
        sort_order: sort++,
      });
      if (insErr) console.error(insErr);
    }
    await qc.invalidateQueries({ queryKey: ["photos", trace.id] });
    await qc.invalidateQueries({ queryKey: ["photo-urls", trace.id] });
    await qc.invalidateQueries({
      queryKey: ["journal-trace-photos", journalId],
    });
    await qc.invalidateQueries({
      queryKey: ["photo-urls-batch", journalId],
    });
  }

  const formFields = (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 py-2">
      <div className="space-y-2">
        <Label htmlFor={`t-title-${idSuffix}`}>Title</Label>
        <Input
          id={`t-title-${idSuffix}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-lg"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`t-desc-${idSuffix}`}>Description</Label>
        <Textarea
          id={`t-desc-${idSuffix}`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="rounded-lg"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`t-date-${idSuffix}`}>Date (optional)</Label>
        <Input
          id={`t-date-${idSuffix}`}
          type="date"
          value={dateYmd}
          onChange={(e) => setDateYmd(e.target.value)}
          className="rounded-lg"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`t-end-${idSuffix}`}>End date (optional)</Label>
        <Input
          id={`t-end-${idSuffix}`}
          type="date"
          value={endDateYmd}
          min={dateYmd || undefined}
          onChange={(e) => setEndDateYmd(e.target.value)}
          className="rounded-lg"
        />
      </div>
      {!trace && !anchorScreen ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label htmlFor={`t-lat-${idSuffix}`}>Latitude</Label>
            <Input
              id={`t-lat-${idSuffix}`}
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="rounded-lg"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`t-lng-${idSuffix}`}>Longitude</Label>
            <Input
              id={`t-lng-${idSuffix}`}
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              className="rounded-lg"
            />
          </div>
        </div>
      ) : null}
      {!trace ? (
        <div className="space-y-2">
          <Label>Place</Label>
          <p className="text-muted-foreground min-h-[1.35rem] text-sm leading-snug">
            {locationLookupPending ? (
              <span className="opacity-70">Looking up address…</span>
            ) : locationLabel ? (
              locationLabel
            ) : (
              <span className="opacity-70">No place name yet…</span>
            )}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Label>Photos</Label>
            <div className="flex flex-wrap gap-2">
              {photos.map((p) => {
                const url = signedUrlByPhotoId[p.id];
                return url ? (
                  <TracePhotoThumb
                    key={p.id}
                    url={url}
                    className="border-border size-24 shrink-0 overflow-hidden rounded-md border"
                    onOpen={() => setPhotoLightbox({ photoId: p.id })}
                  />
                ) : (
                  <div
                    key={p.id}
                    className="border-border bg-muted text-muted-foreground flex size-24 shrink-0 items-center justify-center rounded-md border text-xs"
                  >
                    …
                  </div>
                );
              })}
              {photos.length === 0 ? (
                <p className="text-muted-foreground text-sm">No photos yet.</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
              {pluginList.map((p) => {
                const Slot = p.TracePhotoImportSlot;
                if (!Slot) return null;
                return (
                  <Slot
                    key={p.id}
                    supabase={supabase}
                    userId={user?.id}
                    traceId={trace.id}
                    journalId={journalId}
                    traceDate={trace.date}
                    traceEndDate={trace.end_date}
                  />
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Links</Label>
            <TraceLinksEditor traceId={trace.id} journalId={journalId} />
          </div>
        </>
      )}
      <div className="space-y-2">
        <Label>Tags</Label>
        <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border/80 p-2">
          {(tagsQuery.data ?? []).map((tag) => (
            <label
              key={tag.id}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Checkbox
                checked={selectedTags.has(tag.id)}
                onCheckedChange={(c) => {
                  setSelectedTags((prev) => {
                    const next = new Set(prev);
                    if (c === true) next.add(tag.id);
                    else next.delete(tag.id);
                    return next;
                  });
                }}
              />
              <span>{tag.icon_emoji}</span>
              <span>{tag.name}</span>
            </label>
          ))}
          {tagsQuery.data?.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No tags yet — add one from the Tags menu.
            </p>
          ) : null}
        </div>
      </div>
      {trace ? (
        <div className="mt-4 border-t border-border/40 pt-4">
          <CautionPanel
            title="Danger zone"
            description="Move this trace to another journal or delete it permanently."
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                variant="secondary"
                className="rounded-xl"
                disabled={otherJournals.length === 0}
                onClick={() => {
                  setMoveTargetJournalId("");
                  setMoveOpen(true);
                }}
              >
                Move to another journal…
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-4" aria-hidden />
                Delete trace
              </Button>
            </div>
            {otherJournals.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-[11px] leading-snug">
                No other journals to move to.
              </p>
            ) : null}
          </CautionPanel>
        </div>
      ) : null}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );

  const footerActions = (
    <>
      <Button
        variant="outline"
        className="rounded-xl"
        onClick={() => onOpenChange(false)}
      >
        Cancel
      </Button>
      <Button
        disabled={saving}
        className="rounded-xl"
        onClick={() => void save()}
      >
        Save
      </Button>
    </>
  );

  const formShell = (
    <Card className="border-[var(--panel-border)] bg-[var(--panel-bg)] gap-0 py-0 shadow-[var(--panel-shadow)] backdrop-blur-xl">
      <CardHeader className="gap-1 border-b border-border/50 px-4 pb-3 pt-4">
        <CardTitle className="font-display text-xl font-normal tracking-tight">
          {dialogTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-[min(70vh,32rem)] min-h-0 overflow-y-auto px-4 pt-4 pb-2">
        {formFields}
      </CardContent>
      <CardFooter className="flex flex-col-reverse gap-2 px-4 py-4 sm:flex-row sm:justify-end">
        {footerActions}
      </CardFooter>
    </Card>
  );

  const photoLightboxOverlay = trace ? (
    <TracePhotoLightbox
      open={photoLightbox !== null}
      onOpenChange={(o) => {
        if (!o) setPhotoLightbox(null);
      }}
      items={lightboxItems}
      initialPhotoId={photoLightbox?.photoId ?? null}
      title={trace.title?.trim() || "Untitled place"}
    />
  ) : null;

  const moveTraceDialog = trace ? (
    <Dialog
      open={moveOpen}
      onOpenChange={(next) => {
        if (!moving) setMoveOpen(next);
      }}
    >
      <DialogContent className="border-[var(--panel-border)] bg-[var(--panel-bg)] backdrop-blur-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-normal">
            Move trace to another journal
          </DialogTitle>
          <DialogDescription className="sr-only">
            Tags will be removed. If you choose a shared journal, other members
            may see this trace. Pick a destination journal below.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <ul className="text-muted-foreground list-disc space-y-1.5 pl-4 text-sm">
            <li>
              All tags will be removed from this trace. Tags belong to a journal
              and do not carry over.
            </li>
            {moveTargetJournal && !moveTargetJournal.is_personal ? (
              <li>
                This journal is shared with others. Members who can access it
                may be able to see this trace.
              </li>
            ) : null}
          </ul>
          <div className="space-y-2">
            <Label htmlFor="move-trace-journal">Destination journal</Label>
            <Select
              modal={false}
              value={moveTargetJournalId === "" ? null : moveTargetJournalId}
              onValueChange={(v) => setMoveTargetJournalId(v ?? "")}
              items={journalSelectItems}
            >
              <SelectTrigger
                id="move-trace-journal"
                className="w-full rounded-xl"
              >
                <SelectValue placeholder="Choose a journal" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {otherJournals.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={moving}
            onClick={() => setMoveOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            disabled={moving || !moveTargetJournalId}
            onClick={() => void confirmMoveTrace()}
          >
            {moving ? "Moving…" : "Move trace"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null;

  const deleteTraceDialog = trace ? (
    <Dialog
      open={deleteOpen}
      onOpenChange={(next) => {
        if (!next && deleting) return;
        setDeleteOpen(next);
      }}
    >
      <DialogContent
        showCloseButton={!deleting}
        className="border-[var(--panel-border)] bg-[var(--panel-bg)] backdrop-blur-xl sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-normal">
            Delete trace?
          </DialogTitle>
          <DialogDescription>
            This removes the trace from your journal. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="border-border/40 gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={deleting}
            onClick={() => setDeleteOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="rounded-xl"
            disabled={deleting}
            onClick={() => void confirmDeleteTrace()}
          >
            {deleting ? "Deleting…" : "Delete trace"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null;

  if (floatingNew && anchorScreen) {
    return (
      <>
        <div
          ref={floatingRef}
          className="pointer-events-none z-[45] w-max min-w-0"
        >
          <div className="pointer-events-auto relative min-w-[288px] max-w-sm rounded-2xl">
            <div className="max-h-[min(92dvh,44rem)] min-h-0 overflow-hidden rounded-2xl ring-1 ring-[var(--panel-border)]">
              {formShell}
            </div>
          </div>
        </div>
        {photoLightboxOverlay}
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] gap-0 overflow-hidden border-[var(--panel-border)] bg-transparent p-0 shadow-none sm:max-w-md [&>button]:z-50">
          {formShell}
        </DialogContent>
      </Dialog>
      {photoLightboxOverlay}
      {moveTraceDialog}
      {deleteTraceDialog}
    </>
  );
}

type TraceFormDialogTriggerProps = {
  journalId: string;
  trace: Trace;
  label?: string;
} & Pick<ComponentProps<typeof Button>, "variant" | "size" | "className">;

/** Opens {@link TraceFormDialog} — use instead of an external Edit control. */
export function TraceFormDialogTrigger({
  journalId,
  trace,
  label = "Edit",
  variant = "outline",
  size = "sm",
  className,
}: TraceFormDialogTriggerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn("rounded-xl", className)}
        onClick={() => setDialogOpen(true)}
      >
        <Pencil className="size-4" aria-hidden />
        {label}
      </Button>
      <TraceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        journalId={journalId}
        trace={trace}
      />
    </>
  );
}
