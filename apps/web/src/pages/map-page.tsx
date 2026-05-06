import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SetStateAction,
} from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useJournal } from "@/providers/journal-provider";
import { MapControlsToolbar } from "@/components/map/map-controls-toolbar";
import { AddTraceFab } from "@/components/traces/add-trace-fab";
import { useMountTagSidebarRegistration } from "@/providers/tag-sidebar-provider";
import {
  TraceMap,
  type TraceMapHandle,
  type TraceMapPreviewPin,
} from "@/components/map/trace-map";
import type { TraceWithTags } from "@/lib/trace-with-tags";
import { TraceMapSidebar } from "@/components/map/trace-map-sidebar";
import { TraceFormDialog } from "@/components/traces/trace-form-dialog";
import { Button } from "@curolia/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@curolia/ui/dialog";
import { Input } from "@curolia/ui/input";
import { Label } from "@curolia/ui/label";
import { PresetColorPicker } from "@/components/traces/preset-color-picker";
import { EmojiPicker } from "@/components/traces/emoji-picker";
import { DEFAULT_TRACE_TAG_COLOR } from "@/lib/preset-trace-tag-colors";
import { FloatingPanel } from "@/components/layout/floating-panel";
import { JournalViewInitialLoader } from "@/components/layout/journal-view-initial-loader";
import {
  applyFilterTagsToSearchParams,
  applyMapCameraToSearchParams,
  applySelectedTraceToSearchParams,
  bboxToSyncKey,
  cameraToSyncKey,
  normalizeCameraForUrl,
  resolveFilterTagIdsFromSearchParams,
  parseMapBboxFromSearchParams,
  parseMapCameraFromSearchParams,
  parseSelectedTraceIdFromSearchParams,
  stripMapBboxFromSearchParams,
  type MapCamera,
} from "@/lib/map-view-params";
import {
  readStoredMapCamera,
  writeStoredMapCamera,
} from "@/lib/map-camera-storage";
import type { Tag } from "@/types/database";
import { useJournalSlugRouteSync } from "@/hooks/use-journal-slug-route-sync";

