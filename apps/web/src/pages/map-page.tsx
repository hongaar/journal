import { useCallback, useEffect, useMemo, useState, type SetStateAction } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Tag } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useJournal } from "@/providers/journal-provider";
import { TraceMap, type TraceWithTags } from "@/components/map/trace-map";
import { TraceFormDialog } from "@/components/traces/trace-form-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FloatingPanel } from "@/components/layout/floating-panel";
import { cn } from "@/lib/utils";

export function MapPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { activeJournalId, loading: journalLoading } = useJournal();
  const [formOpen, setFormOpen] = useState(false);
  const [placementActive, setPlacementActive] = useState(false);
  const [placedCoords, setPlacedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#2d6a5d");
  const [newTagEmoji, setNewTagEmoji] = useState("📍");
  const [filterTagIds, setFilterTagIdsState] = useState<Set<string>>(() => new Set());
  const setFilterTagIds = useCallback((action: SetStateAction<Set<string>>) => {
    setFilterTagIdsState((prev) => (typeof action === "function" ? action(prev) : action));
  }, []);

  const tracesQuery = useQuery({
    queryKey: ["traces", activeJournalId],
    queryFn: async () => {
      if (!activeJournalId) return [];
      const { data, error } = await supabase
        .from("traces")
        .select(
          `*,
          trace_tags ( tag_id, tags ( id, name, color, icon_emoji ) )`,
        )
        .eq("journal_id", activeJournalId)
        .order("visited_at", { ascending: false });
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

  const onSelectTrace = useCallback(
    (id: string) => {
      navigate(`/traces/${id}`);
    },
    [navigate],
  );

  const onPlacementClick = useCallback((lng: number, lat: number) => {
    setPlacementActive(false);
    setPlacedCoords({ lat, lng });
    setFormOpen(true);
  }, []);

  const traces = useMemo(() => tracesQuery.data ?? [], [tracesQuery.data]);

  const formDefaults = useMemo(() => {
    if (placedCoords) return placedCoords;
    if (traces.length === 0) return { lat: 20, lng: 0 };
    return { lat: traces[0].lat, lng: traces[0].lng };
  }, [placedCoords, traces]);

  useEffect(() => {
    if (!placementActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlacementActive(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placementActive]);

  async function createTag() {
    if (!activeJournalId || !newTagName.trim()) return;
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

  function toggleAddTracePlacement() {
    setPlacementActive((prev) => {
      if (prev) return false;
      return true;
    });
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
    <div className="relative h-full w-full">
      <div className="absolute inset-0 z-0">
        <div
          className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,transparent_45%,oklch(0.35_0.04_260/0.12)_100%)]"
          aria-hidden
        />
        <TraceMap
          traces={traces}
          selectedTagIds={filterTagIds}
          onSelectTrace={onSelectTrace}
          placementMode={placementActive}
          onPlacementClick={onPlacementClick}
          className="absolute inset-0 z-0 min-h-0"
        />
      </div>

      {placementActive ? (
        <div className="pointer-events-none absolute top-[4.5rem] left-1/2 z-20 w-[min(100%,22rem)] -translate-x-1/2 px-3 sm:top-[5rem]">
          <FloatingPanel className="pointer-events-auto py-3 text-center shadow-xl">
            <p className="text-foreground text-sm font-medium">Click the map to place your trace</p>
            <p className="text-muted-foreground mt-1 text-xs">Press Esc or cancel to stop</p>
            <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={() => setPlacementActive(false)}>
              Cancel
            </Button>
          </FloatingPanel>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 pt-[4.75rem] sm:p-4 sm:pt-[5.25rem]">
        <div className="flex min-h-0 flex-1 flex-col gap-3 sm:flex-row sm:justify-between">
          <FloatingPanel className="pointer-events-auto flex w-fit max-w-full shrink-0 flex-col gap-2 self-start p-2 sm:p-3">
            <Button
              size="sm"
              className={cn(
                "h-10 justify-start gap-2 rounded-xl px-4 shadow-sm",
                placementActive && "ring-2 ring-primary ring-offset-2 ring-offset-[var(--panel-bg)]",
              )}
              onClick={toggleAddTracePlacement}
            >
              <Plus className="size-4" />
              {placementActive ? "Placing pin…" : "Add trace"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-10 justify-start gap-2 rounded-xl border-0 bg-foreground/5 px-4 shadow-none hover:bg-foreground/10"
              onClick={() => setTagDialogOpen(true)}
            >
              <Tag className="size-4" />
              New tag
            </Button>
          </FloatingPanel>

          <FloatingPanel className="pointer-events-auto mt-auto flex max-h-[min(42vh,22rem)] w-full max-w-full flex-col gap-2 overflow-hidden p-3 sm:mt-0 sm:max-h-[calc(100svh-6.5rem)] sm:w-72 sm:max-w-[min(100%,18rem)] sm:self-start sm:p-4">
            <p className="font-display text-foreground text-base font-semibold tracking-tight">Filter by tag</p>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {(tagsQuery.data ?? []).length === 0 ? (
                <p className="text-muted-foreground text-sm">No tags yet.</p>
              ) : (
                (tagsQuery.data ?? []).map((tag) => (
                  <label key={tag.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
                    <Checkbox
                      checked={filterTagIds.has(tag.id)}
                      onCheckedChange={(c) => {
                        setFilterTagIds((prev) => {
                          const next = new Set(prev);
                          if (c === true) next.add(tag.id);
                          else next.delete(tag.id);
                          return next;
                        });
                      }}
                    />
                    <span className="text-base leading-none">{tag.icon_emoji}</span>
                    <span className="truncate">{tag.name}</span>
                  </label>
                ))
              )}
            </div>
            {filterTagIds.size > 0 ? (
              <Button variant="ghost" size="sm" className="h-9 w-full shrink-0 rounded-xl" onClick={() => setFilterTagIds(new Set())}>
                Clear filters
              </Button>
            ) : null}
          </FloatingPanel>
        </div>
      </div>

      <TraceFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setPlacedCoords(null);
            setPlacementActive(false);
          }
        }}
        journalId={activeJournalId}
        trace={null}
        defaultLat={formDefaults.lat}
        defaultLng={formDefaults.lng}
      />
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent className="border-[var(--panel-border)] bg-[var(--panel-bg)] backdrop-blur-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-semibold">New tag</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="tag-name">Name</Label>
              <Input id="tag-name" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tag-color">Color</Label>
              <Input
                id="tag-color"
                type="color"
                className="h-10 w-full cursor-pointer rounded-lg"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tag-emoji">Icon (emoji)</Label>
              <Input id="tag-emoji" value={newTagEmoji} onChange={(e) => setNewTagEmoji(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void createTag()}>Create tag</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
