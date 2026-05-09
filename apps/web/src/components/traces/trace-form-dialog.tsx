import { Button } from "@curolia/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@curolia/ui/card";
import { Checkbox } from "@curolia/ui/checkbox";
import { Dialog, DialogContent } from "@curolia/ui/dialog";
import { Input } from "@curolia/ui/input";
import { Label } from "@curolia/ui/label";
import { Textarea } from "@curolia/ui/textarea";
import { mapAnchorPanelMiddleware } from "@/lib/map-anchor-floating-ui";
import { reversePhotonLocationLabel } from "@/lib/photon-geocode";
import { supabase } from "@/lib/supabase";
import type { Tag, Trace } from "@/types/database";
import { autoUpdate, computePosition } from "@floating-ui/dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMaxSm } from "@/hooks/use-max-sm";

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
  const floatingRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<{ x: number; y: number } | null>(null);

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
    if (!open) return;
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
  }, [open, lat, lng]);

  useEffect(() => {
    if (!open || trace) return;
    onNewTraceTagIdsChange?.([...selectedTags]);
  }, [open, trace, selectedTags, onNewTraceTagIdsChange]);

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

  const formFields = (
    <div className="grid gap-3 py-2">
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
      {trace || !anchorScreen ? (
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

  if (floatingNew && anchorScreen) {
    return (
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
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] gap-0 overflow-hidden border-[var(--panel-border)] bg-transparent p-0 shadow-none sm:max-w-md [&>button]:z-50">
        {formShell}
      </DialogContent>
    </Dialog>
  );
}
