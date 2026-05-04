import { FloatingPanel } from "@/components/layout/floating-panel";
import { supabase } from "@/lib/supabase";
import { cn, contrastingForeground } from "@/lib/utils";
import maplibregl from "maplibre-gl";
import { useQuery } from "@tanstack/react-query";
import { filterTracesByTags, type TraceWithTags } from "@/lib/trace-with-tags";
import type { MapCamera } from "@/lib/map-view-params";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "next-themes";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const HOVER_PHOTO_COUNT = 2;
const HOVER_LEAVE_MS = 140;
const HOVER_DESC_MAX_CHARS = 220;

/** Marker hover preview: screen x/y updated while the map camera moves. */
type TraceHoverPreview = { trace: TraceWithTags; lng: number; lat: number; x: number; y: number };

function firstPhotosForPreview(trace: TraceWithTags) {
  const rows = trace.photos ?? [];
  return [...rows]
    .filter((p): p is (typeof rows)[number] & { storage_path: string } => Boolean(p.storage_path))
    .sort((a, b) => a.sort_order - b.sort_order)
    .slice(0, HOVER_PHOTO_COUNT);
}

function useMarkerHoverPhotoUrls(trace: TraceWithTags | null) {
  const slice = useMemo(() => (trace ? firstPhotosForPreview(trace) : []), [trace]);

  return useQuery({
    queryKey: ["map-marker-hover-photo-urls", trace?.id, slice.map((p) => p.id).join("|")],
    queryFn: async () => {
      const out: string[] = [];
      for (const p of slice) {
        const { data, error } = await supabase.storage.from("trace-photos").createSignedUrl(p.storage_path, 3600);
        if (!error && data?.signedUrl) out.push(data.signedUrl);
      }
      return out;
    },
    enabled: Boolean(trace?.id && slice.length > 0),
    staleTime: 300_000,
  });
}

export type { TraceWithTags };

export type TraceMapHandle = {
  lngLatToScreen: (lng: number, lat: number) => { x: number; y: number } | null;
  subscribeCamera: (cb: () => void) => () => void;
  /** Fit map camera to currently filtered traces (same logic as former auto-fit). */
  fitVisibleTraces: () => void;
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
  /** Stable key for the active camera source (`url:…` | `init:…`); when it changes, the map jumps to `initialCamera`. */
  cameraSyncKey?: string;
  /** Fired after pan/zoom settles (moveend); used to persist camera in the address bar. */
  onCameraIdle?: (camera: MapCamera) => void;
};

const MAP_STYLE_LIGHT = "https://tiles.openfreemap.org/styles/positron";
const MAP_STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";