export function MapPage() {
  const qc = useQueryClient();
  const { journalSlug } = useParams<{ journalSlug: string }>();
  useJournalSlugRouteSync(journalSlug);
  const mapRef = useRef<TraceMapHandle>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const bboxFromUrl = useMemo(
    () => parseMapBboxFromSearchParams(searchParams),
    [searchParams],
  );
  const cameraFromUrl = useMemo(
    () => parseMapCameraFromSearchParams(searchParams),
    [searchParams],
  );
  const { activeJournalId, loading: journalLoading } = useJournal();
  const resolvedInitialCamera = useMemo((): MapCamera | null => {
    if (cameraFromUrl) return cameraFromUrl;
    if (bboxFromUrl) {
      return normalizeCameraForUrl({
        lat: (bboxFromUrl.south + bboxFromUrl.north) / 2,
        lng: (bboxFromUrl.west + bboxFromUrl.east) / 2,
        zoom: 10,
      });
    }
    return readStoredMapCamera(activeJournalId);
  }, [cameraFromUrl, bboxFromUrl, activeJournalId]);
  const sidebarTraceId = useMemo(
    () => parseSelectedTraceIdFromSearchParams(searchParams),
    [searchParams],
  );
  const cameraSyncKey = useMemo(() => {
    if (bboxFromUrl) return `url:bbox:${bboxToSyncKey(bboxFromUrl)}`;
    if (cameraFromUrl) return `url:${cameraToSyncKey(cameraFromUrl)}`;
    if (resolvedInitialCamera)
      return `init:${cameraToSyncKey(resolvedInitialCamera)}`;
    return "";
  }, [bboxFromUrl, cameraFromUrl, resolvedInitialCamera]);
  const cameraIdleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [formOpen, setFormOpen] = useState(false);
  const [placementActive, setPlacementActive] = useState(false);
  const [placedCoords, setPlacedCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [anchorScreen, setAnchorScreen] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [tagEditTarget, setTagEditTarget] = useState<Tag | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(DEFAULT_TRACE_TAG_COLOR);
  const [newTagEmoji, setNewTagEmoji] = useState("📍");
  const [newTraceTagIds, setNewTraceTagIds] = useState<string[]>([]);
  const onNewTraceTagIdsChange = useCallback((ids: string[]) => {
    setNewTraceTagIds(ids);
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
            const prevNoBbox = stripMapBboxFromSearchParams(prev);
            const parsed = parseMapCameraFromSearchParams(prevNoBbox);
            if (
              parsed &&
              cameraToSyncKey(parsed) === cameraToSyncKey(normalized)
            )
              return prevNoBbox;
            return applyMapCameraToSearchParams(prevNoBbox, normalized);
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
          trace_tags ( tag_id, tags ( id, name, color, icon_emoji ) ),
          photos ( id, storage_path, sort_order )`,
        )
        .eq("journal_id", activeJournalId)
        .order("date", { ascending: false, nullsFirst: false });
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

  const previewPin = useMemo((): TraceMapPreviewPin | null => {
    if (!formOpen || !placedCoords) return null;
    const tags = tagsQuery.data ?? [];
    const ordered = newTraceTagIds
      .map((id) => tags.find((t) => t.id === id))
      .filter(Boolean);
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
      setSearchParams((prev) => applySelectedTraceToSearchParams(prev, id), {
        replace: true,
      });
    },
    [setSearchParams],
  );

  const onPlacementClick = useCallback(
    (lng: number, lat: number) => {
      setPlacementActive(false);
      setPlacedCoords({ lat, lng });
      setSearchParams((prev) => applySelectedTraceToSearchParams(prev, null), {
        replace: true,
      });
      const p = mapRef.current?.lngLatToScreen(lng, lat);
      setAnchorScreen(p ?? null);
      setFormOpen(true);
    },
    [setSearchParams],
  );

  const traces = useMemo(() => tracesQuery.data ?? [], [tracesQuery.data]);

  useEffect(() => {
    if (!sidebarTraceId) return;
    // While the active journal's traces are still loading, do not strip ?trace= — the id may
    // belong to the new journal (e.g. global search) and is not in the previous list yet.
    if (tracesQuery.isPending) return;
    if (traces.length === 0) return;
    if (traces.some((t) => t.id === sidebarTraceId)) return;
    setSearchParams((prev) => applySelectedTraceToSearchParams(prev, null), {
      replace: true,
    });
  }, [sidebarTraceId, traces, tracesQuery.isPending, setSearchParams]);

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
        setSearchParams(
          (prev) => applySelectedTraceToSearchParams(prev, null),
          { replace: true },
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarTraceId, setSearchParams]);

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
        await qc.invalidateQueries({ queryKey: ["traces", activeJournalId] });
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

  function toggleAddTracePlacement() {
    setPlacementActive((prev) => {
      if (prev) return false;
      setSearchParams((p) => applySelectedTraceToSearchParams(p, null), {
        replace: true,
      });
      return true;
    });
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
          initialBbox={bboxFromUrl}
          cameraSyncKey={cameraSyncKey}
          onCameraIdle={onCameraIdle}
          className="absolute inset-0 z-0 min-h-0"
        />
      </div>

      {placementActive ? (
        <div className="pointer-events-none absolute top-[calc(var(--app-toolbar-h)+2.75rem)] left-1/2 z-20 w-[min(100%,22rem)] -translate-x-1/2 px-3">
          <FloatingPanel className="pointer-events-auto py-3 text-center shadow-xl">
            <p className="text-foreground text-sm font-medium">
              Click the map to place your trace
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Press Esc or cancel to stop
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 rounded-xl"
              onClick={() => setPlacementActive(false)}
            >
              Cancel
            </Button>
          </FloatingPanel>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-0 z-10">
        <MapControlsToolbar
          mapRef={mapRef}
          className="pointer-events-auto absolute top-[calc(var(--app-toolbar-h)+0.75rem)] right-3 z-10 sm:right-4 sm:top-[calc(var(--app-toolbar-h)+1rem)]"
        />
      </div>

      <div className="pointer-events-none absolute right-4 bottom-6 z-10 sm:right-6">
        <AddTraceFab
          active={placementActive}
          onClick={toggleAddTracePlacement}
        />
      </div>

      {sidebarTraceId ? (
        <TraceMapSidebar
          key={sidebarTraceId}
          traceId={sidebarTraceId}
          journalId={activeJournalId}
          onClose={() =>
            setSearchParams(
              (prev) => applySelectedTraceToSearchParams(prev, null),
              {
                replace: true,
              },
            )
          }
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
              <Label htmlFor="tag-name">Name</Label>
              <Input
                id="tag-name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
              />
            </div>
            <PresetColorPicker
              id="tag-color"
              label="Color"
              value={newTagColor}
              onChange={setNewTagColor}
            />
            <EmojiPicker
              id="tag-emoji"
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
