import {
  cameraToSyncKey,
  isValidMapBbox,
  normalizeCameraForUrl,
  type MapBbox,
  type MapCamera,
} from "@/lib/map-view-params";
import { filterTracesByTags, type TraceWithTags } from "@/lib/trace-with-tags";
import { cn, contrastingForeground } from "@/lib/utils";
import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
} from "@floating-ui/dom";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "next-themes";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

const HOVER_LEAVE_MS = 140;

/** Marker hover preview: screen x/y updated while the map camera moves. */
type TraceHoverPreview = {
  trace: TraceWithTags;
  lng: number;
  lat: number;
  x: number;
  y: number;
};

export type { TraceWithTags };

export type TraceMapHandle = {
  lngLatToScreen: (lng: number, lat: number) => { x: number; y: number } | null;
  subscribeCamera: (cb: () => void) => () => void;
  /** Fit map camera to currently filtered traces (same logic as former auto-fit). */
  fitVisibleTraces: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  /** Request browser geolocation and fly the map toward the user's position. */
  triggerGeolocate: () => void;
};

export type TraceMapPreviewPin = {
  lat: number;
  lng: number;
  color: string | null;
  icon: string;
};

type TraceMapProps = {
  traces: TraceWithTags[];
  selectedTagIds: Set<string>;
  onSelectTrace: (id: string) => void;
  /** Trace whose detail panel is open — distinct marker styling. */
  selectedTraceId?: string | null;
  /** Draft pin while creating a trace (e.g. New trace dialog). */
  previewPin?: TraceMapPreviewPin | null;
  placementMode?: boolean;
  onPlacementClick?: (lng: number, lat: number) => void;
  className?: string;
  /** When set (from URL or localStorage fallback), map uses this view. */
  initialCamera?: MapCamera | null;
  /** When set (from URL), map fits this extent with padding instead of center/zoom fly. */
  initialBbox?: MapBbox | null;
  /** Stable key for the active camera source (`url:…` | `init:…`); when it changes, the map jumps to `initialCamera`. */
  cameraSyncKey?: string;
  /** Fired after pan/zoom settles (moveend); used to persist camera in the address bar. */
  onCameraIdle?: (camera: MapCamera) => void;
  /** Map canvas click when not in placement mode (e.g. dismiss nav overlay on mobile). */
  onMapBackgroundClick?: () => void;
};

const MAP_STYLE_LIGHT = "https://tiles.openfreemap.org/styles/positron";
const MAP_STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";

function mapStyleUrlForTheme(resolvedTheme: string | undefined): string {
  if (resolvedTheme === "dark") return MAP_STYLE_DARK;
  if (resolvedTheme === "light") return MAP_STYLE_LIGHT;
  if (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
  ) {
    return MAP_STYLE_DARK;
  }
  return MAP_STYLE_LIGHT;
}

const CAMERA_DURATION_MS = 850;
const CAMERA_PADDING = 80;
const CAMERA_MAX_ZOOM = 14;
const SINGLE_TRACE_ZOOM = 10;

function geolocationToastMessage(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as GeolocationPositionError).code;
    if (code === 1) return "Location permission denied.";
    if (code === 2) return "Position unavailable.";
    if (code === 3) return "Location request timed out.";
  }
  if (err instanceof Error) return err.message;
  return "Could not get your location.";
}

function styleTraceMarkerFace(
  el: HTMLElement,
  opts: {
    emoji: string;
    fill: string | null;
    selected: boolean;
    hovered?: boolean;
    interactive: boolean;
    draft?: boolean;
  },
) {
  el.textContent = opts.emoji;
  const fill = opts.fill;
  const draft = Boolean(opts.draft);
  const hovered = Boolean(opts.hovered);
  el.className = cn(
    "flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/80 text-lg shadow-md transition-[box-shadow,filter]",
    opts.interactive &&
      "cursor-pointer hover:shadow-lg hover:brightness-105 active:brightness-95",
    !fill && "bg-primary text-primary-foreground",
    draft &&
      "ring-[3px] ring-dashed ring-primary ring-offset-2 ring-offset-background shadow-lg",
    !draft &&
      opts.selected &&
      "ring-[3px] ring-primary ring-offset-2 ring-offset-background shadow-lg",
    !draft &&
      !opts.selected &&
      hovered &&
      "ring-[3px] ring-[var(--map-marker-ring)] ring-offset-2 ring-offset-background shadow-lg",
    !draft &&
      !opts.selected &&
      !hovered &&
      "ring-2 ring-[var(--map-marker-ring)]/40 hover:ring-[var(--map-marker-ring)]/55 hover:shadow-lg",
  );
  el.style.backgroundColor = fill ?? "";
  el.style.color = fill ? contrastingForeground(fill) : "";
}

