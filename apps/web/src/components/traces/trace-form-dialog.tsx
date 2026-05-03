import { useEffect, useState } from "react";
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

type TraceFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journalId: string;
  /** When set, edit existing trace */
  trace: Trace | null;
  defaultLat?: number;
  defaultLng?: number;
};

export function TraceFormDialog({
  open,
  onOpenChange,
  journalId,
  trace,
  defaultLat = 0,
  defaultLng = 0,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[var(--panel-border)] bg-[var(--panel-bg)] backdrop-blur-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-semibold">{trace ? "Edit trace" : "New trace"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-2">
            <Label htmlFor="t-title">Title</Label>
            <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-desc">Description</Label>
            <Textarea id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-visited">Visited</Label>
            <Input
              id="t-visited"
              type="datetime-local"
              value={visitedAt}
              onChange={(e) => setVisitedAt(e.target.value)}
            />
          </div>
          {trace ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="t-lat">Latitude</Label>
                <Input id="t-lat" value={lat} onChange={(e) => setLat(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-lng">Longitude</Label>
                <Input id="t-lng" value={lng} onChange={(e) => setLng(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Location</Label>
              <div className="text-muted-foreground rounded-xl border border-border/80 bg-muted/40 px-3 py-2.5 text-sm">
                <span className="text-foreground font-medium">Pinned on map</span>
                <span className="mt-1 block font-mono text-xs tracking-tight">
                  {Number(lat).toFixed(5)}°, {Number(lng).toFixed(5)}°
                </span>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-2">
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
                <p className="text-muted-foreground text-sm">No tags yet — add one from the map page.</p>
              ) : null}
            </div>
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </div>
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