function mapStyleUrlForTheme(resolvedTheme: string | undefined): string {
  if (resolvedTheme === "dark") return MAP_STYLE_DARK;
  if (resolvedTheme === "light") return MAP_STYLE_LIGHT;
  if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
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
  opts: { emoji: string; fill: string | null; selected: boolean; interactive: boolean; draft?: boolean },
) {
  el.textContent = opts.emoji;
  const fill = opts.fill;
  const draft = Boolean(opts.draft);
  el.className = cn(
    "flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/80 text-lg shadow-md transition-[transform,box-shadow,filter]",
    opts.interactive && "cursor-pointer hover:shadow-lg hover:brightness-105 active:brightness-95",
    !fill && "bg-primary text-primary-foreground",
    draft &&
      "z-[4] ring-[3px] ring-dashed ring-primary ring-offset-2 ring-offset-background shadow-lg",
    !draft &&
      opts.selected &&
      "z-[3] ring-[3px] ring-primary ring-offset-2 ring-offset-background shadow-lg",
    !draft &&
      !opts.selected &&
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

export const TraceMap = forwardRef<TraceMapHandle, TraceMapProps>(function TraceMap(
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
    cameraSyncKey = "",
    onCameraIdle,
  },
  ref,
) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [traceHover, setTraceHover] = useState<TraceHoverPreview | null>(null);
  const appliedMapStyleUrlRef = useRef<string>("");
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const previewMarkerRef = useRef<maplibregl.Marker | null>(null);
  const onPlacementClickRef = useRef(onPlacementClick);
  onPlacementClickRef.current = onPlacementClick;
  const onCameraIdleRef = useRef(onCameraIdle);
  onCameraIdleRef.current = onCameraIdle;
  const lastAppliedSyncKeyRef = useRef<string>("");

  const filtered = useMemo(() => filterTracesByTags(traces, selectedTagIds), [traces, selectedTagIds]);
  const filteredRef = useRef(filtered);
  filteredRef.current = filtered;

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
      setTraceHover(null);
    }, HOVER_LEAVE_MS);
  }, []);

  useEffect(() => () => cancelHidePreview(), [cancelHidePreview]);

  const hoverPhotoUrlsQuery = useMarkerHoverPhotoUrls(traceHover?.trace ?? null);
  const hoverPreviewPhotos = useMemo(
    () => (traceHover ? firstPhotosForPreview(traceHover.trace) : []),
    [traceHover],
  );

  const traceHoverAnchorId = traceHover?.trace.id;
  const traceHoverLng = traceHover?.lng;
  const traceHoverLat = traceHover?.lat;

  useEffect(() => {
    if (traceHoverAnchorId === undefined || traceHoverLng === undefined || traceHoverLat === undefined) return;

    const map = mapRef.current;
    const el = containerRef.current;
    if (!map || !el) return;

    const traceId = traceHoverAnchorId;
    const lng = traceHoverLng;
    const lat = traceHoverLat;

    const project = () => {
      const p = map.project([lng, lat]);
      const r = el.getBoundingClientRect();
      setTraceHover((h) => (h && h.trace.id === traceId ? { ...h, x: r.left + p.x, y: r.top + p.y } : h));
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
    }),
    [],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const start = initialCamera;
    const initialStyle =
      typeof document !== "undefined" && document.documentElement.classList.contains("dark")
        ? MAP_STYLE_DARK
        : MAP_STYLE_LIGHT;
    appliedMapStyleUrlRef.current = initialStyle;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: initialStyle,
      center: start ? [start.lng, start.lat] : [10, 20],
      zoom: start?.zoom ?? 1.5,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-left");

    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true, maximumAge: 30_000, timeout: 12_000 },
      trackUserLocation: true,
      showUserLocation: true,
      showAccuracyCircle: true,
      fitBoundsOptions: { maxZoom: 15 },
    });
    geolocate.on("error", (e) => {
      toast.error(geolocationToastMessage(e.error));
    });
    map.addControl(geolocate, "bottom-left");

    if (cameraSyncKey) lastAppliedSyncKeyRef.current = cameraSyncKey;

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !cameraSyncKey || !initialCamera) return;
    if (lastAppliedSyncKeyRef.current === cameraSyncKey) return;
    lastAppliedSyncKeyRef.current = cameraSyncKey;
    if (cameraCloseEnough(map, initialCamera)) return;
    map.jumpTo({ center: [initialCamera.lng, initialCamera.lat], zoom: initialCamera.zoom });
  }, [cameraSyncKey, initialCamera]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const canvas = map.getCanvas();

    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (!placementMode) return;
      const fn = onPlacementClickRef.current;
      if (!fn) return;
      fn(e.lngLat.lng, e.lngLat.lat);
    };

    if (placementMode) {
      map.on("click", onClick);
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();
      canvas.style.cursor = "crosshair";
    } else {
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
      const fn = onCameraIdleRef.current;
      if (!fn) return;
      const c = map.getCenter();
      fn({ lng: c.lng, lat: c.lat, zoom: map.getZoom() });
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

    for (const t of filtered) {
      const tag0 = t.trace_tags?.[0]?.tags;
      const fill = tag0?.color ?? null;
      const emoji = tag0?.icon_emoji ?? "📍";
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", t.title?.trim() || "Open trace");
      styleTraceMarkerFace(el, {
        emoji,
        fill,
        selected: t.id === selectedTraceId,
        interactive: true,
      });
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectTrace(t.id);
      });
      el.addEventListener("mouseenter", () => {
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
      el.addEventListener("mouseleave", () => {
        requestHidePreview();
      });
      const marker = new maplibregl.Marker({ element: el }).setLngLat([t.lng, t.lat]).addTo(map);
      markersRef.current.push(marker);
    }

    setTraceHover((h) => {
      if (!h) return null;
      if (!filtered.some((x) => x.id === h.trace.id)) return null;
      return h;
    });
  }, [filtered, onSelectTrace, selectedTraceId, cancelHidePreview, requestHidePreview]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    previewMarkerRef.current?.remove();
    previewMarkerRef.current = null;
    if (!previewPin) return;

    const el = document.createElement("div");
    el.setAttribute("role", "presentation");
    el.setAttribute("aria-hidden", "true");
    el.className = "pointer-events-none relative z-[4]";
    styleTraceMarkerFace(el, {
      emoji: previewPin.icon,
      fill: previewPin.color,
      selected: false,
      interactive: false,
      draft: true,
    });
    const marker = new maplibregl.Marker({ element: el }).setLngLat([previewPin.lng, previewPin.lat]).addTo(map);
    previewMarkerRef.current = marker;
    return () => {
      marker.remove();
      previewMarkerRef.current = null;
    };
  }, [previewPin]);

  const hoverTitle = traceHover?.trace.title?.trim() || "Untitled place";
  const rawDesc = traceHover?.trace.description?.trim() ?? "";
  const hoverDesc =
    rawDesc.length > HOVER_DESC_MAX_CHARS ? `${rawDesc.slice(0, HOVER_DESC_MAX_CHARS - 1).trimEnd()}…` : rawDesc;
  const hoverUrls = hoverPhotoUrlsQuery.data ?? [];

  return (
    <div className={cn("relative h-full min-h-0 w-full min-w-0", className)}>
      <div
        ref={containerRef}
        className={cn("absolute inset-0 min-h-0 min-w-0", placementMode && "ring-2 ring-primary/50")}
      />
      {traceHover ? (
        <div
          className="pointer-events-auto fixed z-[60] w-[min(18rem,calc(100vw-1.5rem))]"
          style={{
            left: traceHover.x,
            top: traceHover.y,
            transform: "translate(-50%, calc(-100% - 10px))",
          }}
          onMouseEnter={cancelHidePreview}
          onMouseLeave={requestHidePreview}
        >
          <FloatingPanel className="border-[var(--panel-border)] p-3 shadow-2xl">
            <p className="font-display text-foreground text-sm leading-snug font-semibold tracking-tight">{hoverTitle}</p>
            {hoverDesc ? (
              <p className="text-muted-foreground mt-1.5 max-h-24 overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap">
                {hoverDesc}
              </p>
            ) : null}
            {hoverPreviewPhotos.length > 0 ? (
              <div className="mt-2.5 flex gap-1.5">
                {hoverPreviewPhotos.map((p, i) => (
                  <div
                    key={p.id}
                    className="bg-muted relative aspect-square min-h-0 flex-1 overflow-hidden rounded-lg"
                  >
                    {hoverUrls[i] ? (
                      <img
                        src={hoverUrls[i]}
                        alt=""
                        className="size-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div className="bg-muted flex size-full min-h-[4.5rem] animate-pulse items-center justify-center" />
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </FloatingPanel>
        </div>
      ) : null}
    </div>
  );
});

TraceMap.displayName = "TraceMap";