function cameraCloseEnough(map: maplibregl.Map, target: MapCamera) {
  const cur = map.getCenter();
  return (
    Math.abs(cur.lng - target.lng) < 1e-4 &&
    Math.abs(cur.lat - target.lat) < 1e-4 &&
    Math.abs(map.getZoom() - target.zoom) < 0.02
  );
}

export const TraceMap = forwardRef<TraceMapHandle, TraceMapProps>(
  function TraceMap(
    {
      traces,
      selectedTagIds,
      onSelectTrace,
      selectedTraceId = null,
      previewPin = null,
      placementMode = false,
      onPlacementClick,
      className,
      initialCamera = null,
      initialBbox = null,
      cameraSyncKey = "",
      onCameraIdle,
      onMapBackgroundClick,
    },
    ref,
  ) {
    const { resolvedTheme } = useTheme();
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [traceHover, setTraceHover] = useState<TraceHoverPreview | null>(
      null,
    );
    const hoverFloatingRef = useRef<HTMLDivElement>(null);
    const hoverAnchorRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    const hoverVirtualReference = useMemo(
      () => ({
        getBoundingClientRect() {
          const a = hoverAnchorRef.current;
          return new DOMRect(a.x, a.y, 0, 0);
        },
      }),
      [],
    );
    const appliedMapStyleUrlRef = useRef<string>("");
    const markersRef = useRef<maplibregl.Marker[]>([]);
    /** Inner face element (MapLibre marker root is a wrapper we never className-replace). */
    const markerElByTraceIdRef = useRef<Map<string, HTMLElement>>(new Map());
    const markerRootByTraceIdRef = useRef<Map<string, HTMLDivElement>>(
      new Map(),
    );
    const previewMarkerRef = useRef<maplibregl.Marker | null>(null);
    const onPlacementClickRef = useRef(onPlacementClick);
    const onCameraIdleRef = useRef(onCameraIdle);
    const onMapBackgroundClickRef = useRef(onMapBackgroundClick);
    /** Last `cameraSyncKey` we applied from props (URL / deep link), not user idle echo. */
    const lastAppliedSyncKeyRef = useRef<string>("");
    /** `cameraToSyncKey(normalizeCameraForUrl(…))` last sent to parent via onCameraIdle — detects idle→URL→props echo. */
    const lastEmittedCameraKeyRef = useRef<string | null>(null);
    const cameraSyncKeyRef = useRef(cameraSyncKey);
    const initialBboxRef = useRef(initialBbox);
    const initialCameraRef = useRef(initialCamera);
    /** Invalidate deferred URL-apply callbacks when a newer sync generation starts. */
    const urlApplyGenerationRef = useRef(0);

    const filtered = useMemo(
      () => filterTracesByTags(traces, selectedTagIds),
      [traces, selectedTagIds],
    );
    const filteredRef = useRef(filtered);
    const selectedTraceIdRef = useRef(selectedTraceId);
    const latestTraceHoverIdRef = useRef<string | null>(null);

    useLayoutEffect(() => {
      onPlacementClickRef.current = onPlacementClick;
      onCameraIdleRef.current = onCameraIdle;
      onMapBackgroundClickRef.current = onMapBackgroundClick;
      filteredRef.current = filtered;
      selectedTraceIdRef.current = selectedTraceId;
      latestTraceHoverIdRef.current = traceHover?.trace.id ?? null;
    }, [
      onPlacementClick,
      onCameraIdle,
      onMapBackgroundClick,
      filtered,
      selectedTraceId,
      traceHover,
    ]);

    const applyMarkerHoverStack = useCallback((hoveredId: string | null) => {
      for (const t of filteredRef.current) {
        const face = markerElByTraceIdRef.current.get(t.id);
        const root = markerRootByTraceIdRef.current.get(t.id);
        if (!face || !root) continue;
        const tag0 = t.trace_tags?.[0]?.tags;
        const fill = tag0?.color ?? null;
        const emoji = tag0?.icon_emoji ?? "📍";
        styleTraceMarkerFace(face, {
          emoji,
          fill,
          selected: t.id === selectedTraceIdRef.current,
          hovered: hoveredId !== null && t.id === hoveredId,
          interactive: true,
        });
        const raised =
          t.id === selectedTraceIdRef.current ||
          (hoveredId !== null && t.id === hoveredId);
        root.style.zIndex = raised ? "3" : "1";
      }
    }, []);

    const cancelHidePreview = useCallback(() => {
      if (leaveTimerRef.current) {
        clearTimeout(leaveTimerRef.current);
        leaveTimerRef.current = null;
      }
    }, []);

    const requestHidePreview = useCallback(() => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = setTimeout(() => {
        leaveTimerRef.current = null;
        applyMarkerHoverStack(null);
        setTraceHover(null);
      }, HOVER_LEAVE_MS);
    }, [applyMarkerHoverStack]);

    useEffect(() => () => cancelHidePreview(), [cancelHidePreview]);

    const traceHoverAnchorId = traceHover?.trace.id;
    const traceHoverLng = traceHover?.lng;
    const traceHoverLat = traceHover?.lat;

    useEffect(() => {
      if (
        traceHoverAnchorId === undefined ||
        traceHoverLng === undefined ||
        traceHoverLat === undefined
      )
        return;

      const map = mapRef.current;
      const el = containerRef.current;
      if (!map || !el) return;

      const traceId = traceHoverAnchorId;
      const lng = traceHoverLng;
      const lat = traceHoverLat;

      const project = () => {
        const p = map.project([lng, lat]);
        const r = el.getBoundingClientRect();
        setTraceHover((h) =>
          h && h.trace.id === traceId
            ? { ...h, x: r.left + p.x, y: r.top + p.y }
            : h,
        );
      };

      project();
      map.on("move", project);
      map.on("zoom", project);
      map.on("rotate", project);
      map.on("pitch", project);
      window.addEventListener("resize", project);
      return () => {
        map.off("move", project);
        map.off("zoom", project);
        map.off("rotate", project);
        map.off("pitch", project);
        window.removeEventListener("resize", project);
      };
    }, [traceHoverAnchorId, traceHoverLng, traceHoverLat]);

    useLayoutEffect(() => {
      applyMarkerHoverStack(traceHover?.trace.id ?? null);
    }, [traceHover, applyMarkerHoverStack]);

    useLayoutEffect(() => {
      if (!traceHover) {
        hoverAnchorRef.current = { x: 0, y: 0 };
        return;
      }
      hoverAnchorRef.current = { x: traceHover.x, y: traceHover.y };
    }, [traceHover]);

    useLayoutEffect(() => {
      if (!traceHover) return;
      const floating = hoverFloatingRef.current;
      if (!floating) return;

      const run = () =>
        computePosition(hoverVirtualReference, floating, {
          placement: "right",
          strategy: "fixed",
          middleware: [
            /* Gap from anchor (marker center); marker face is ~36px — keep tooltip clear of pin. */
            offset(26),
            flip({
              fallbackPlacements: ["left", "top", "bottom"],
            }),
            shift({ padding: 12 }),
          ],
        }).then((data) => {
          const el = hoverFloatingRef.current;
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
      return autoUpdate(hoverVirtualReference, floating, run, {
        animationFrame: true,
        layoutShift: true,
      });
    }, [traceHover, hoverVirtualReference]);

    useImperativeHandle(
      ref,
      () => ({
        lngLatToScreen(lng: number, lat: number) {
          const map = mapRef.current;
          const el = containerRef.current;
          if (!map || !el) return null;
          const p = map.project([lng, lat]);
          const r = el.getBoundingClientRect();
          return { x: r.left + p.x, y: r.top + p.y };
        },
        subscribeCamera(cb: () => void) {
          const map = mapRef.current;
          if (!map) return () => {};
          map.on("move", cb);
          map.on("zoom", cb);
          map.on("rotate", cb);
          map.on("pitch", cb);
          return () => {
            map.off("move", cb);
            map.off("zoom", cb);
            map.off("rotate", cb);
            map.off("pitch", cb);
          };
        },
        fitVisibleTraces() {
          const map = mapRef.current;
          const list = filteredRef.current;
          if (!map || list.length === 0) return;

          if (list.length === 1) {
            const t = list[0];
            map.flyTo({
              center: [t.lng, t.lat],
              zoom: SINGLE_TRACE_ZOOM,
              duration: CAMERA_DURATION_MS,
              essential: true,
            });
            return;
          }

          const bounds = new maplibregl.LngLatBounds(
            [list[0].lng, list[0].lat],
            [list[0].lng, list[0].lat],
          );
          for (const t of list) {
            bounds.extend([t.lng, t.lat]);
          }
          map.fitBounds(bounds, {
            padding: CAMERA_PADDING,
            maxZoom: CAMERA_MAX_ZOOM,
            duration: CAMERA_DURATION_MS,
          });
        },
        zoomIn() {
          const map = mapRef.current;
          if (!map) return;
          map.zoomTo(map.getZoom() + 1, { duration: 180 });
        },
        zoomOut() {
          const map = mapRef.current;
          if (!map) return;
          map.zoomTo(Math.max(map.getZoom() - 1, map.getMinZoom()), {
            duration: 180,
          });
        },
        triggerGeolocate() {
          const map = mapRef.current;
          if (!map) return;
          if (!navigator.geolocation) {
            toast.error("Geolocation is not supported in this browser.");
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const m = mapRef.current;
              if (!m) return;
              m.flyTo({
                center: [pos.coords.longitude, pos.coords.latitude],
                zoom: Math.max(m.getZoom(), 12),
                duration: CAMERA_DURATION_MS,
                essential: true,
              });
            },
            (err) => {
              toast.error(geolocationToastMessage(err));
            },
            {
              enableHighAccuracy: true,
              maximumAge: 30_000,
              timeout: 12_000,
            },
          );
        },
      }),
      [],
    );

    useEffect(() => {
      if (!containerRef.current) return;
      const start = initialCamera;
      const initialStyle =
        typeof document !== "undefined" &&
        document.documentElement.classList.contains("dark")
          ? MAP_STYLE_DARK
          : MAP_STYLE_LIGHT;
      appliedMapStyleUrlRef.current = initialStyle;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: initialStyle,
        center: start ? [start.lng, start.lat] : [10, 20],
        zoom: start?.zoom ?? 1.5,
      });

      mapRef.current = map;
      return () => {
        map.remove();
        mapRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- map instance is created once; initial frame uses initialCamera/cameraSyncKey from first render
    }, []);

    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;
      const url = mapStyleUrlForTheme(resolvedTheme);
      if (appliedMapStyleUrlRef.current === url) return;
      appliedMapStyleUrlRef.current = url;
      map.setStyle(url);
    }, [resolvedTheme]);

    /**
     * Apply camera/bbox from URL when it represents external navigation (search, shared link),
     * not an echo of moveend→URL. While MapLibre is mid-gesture or animation, defer until `idle`.
     */
    useEffect(() => {
      cameraSyncKeyRef.current = cameraSyncKey;
      initialBboxRef.current = initialBbox;
      initialCameraRef.current = initialCamera;

      const map = mapRef.current;
      if (!map || !cameraSyncKey) return;

      urlApplyGenerationRef.current += 1;
      const gen = urlApplyGenerationRef.current;

      const tryApplyFromUrl = () => {
        if (gen !== urlApplyGenerationRef.current) return;
        const m = mapRef.current;
        if (!m) return;

        const syncKey = cameraSyncKeyRef.current;
        if (!syncKey || lastAppliedSyncKeyRef.current === syncKey) return;

        const bbox = initialBboxRef.current;
        const cam = initialCameraRef.current;

        // Point camera in URL matches what we already reported → parent echoed our idle update; do not fly.
        if (!bbox && cam) {
          const urlCamKey = cameraToSyncKey(normalizeCameraForUrl(cam));
          if (lastEmittedCameraKeyRef.current === urlCamKey) {
            lastAppliedSyncKeyRef.current = syncKey;
            return;
          }
        }

        // Bbox URL: compare bbox key to last emitted point key would never match — no echo skip.

        if (m.isMoving()) {
          m.once("idle", tryApplyFromUrl);
          return;
        }

        if (gen !== urlApplyGenerationRef.current) return;
        if (lastAppliedSyncKeyRef.current === syncKey) return;

        if (bbox && isValidMapBbox(bbox)) {
          lastAppliedSyncKeyRef.current = syncKey;
          m.fitBounds(
            new maplibregl.LngLatBounds(
              [bbox.west, bbox.south],
              [bbox.east, bbox.north],
            ),
            {
              padding: CAMERA_PADDING,
              maxZoom: CAMERA_MAX_ZOOM,
              duration: CAMERA_DURATION_MS,
            },
          );
          return;
        }

        if (!cam) return;

        if (cameraCloseEnough(m, cam)) {
          lastAppliedSyncKeyRef.current = syncKey;
          return;
        }

        lastAppliedSyncKeyRef.current = syncKey;
        m.flyTo({
          center: [cam.lng, cam.lat],
          zoom: cam.zoom,
          duration: CAMERA_DURATION_MS,
          essential: true,
        });
      };

      tryApplyFromUrl();
    }, [cameraSyncKey, initialBbox, initialCamera]);

    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;

      const canvas = map.getCanvas();

      const clickHitTraceMarker = (e: maplibregl.MapMouseEvent) => {
        const orig = e.originalEvent;
        if (
          orig &&
          "target" in orig &&
          orig.target instanceof Element &&
          orig.target.closest(".maplibregl-marker")
        ) {
          return true;
        }
        /*
         * Touch → synthetic click often reports `target` as the canvas, not the marker.
         * Hit-test at viewport coords — do not use `rect + e.point` (point is scaled canvas space).
         */
        let clientX: number | undefined;
        let clientY: number | undefined;
        if (orig instanceof MouseEvent) {
          clientX = orig.clientX;
          clientY = orig.clientY;
        }
        if (
          clientX !== undefined &&
          clientY !== undefined &&
          Number.isFinite(clientX) &&
          Number.isFinite(clientY)
        ) {
          for (const node of document.elementsFromPoint(clientX, clientY)) {
            if (node instanceof Element && node.closest(".maplibregl-marker")) {
              return true;
            }
          }
        }
        return false;
      };

      const onClick = (e: maplibregl.MapMouseEvent) => {
        if (placementMode) {
          const fn = onPlacementClickRef.current;
          if (fn) fn(e.lngLat.lng, e.lngLat.lat);
          return;
        }
        if (clickHitTraceMarker(e)) return;
        onMapBackgroundClickRef.current?.();
      };

      map.on("click", onClick);
      if (placementMode) {
        map.dragRotate.disable();
        map.touchZoomRotate.disableRotation();
        canvas.style.cursor = "crosshair";
      } else {
        map.dragRotate.enable();
        map.touchZoomRotate.enable();
        canvas.style.cursor = "";
      }
      return () => {
        map.off("click", onClick);
        map.dragPan.enable();
        map.dragRotate.enable();
        map.touchZoomRotate.enable();
        canvas.style.cursor = "";
      };
    }, [placementMode]);

    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;
      const idle = () => {
        const c = map.getCenter();
        const normalized = normalizeCameraForUrl({
          lng: c.lng,
          lat: c.lat,
          zoom: map.getZoom(),
        });
        lastEmittedCameraKeyRef.current = cameraToSyncKey(normalized);
        const fn = onCameraIdleRef.current;
        if (fn) fn(normalized);
      };
      map.on("moveend", idle);
      return () => {
        map.off("moveend", idle);
      };
    }, []);

    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      markerElByTraceIdRef.current.clear();
      markerRootByTraceIdRef.current.clear();

      for (const t of filtered) {
        const tag0 = t.trace_tags?.[0]?.tags;
        const fill = tag0?.color ?? null;
        const emoji = tag0?.icon_emoji ?? "📍";
        const root = document.createElement("div");
        root.style.display = "flex";
        root.style.alignItems = "center";
        root.style.justifyContent = "center";
        const face = document.createElement("button");
        face.type = "button";
        face.setAttribute("aria-label", t.title?.trim() || "Open trace");
        root.appendChild(face);
        styleTraceMarkerFace(face, {
          emoji,
          fill,
          selected: t.id === selectedTraceId,
          hovered: false,
          interactive: true,
        });
        markerElByTraceIdRef.current.set(t.id, face);
        markerRootByTraceIdRef.current.set(t.id, root);
        face.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectTrace(t.id);
        });
        face.addEventListener("mouseenter", () => {
          cancelHidePreview();
          const mapInst = mapRef.current;
          const wrap = containerRef.current;
          let x = 0;
          let y = 0;
          if (mapInst && wrap) {
            const p = mapInst.project([t.lng, t.lat]);
            const r = wrap.getBoundingClientRect();
            x = r.left + p.x;
            y = r.top + p.y;
          }
          setTraceHover({ trace: t, lng: t.lng, lat: t.lat, x, y });
        });
        face.addEventListener("mouseleave", () => {
          requestHidePreview();
        });
        const marker = new maplibregl.Marker({ element: root })
          .setLngLat([t.lng, t.lat])
          .addTo(map);
        markersRef.current.push(marker);
      }

      setTraceHover((h) => {
        if (!h) return null;
        if (!filtered.some((x) => x.id === h.trace.id)) return null;
        return h;
      });

      applyMarkerHoverStack(latestTraceHoverIdRef.current);
    }, [
      filtered,
      onSelectTrace,
      selectedTraceId,
      applyMarkerHoverStack,
      cancelHidePreview,
      requestHidePreview,
    ]);

    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;
      previewMarkerRef.current?.remove();
      previewMarkerRef.current = null;
      if (!previewPin) return;

      const root = document.createElement("div");
      root.style.display = "flex";
      root.style.alignItems = "center";
      root.style.justifyContent = "center";
      root.style.pointerEvents = "none";
      root.style.zIndex = "5";
      const face = document.createElement("div");
      face.setAttribute("role", "presentation");
      face.setAttribute("aria-hidden", "true");
      root.appendChild(face);
      styleTraceMarkerFace(face, {
        emoji: previewPin.icon,
        fill: previewPin.color,
        selected: false,
        interactive: false,
        draft: true,
      });
      const marker = new maplibregl.Marker({ element: root })
        .setLngLat([previewPin.lng, previewPin.lat])
        .addTo(map);
      previewMarkerRef.current = marker;
      return () => {
        marker.remove();
        previewMarkerRef.current = null;
      };
    }, [previewPin]);

    const hoverTitle = traceHover?.trace.title?.trim() || "Untitled place";

    return (
      <>
        <div
          ref={containerRef}
          className={cn(
            "h-full min-h-0 w-full min-w-0",
            placementMode && "ring-2 ring-primary/50",
            className,
          )}
        />
        {traceHover ? (
          <div
            ref={hoverFloatingRef}
            className="pointer-events-none z-[45] max-w-[min(16rem,calc(100vw-2rem))] min-w-0"
          >
            <div className="border-border/60 bg-muted/95 text-foreground shadow-sm supports-backdrop-filter:backdrop-blur-sm rounded-lg border px-2.5 py-1">
              <p className="text-sm font-medium leading-snug">{hoverTitle}</p>
            </div>
          </div>
        ) : null}
      </>
    );
  },
);

TraceMap.displayName = "TraceMap";
