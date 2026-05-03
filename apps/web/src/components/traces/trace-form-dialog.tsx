import { arrow, computePosition, flip, offset, shift, size } from "@floating-ui/dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Tag, Trace } from "@/types/database";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FloatingPanel } from "@/components/layout/floating-panel";

type TraceFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journalId: string;
  trace: Trace | null;
  defaultLat?: number;
  defaultLng?: number;
  /** For new traces: screen anchor → floating panel + arrow (no modal blur). */
  anchorScreen?: { x: number; y: number } | null;
};

const ARROW_PX = 10;

function staticSideForPlacement(placement: string): "top" | "right" | "bottom" | "left" {
  const side = placement.split("-")[0] ?? "bottom";
  if (side === "top") return "bottom";
  if (side === "bottom") return "top";
  if (side === "left") return "right";
  return "left";
}

export function TraceFormDialog({
  open,
  onOpenChange,
  journalId,
  trace,
  defaultLat = 0,
  defaultLng = 0,
  anchorScreen = null,
}: TraceFormDialogProps) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visitedAt, setVisitedAt] = useState("");
  const [lat, setLat] = useState(String(defaultLat));
  const [lng, setLng] = useState(String(defaultLng));
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layoutTick, setLayoutTick] = useState(0);
  const floatingRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLDivElement>(null);

  const floatingNew = Boolean(open && !trace && anchorScreen);

  useLayoutEffect(() => {
    if (!floatingNew || !anchorScreen) return;
    const floating = floatingRef.current;
    const arrowEl = arrowRef.current;
    if (!floating || !arrowEl) return;

    const virtualRef = {
      getBoundingClientRect: () =>
        new DOMRect(anchorScreen.x, anchorScreen.y, 0, 0),
    };

    void computePosition(virtualRef, floating, {
      placement: "right",
      strategy: "fixed",
      middleware: [
        offset(ARROW_PX + 4),
        flip({
          fallbackPlacements: ["left", "top", "bottom"],
        }),
        shift({ padding: 12, crossAxis: true }),
        size({
          padding: 12,
          apply({ availableHeight, availableWidth, elements }) {
            const maxH = Math.max(140, availableHeight);
            const maxW = Math.min(400, Math.max(288, availableWidth));
            Object.assign(elements.floating.style, {
              maxHeight: `${maxH}px`,
              maxWidth: `${maxW}px`,
            });
          },
        }),
        arrow({ element: arrowEl, padding: 8 }),
      ],
    }).then((data) => {
      const el = floatingRef.current;
      const arr = arrowRef.current;
      if (!el || !arr) return;

      Object.assign(el.style, {
        position: "fixed",
        left: `${data.x}px`,
        top: `${data.y}px`,
        right: "auto",
        bottom: "auto",
      });

      const ad = data.middlewareData.arrow;
      if (!ad) return;

      const { x: ax, y: ay } = ad;
      const staticSide = staticSideForPlacement(data.placement);
      const overlap = 1;

      Object.assign(arr.style, {
        position: "absolute",
        width: `${ARROW_PX}px`,
        height: `${ARROW_PX}px`,
        boxSizing: "border-box",
        transform: "rotate(45deg)",
        background: "var(--panel-bg)",
        borderLeft: "1px solid var(--panel-border)",
        borderTop: "1px solid var(--panel-border)",
        zIndex: "0",
        left: ax != null ? `${ax}px` : "",
        top: ay != null ? `${ay}px` : "",
        right: "auto",
        bottom: "auto",
        [staticSide]: `${-ARROW_PX / 2 - overlap}px`,
      });
    });
  }, [floatingNew, anchorScreen, layoutTick]);

  useEffect(() => {
    if (!floatingNew) return;
    const onResize = () => setLayoutTick((t) => t + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [floatingNew]);

  useEffect(() => {
    if (!floatingNew) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [floatingNew, onOpenChange]);

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
      setVisitedAt(trace.visited_at.slice(0, 16));
      setLat(String(trace.lat));
      setLng(String(trace.lng));
      void (async () => {
        const { data } = await supabase.from("trace_tags").select("tag_id").eq("trace_id", trace.id);
        setSelectedTags(new Set((data ?? []).map((r) => r.tag_id)));
      })();
    } else {
      setTitle("");
      setDescription("");
      setVisitedAt(new Date().toISOString().slice(0, 16));
      setLat(String(defaultLat));
      setLng(String(defaultLng));
      setSelectedTags(new Set());
    }
  }, [open, trace, defaultLat, defaultLng]);

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

    const visitedIso = new Date(visitedAt || Date.now()).toISOString();

    try {
      let traceId = trace?.id;
      if (trace) {
        const { error: uErr } = await supabase
          .from("traces")
          .update({
            title: title || null,
            description: description || null,
            lat: latN,
            lng: lngN,
            visited_at: visitedIso,
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
            lat: latN,
            lng: lngN,
            visited_at: visitedIso,
          })
          .select("id")
          .single();
        if (iErr || !row) throw iErr ?? new Error("No trace id");
        traceId = row.id;
      }

      if (!traceId) throw new Error("Missing trace id");

      const { error: dErr } = await supabase.from("trace_tags").delete().eq("trace_id", traceId);
      if (dErr) throw dErr;

      const tagRows = [...selectedTags].map((tag_id) => ({ trace_id: traceId, tag_id }));
      if (tagRows.length > 0) {
        const { error: tErr } = await supabase.from("trace_tags").insert(tagRows);
        if (tErr) throw tErr;
      }

      await qc.invalidateQueries({ queryKey: ["traces", journalId] });
      if (trace) await qc.invalidateQueries({ queryKey: ["trace", trace.id] });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const idSuffix = trace ? "e" : "n";

  const formFields = (
    <div className="grid gap-3 py-2">
      <div className="space-y-2">
        <Label htmlFor={`t-title-${idSuffix}`}>Title</Label>
        <Input id={`t-title-${idSuffix}`} value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-lg" />
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
        <Label htmlFor={`t-visited-${idSuffix}`}>Visited</Label>
        <Input
          id={`t-visited-${idSuffix}`}
          type="datetime-local"
          value={visitedAt}
          onChange={(e) => setVisitedAt(e.target.value)}
          className="rounded-lg"
        />
      </div>
      {trace ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label htmlFor={`t-lat-${idSuffix}`}>Latitude</Label>
            <Input id={`t-lat-${idSuffix}`} value={lat} onChange={(e) => setLat(e.target.value)} className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`t-lng-${idSuffix}`}>Longitude</Label>
            <Input id={`t-lng-${idSuffix}`} value={lng} onChange={(e) => setLng(e.target.value)} className="rounded-lg" />
          </div>
        </div>
      ) : null}
      <div className="space-y-2">
        <Label>Tags</Label>
        <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border/80 p-2">
          {(tagsQuery.data ?? []).map((tag) => (
            <label key={tag.id} className="flex cursor-pointer items-center gap-2 text-sm">
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
            <p className="text-muted-foreground text-sm">No tags yet — add one from the map tools.</p>
          ) : null}
        </div>
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );

  const formFooter = (
    <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-3 sm:flex-row sm:justify-end">
      <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
        Cancel
      </Button>
      <Button disabled={saving} className="rounded-xl" onClick={() => void save()}>
        Save
      </Button>
    </div>
  );

  if (floatingNew && anchorScreen) {
    return (
      <div ref={floatingRef} className="pointer-events-none z-[60] w-max min-w-0">
        <div ref={arrowRef} className="pointer-events-none" aria-hidden />
        <div className="pointer-events-auto relative z-[1]">
          <FloatingPanel className="max-h-[inherit] min-w-[288px] max-w-sm overflow-y-auto p-4 shadow-2xl">
            <h2 className="font-display text-foreground mb-1 text-xl font-semibold tracking-tight">New trace</h2>
            {formFields}
            {formFooter}
          </FloatingPanel>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[var(--panel-border)] bg-[var(--panel-bg)] backdrop-blur-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-semibold">{trace ? "Edit trace" : "New trace"}</DialogTitle>
        </DialogHeader>
        {formFields}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={() => void save()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
