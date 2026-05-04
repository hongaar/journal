import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useJournal } from "@/providers/journal-provider";
import { TraceActionsToolbar } from "@/components/traces/trace-actions-toolbar";
import {
  TraceMap,
  type TraceMapHandle,
  type TraceMapPreviewPin,
} from "@/components/map/trace-map";
import type { TraceWithTags } from "@/lib/trace-with-tags";
import { TraceMapSidebar } from "@/components/map/trace-map-sidebar";
import { TraceFormDialog } from "@/components/traces/trace-form-dialog";
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
import { FloatingPanel } from "@/components/layout/floating-panel";
import {
  applyFilterTagIdsToSearchParams,
  applyMapCameraToSearchParams,
  applySelectedTraceToSearchParams,
  cameraToSyncKey,
  normalizeCameraForUrl,
  parseFilterTagIdsFromSearchParams,
  parseMapCameraFromSearchParams,
  parseSelectedTraceIdFromSearchParams,
  type MapCamera,
} from "@/lib/map-view-params";
import { readStoredMapCamera, writeStoredMapCamera } from "@/lib/map-camera-storage";

export function MapPage() {
  const qc = useQueryClient();
  const mapRef = useRef<TraceMapHandle>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const cameraFromUrl = useMemo(() => parseMapCameraFromSearchParams(searchParams), [searchParams]);
  const { activeJournalId, loading: journalLoading } = useJournal();
  const resolvedInitialCamera = useMemo((): MapCamera | null => {
    if (cameraFromUrl) return cameraFromUrl;
    return readStoredMapCamera(activeJournalId);
  }, [cameraFromUrl, activeJournalId]);
  const sidebarTraceId = useMemo(() => parseSelectedTraceIdFromSearchParams(searchParams), [searchParams]);
  const cameraSyncKey = useMemo(() => {
    if (cameraFromUrl) return `url:${cameraToSyncKey(cameraFromUrl)}`;
    if (resolvedInitialCamera) return `init:${cameraToSyncKey(resolvedInitialCamera)}`;
    return "";
  }, [cameraFromUrl, resolvedInitialCamera]);
  const cameraIdleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [placementActive, setPlacementActive] = useState(false);
  const [placedCoords, setPlacedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [anchorScreen, setAnchorScreen] = useState<{ x: number; y: number } | null>(null);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#2d6a5d");
  const [newTagEmoji, setNewTagEmoji] = useState("📍");
  const [newTraceTagIds, setNewTraceTagIds] = useState<string[]>([]);
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
  const onNewTraceTagIdsChange = useCallback((ids: string[]) => {
    setNewTraceTagIds(ids);
  }, []);

  const onFitVisibleTraces = useCallback(() => {
    mapRef.current?.fitVisibleTraces();
  }, []);

  useEffect(() => {
    return () => clearTimeout(cameraIdleTimerRef.current);
  }, []);

  const onCameraIdle = useCallback(
    (c: MapCamera) => {
      clearTimeout(cameraIdleTimerRef.current);
      cameraIdleTimerRef.current = setTimeout(() => {
        const normalized = normalizeCameraForUrl(c);
        writeStoredMapCamera(activeJournalId, normalized);
        setSearchParams(
          (prev) => {
            const parsed = parseMapCameraFromSearchParams(prev);
            if (parsed && cameraToSyncKey(parsed) === cameraToSyncKey(normalized)) return prev;
            return applyMapCameraToSearchParams(prev, normalized);
          },
          { replace: true },
        );
      }, 280);
    },
    [activeJournalId, setSearchParams],
  );

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

  const previewPin = useMemo((): TraceMapPreviewPin | null => {
    if (!formOpen || !placedCoords) return null;
    const tags = tagsQuery.data ?? [];
    const ordered = newTraceTagIds.map((id) => tags.find((t) => t.id === id)).filter(Boolean);
    const first = ordered[0];
    return {
      lat: placedCoords.lat,
      lng: placedCoords.lng,
      color: first?.color ?? null,
      icon: first?.icon_emoji ?? "📍",
    };
  }, [formOpen, placedCoords, newTraceTagIds, tagsQuery.data]);

  const onSelectTrace = useCallback(
    (id: string) => {
      setFormOpen(false);
      setPlacedCoords(null);
      setAnchorScreen(null);
      setNewTraceTagIds([]);
      setSearchParams((prev) => applySelectedTraceToSearchParams(prev, id), { replace: true });
    },
    [setSearchParams],
  );

  const onPlacementClick = useCallback((lng: number, lat: number) => {
    setPlacementActive(false);
    setPlacedCoords({ lat, lng });
    setSearchParams((prev) => applySelectedTraceToSearchParams(prev, null), { replace: true });
    const p = mapRef.current?.lngLatToScreen(lng, lat);
    setAnchorScreen(p ?? null);
    setFormOpen(true);
  }, [setSearchParams]);

  const traces = useMemo(() => tracesQuery.data ?? [], [tracesQuery.data]);

  useEffect(() => {
    if (!sidebarTraceId || traces.length === 0) return;
    if (traces.some((t) => t.id === sidebarTraceId)) return;
    setSearchParams((prev) => applySelectedTraceToSearchParams(prev, null), { replace: true });
  }, [sidebarTraceId, traces, setSearchParams]);

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
    upd();
    const raf = requestAnimationFrame(upd);
    const unsub = map.subscribeCamera(upd);
    window.addEventListener("resize", upd);
    return () => {
      cancelAnimationFrame(raf);
      unsub();
      window.removeEventListener("resize", upd);
    };
  }, [formOpen, placedCoords]);

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
      if (e.key === "Escape") {
        setSearchParams((prev) => applySelectedTraceToSearchParams(prev, null), { replace: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarTraceId, setSearchParams]);

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
      setSearchParams((p) => applySelectedTraceToSearchParams(p, null), { replace: true });
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
          selectedTraceId={sidebarTraceId}
          previewPin={previewPin}
          onSelectTrace={onSelectTrace}
          placementMode={placementActive}
          onPlacementClick={onPlacementClick}
          initialCamera={resolvedInitialCamera}
          cameraSyncKey={cameraSyncKey}
          onCameraIdle={onCameraIdle}
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
        <TraceActionsToolbar
          mode="map"
          placementActive={placementActive}
          onAddTrace={toggleAddTracePlacement}
          onNewTag={() => setTagDialogOpen(true)}
          onFitVisible={onFitVisibleTraces}
          tags={tagsQuery.data ?? []}
          filterTagIds={filterTagIds}
          setFilterTagIds={setFilterTagIds}
        />
      </div>

      {sidebarTraceId ? (
        <TraceMapSidebar
          traceId={sidebarTraceId}
          journalId={activeJournalId}
          onClose={() => setSearchParams((prev) => applySelectedTraceToSearchParams(prev, null), { replace: true })}
        />
      ) : null}

      <TraceFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setPlacedCoords(null);
            setAnchorScreen(null);
            setPlacementActive(false);
            setNewTraceTagIds([]);
          }
        }}
        journalId={activeJournalId}
        trace={null}
        defaultLat={formDefaults.lat}
        defaultLng={formDefaults.lng}
        anchorScreen={formOpen && placedCoords ? anchorScreen : null}
        onNewTraceTagIdsChange={onNewTraceTagIdsChange}
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
