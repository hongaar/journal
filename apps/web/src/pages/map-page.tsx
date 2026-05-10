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
import { TraceMap, type TraceMapHandle } from "@/components/map/trace-map";
import type { TraceWithTags } from "@/lib/trace-with-tags";
import { TraceMapSidebar } from "@/components/map/trace-map-sidebar";
import { TraceFormDialog } from "@/components/traces/trace-form-dialog";
import { TraceMapQuickAddDialog } from "@/components/traces/trace-map-quick-add-dialog";
import { reversePhotonPlaceDetails } from "@/lib/photon-geocode";
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
  parseSelectedTraceTokenFromSearchParams,
  resolveTraceIdFromMapToken,
  stripMapBboxFromSearchParams,
  type MapCamera,
} from "@/lib/map-view-params";
import {
  readStoredMapCamera,
  writeStoredMapCamera,
} from "@/lib/map-camera-storage";
import { cn } from "@/lib/utils";
import type { Tag, Trace } from "@/types/database";
import { toast } from "sonner";
import { useJournalSlugRouteSync } from "@/hooks/use-journal-slug-route-sync";
import { useMaxSm } from "@/hooks/use-max-sm";
import { useNavigationShell } from "@/providers/navigation-shell-provider";

export function MapPage() {
  const qc = useQueryClient();
  const { sidebarOpen, setSidebarOpen } = useNavigationShell();
  const isMobile = useMaxSm();
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
  const {
    activeJournalId,
    activeJournal,
    loading: journalLoading,
  } = useJournal();
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
  const [placementActive, setPlacementActive] = useState(false);
  const [quickAddTrace, setQuickAddTrace] = useState<Trace | null>(null);
  const [quickAddAnchorScreen, setQuickAddAnchorScreen] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [fullEditTrace, setFullEditTrace] = useState<Trace | null>(null);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [tagEditTarget, setTagEditTarget] = useState<Tag | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(DEFAULT_TRACE_TAG_COLOR);
  const [newTagEmoji, setNewTagEmoji] = useState("📍");
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

  const traces = useMemo(() => tracesQuery.data ?? [], [tracesQuery.data]);

  const sidebarTraceToken = useMemo(
    () => parseSelectedTraceTokenFromSearchParams(searchParams),
    [searchParams],
  );
  const sidebarTraceId = useMemo(
    () => resolveTraceIdFromMapToken(sidebarTraceToken, traces),
    [sidebarTraceToken, traces],
  );

  const onSelectTrace = useCallback(
    (id: string) => {
      setQuickAddTrace(null);
      setQuickAddAnchorScreen(null);
      const row = traces.find((x) => x.id === id);
      const token = row?.slug ?? id;
      setSearchParams((prev) => applySelectedTraceToSearchParams(prev, token), {
        replace: true,
      });
    },
    [setSearchParams, traces],
  );

  const onCloseTraceMapPopover = useCallback(() => {
    setSearchParams((prev) => applySelectedTraceToSearchParams(prev, null), {
      replace: true,
    });
  }, [setSearchParams]);

  const onPlacementClick = useCallback(
    async (lng: number, lat: number) => {
      if (!activeJournalId) return;
      setSearchParams((prev) => applySelectedTraceToSearchParams(prev, null), {
        replace: true,
      });

      try {
        const { fullLabel, shortTitle } = await reversePhotonPlaceDetails(
          lat,
          lng,
        );
        const { data: row, error } = await supabase
          .from("traces")
          .insert({
            journal_id: activeJournalId,
            title: shortTitle || null,
            location_label: fullLabel?.trim() || null,
            lat,
            lng,
          })
          .select("*")
          .single();
        if (error) throw error;
        await qc.invalidateQueries({ queryKey: ["traces", activeJournalId] });

        const p = mapRef.current?.lngLatToScreen(lng, lat);
        setQuickAddAnchorScreen(p ?? null);
        setQuickAddTrace(row as Trace);
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not create trace here.",
        );
      }
    },
    [activeJournalId, qc, setSearchParams],
  );

  /** Stable marker lng/lat for trace popover while detail query loads (avoids fixed→floating flash). */
  const tracePopoverListAnchor = useMemo(() => {
    if (!sidebarTraceId) return null;
    const t = traces.find((x) => x.id === sidebarTraceId);
    if (
      !t ||
      typeof t.lat !== "number" ||
      typeof t.lng !== "number" ||
      !Number.isFinite(t.lat) ||
      !Number.isFinite(t.lng)
    )
      return null;
    return { lat: t.lat, lng: t.lng };
  }, [sidebarTraceId, traces]);

  useEffect(() => {
    if (!sidebarTraceToken) return;
    // While the active journal's traces are still loading, do not strip ?trace= — the token may
    // belong to the new journal (e.g. global search) and is not in the previous list yet.
    if (tracesQuery.isPending) return;
    if (traces.length === 0) return;
    if (resolveTraceIdFromMapToken(sidebarTraceToken, traces)) return;
    setSearchParams((prev) => applySelectedTraceToSearchParams(prev, null), {
      replace: true,
    });
  }, [sidebarTraceToken, traces, tracesQuery.isPending, setSearchParams]);

  useEffect(() => {
    if (!quickAddTrace) return;
    const { lat, lng } = quickAddTrace;
    const map = mapRef.current;
    if (!map) return;
    const upd = () => {
      const p = map.lngLatToScreen(lng, lat);
      if (p) setQuickAddAnchorScreen(p);
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
  }, [quickAddTrace]);

  useEffect(() => {
    if (!placementActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlacementActive(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placementActive]);

  useEffect(() => {
    if (!sidebarTraceToken) return;
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
  }, [sidebarTraceToken, setSearchParams]);

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
          previewPin={null}
          onSelectTrace={onSelectTrace}
          placementMode={placementActive}
          onPlacementClick={onPlacementClick}
          initialCamera={resolvedInitialCamera}
          initialBbox={bboxFromUrl}
          cameraSyncKey={cameraSyncKey}
          onCameraIdle={onCameraIdle}
          onMapBackgroundClick={
            sidebarTraceId ? onCloseTraceMapPopover : undefined
          }
          className="absolute inset-0 z-0 min-h-0"
        />
        {/* Stack under mobile nav-dismiss overlay so controls dim + deactivate with the map */}
        <div className="pointer-events-none absolute inset-0 z-[8]">
          <MapControlsToolbar
            mapRef={mapRef}
            className="pointer-events-auto absolute top-[calc(var(--app-toolbar-h)+0.75rem)] right-3 sm:right-4 sm:top-[calc(var(--app-toolbar-h)+1rem)]"
          />
        </div>
        <div className="pointer-events-none absolute inset-0 z-[8]">
          <div className="pointer-events-auto absolute right-4 bottom-6 sm:right-6">
            <AddTraceFab
              active={placementActive}
              onClick={toggleAddTracePlacement}
            />
          </div>
        </div>
        {isMobile ? (
          <button
            type="button"
            tabIndex={sidebarOpen ? 0 : -1}
            className={cn(
              "absolute inset-0 z-[25] border-0 bg-black/45 p-0 transition-opacity duration-200 outline-none touch-none",
              sidebarOpen
                ? "cursor-default opacity-100"
                : "pointer-events-none cursor-default opacity-0",
            )}
            aria-hidden={!sidebarOpen}
            aria-label={sidebarOpen ? "Dismiss navigation sidebar" : undefined}
            onClick={sidebarOpen ? () => setSidebarOpen(false) : undefined}
          />
        ) : null}
      </div>

      {placementActive ? (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 flex max-w-[min(calc(100vw-2rem),22rem)] -translate-x-1/2 justify-center px-4">
          <p className="border-border/50 bg-background/92 text-foreground supports-backdrop-filter:backdrop-blur-sm rounded-xl border px-4 py-2.5 text-center text-xs leading-snug font-medium shadow-lg">
            Tap the map to add a trace · Esc or Stop adding to cancel
          </p>
        </div>
      ) : null}

      {sidebarTraceId ? (
        <TraceMapSidebar
          key={isMobile ? "trace-map-sidebar-mobile" : `${sidebarTraceId}-lg`}
          traceId={sidebarTraceId}
          journalId={activeJournalId}
          journalSlug={
            journalSlug?.trim() || activeJournal?.slug?.trim() || null
          }
          mapRef={mapRef}
          listAnchorLngLat={tracePopoverListAnchor}
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

      <TraceMapQuickAddDialog
        open={Boolean(quickAddTrace)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setQuickAddTrace(null);
            setQuickAddAnchorScreen(null);
          }
        }}
        journalId={activeJournalId}
        trace={quickAddTrace}
        anchorScreen={quickAddTrace ? quickAddAnchorScreen : null}
        onEdit={(t) => {
          setQuickAddTrace(null);
          setQuickAddAnchorScreen(null);
          setFullEditTrace(t);
        }}
      />
      <TraceFormDialog
        open={Boolean(fullEditTrace)}
        onOpenChange={(open) => {
          if (!open) setFullEditTrace(null);
        }}
        journalId={activeJournalId}
        trace={fullEditTrace}
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
