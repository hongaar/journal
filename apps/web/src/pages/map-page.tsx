import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListFilter, Plus, Tag } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useJournal } from "@/providers/journal-provider";
import {
  MapToolbarGroup,
  MapToolbarIconButton,
  MAP_TOOLBAR_ICON_CELL,
  MAP_TOOLBAR_LABEL_CELL,
  MAP_TOOLBAR_TRIGGER_CLASS,
} from "@/components/map/map-toolbar";
import { TraceMap, type TraceMapHandle, type TraceWithTags } from "@/components/map/trace-map";
import { TraceMapSidebar } from "@/components/map/trace-map-sidebar";
import { TraceFormDialog } from "@/components/traces/trace-form-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const qc = useQueryClient();
  const mapRef = useRef<TraceMapHandle>(null);
  const { activeJournalId, loading: journalLoading } = useJournal();
  const [formOpen, setFormOpen] = useState(false);
  const [placementActive, setPlacementActive] = useState(false);
  const [placedCoords, setPlacedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [anchorScreen, setAnchorScreen] = useState<{ x: number; y: number } | null>(null);
  const [sidebarTraceId, setSidebarTraceId] = useState<string | null>(null);
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

  const onSelectTrace = useCallback((id: string) => {
    setFormOpen(false);
    setPlacedCoords(null);
    setAnchorScreen(null);
    setSidebarTraceId(id);
  }, []);

  const onPlacementClick = useCallback((lng: number, lat: number) => {
    setPlacementActive(false);
    setPlacedCoords({ lat, lng });
    setSidebarTraceId(null);
    const p = mapRef.current?.lngLatToScreen(lng, lat);
    setAnchorScreen(p ?? null);
    setFormOpen(true);
  }, []);

  const traces = useMemo(() => tracesQuery.data ?? [], [tracesQuery.data]);

  const formDefaults = useMemo(() => {
    if (placedCoords) return placedCoords;
    if (traces.length === 0) return { lat: 20, lng: 0 };
    return { lat: traces[0].lat, lng: traces[0].lng };
  }, [placedCoords, traces]);

  useEffect(() => {
    if (!formOpen || !placedCoords) return;
    const map = mapRef.current;
    if (!map) return;
    const upd = () => {
      const p = map.lngLatToScreen(placedCoords.lng, placedCoords.lat);
      if (p) setAnchorScreen(p);
    };
    return map.subscribeCamera(upd);
  }, [formOpen, placedCoords?.lat, placedCoords?.lng]);

  useEffect(() => {
    if (!placementActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlacementActive(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placementActive]);

  useEffect(() => {
    if (!sidebarTraceId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarTraceId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarTraceId]);

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
      setSidebarTraceId(null);
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
          ref={mapRef}
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

      <div className="pointer-events-none absolute inset-0 z-10 p-3 pt-[4.75rem] sm:p-4 sm:pt-[5.25rem]">
        <MapToolbarGroup>
          <MapToolbarIconButton
            icon={<Plus className="size-4" />}
            label={placementActive ? "Placing pin…" : "Add trace"}
            active={placementActive}
            onClick={toggleAddTracePlacement}
          />
          <MapToolbarIconButton
            icon={<Tag className="size-4" />}
            label="New tag"
            onClick={() => setTagDialogOpen(true)}
            className="bg-muted/20 hover:bg-muted/40"
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                MAP_TOOLBAR_TRIGGER_CLASS,
                filterTagIds.size > 0 && "bg-primary/8 ring-1 ring-inset ring-primary/15",
              )}
            >
              <span className={cn(MAP_TOOLBAR_ICON_CELL, "relative")}>
                <ListFilter className="size-4" />
                {filterTagIds.size > 0 ? (
                  <span className="bg-primary ring-background absolute top-1.5 right-1.5 size-1.5 rounded-full ring-2" />
                ) : null}
              </span>
              <span className={MAP_TOOLBAR_LABEL_CELL}>Filter</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" sideOffset={8} align="start" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Filter by tag</DropdownMenuLabel>
                {(tagsQuery.data ?? []).length === 0 ? (
                  <DropdownMenuItem disabled className="text-muted-foreground">
                    No tags yet
                  </DropdownMenuItem>
                ) : (
                  (tagsQuery.data ?? []).map((tag) => (
                    <DropdownMenuCheckboxItem
                      key={tag.id}
                      checked={filterTagIds.has(tag.id)}
                      onCheckedChange={(c) => {
                        setFilterTagIds((prev) => {
                          const next = new Set(prev);
                          if (c === true) next.add(tag.id);
                          else next.delete(tag.id);
                          return next;
                        });
                      }}
                    >
                      <span className="text-base">{tag.icon_emoji}</span>
                      {tag.name}
                    </DropdownMenuCheckboxItem>
                  ))
                )}
              </DropdownMenuGroup>
              {filterTagIds.size > 0 ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setFilterTagIds(new Set());
                    }}
                  >
                    Clear filters
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </MapToolbarGroup>
      </div>

      {sidebarTraceId ? (
        <TraceMapSidebar traceId={sidebarTraceId} journalId={activeJournalId} onClose={() => setSidebarTraceId(null)} />
      ) : null}

      <TraceFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setPlacedCoords(null);
            setAnchorScreen(null);
            setPlacementActive(false);
          }
        }}
        journalId={activeJournalId}
        trace={null}
        defaultLat={formDefaults.lat}
        defaultLng={formDefaults.lng}
        anchorScreen={formOpen && placedCoords ? anchorScreen : null}
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
