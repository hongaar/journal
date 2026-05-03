import { cn } from "@/lib/utils";
import type { Trace } from "@/types/database";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { toast } from "sonner";

export type TraceWithTags = Trace & {
  trace_tags?: { tag_id: string; tags: { id: string; name: string; color: string; icon_emoji: string } | null }[];
};

export type TraceMapHandle = {
  lngLatToScreen: (lng: number, lat: number) => { x: number; y: number } | null;
  subscribeCamera: (cb: () => void) => () => void;
};

type TraceMapProps = {
  traces: TraceWithTags[];
  selectedTagIds: Set<string>;
  onSelectTrace: (id: string) => void;
  placementMode?: boolean;
  onPlacementClick?: (lng: number, lat: number) => void;
  className?: string;
};

const BASE_STYLE = "https://tiles.openfreemap.org/styles/positron";

const CAMERA_DURATION_MS = 850;
const CAMERA_PADDING = 80;
const CAMERA_MAX_ZOOM = 14;
const SINGLE_TRACE_ZOOM = 10;

function filterTraces(traces: TraceWithTags[], selectedTagIds: Set<string>) {
  return traces.filter((t) => {
    if (selectedTagIds.size === 0) return true;
    const tagIds = new Set(
      (t.trace_tags ?? [])
        .map((tt) => tt.tags?.id)
        .filter((id): id is string => Boolean(id)),
    );
    for (const id of selectedTagIds) {
      if (tagIds.has(id)) return true;
    }
    return false;
  });
}

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

/** Stable key for visible traces — camera only updates when this changes. */
function cameraKeyForFiltered(filtered: TraceWithTags[], placementMode: boolean) {
  if (placementMode) return "placement";
  if (filtered.length === 0) return "empty";
  return filtered
    .map((t) => t.id)
    .sort()
    .join(",");
}

export const TraceMap = forwardRef<TraceMapHandle, TraceMapProps>(function TraceMap(
  { traces, selectedTagIds, onSelectTrace, placementMode = false, onPlacementClick, className },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const onPlacementClickRef = useRef(onPlacementClick);
  onPlacementClickRef.current = onPlacementClick;
  const lastCameraKeyRef = useRef<string>("");

  const filtered = useMemo(() => filterTraces(traces, selectedTagIds), [traces, selectedTagIds]);
  const cameraKey = useMemo(() => cameraKeyForFiltered(filtered, placementMode), [filtered, placementMode]);

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
    }),
    [],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASE_STYLE,
      center: [10, 20],
      zoom: 1.5,
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

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

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
      map.dragPan.disable();
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
    if (placementMode) return;
    if (cameraKey === lastCameraKeyRef.current) return;
    lastCameraKeyRef.current = cameraKey;
    if (filtered.length === 0) return;

    if (filtered.length === 1) {
      const t = filtered[0];
      map.flyTo({
        center: [t.lng, t.lat],
        zoom: SINGLE_TRACE_ZOOM,
        duration: CAMERA_DURATION_MS,
        essential: true,
      });
      return;
    }

    const bounds = new maplibregl.LngLatBounds(
      [filtered[0].lng, filtered[0].lat],
      [filtered[0].lng, filtered[0].lat],
    );
    for (const t of filtered) {
      bounds.extend([t.lng, t.lat]);
    }
    map.fitBounds(bounds, {
      padding: CAMERA_PADDING,
      maxZoom: CAMERA_MAX_ZOOM,
      duration: CAMERA_DURATION_MS,
    });
  }, [cameraKey, filtered, placementMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    for (const t of filtered) {
      const el = document.createElement("button");
      el.type = "button";
      el.className =
        "flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-[var(--map-marker-ring)] bg-primary text-lg text-primary-foreground shadow-lg ring-2 ring-primary/35 transition-shadow hover:shadow-xl hover:brightness-110 hover:ring-primary/50 active:brightness-95";
      el.textContent =
        (t.trace_tags?.[0]?.tags?.icon_emoji as string | undefined) ?? "📍";
      el.title = t.title ?? "Trace";
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectTrace(t.id);
      });
      const marker = new maplibregl.Marker({ element: el }).setLngLat([t.lng, t.lat]).addTo(map);
      markersRef.current.push(marker);
    }
  }, [filtered, onSelectTrace]);

  return (
    <div
      ref={containerRef}
      className={cn("h-full min-h-0 w-full min-w-0", placementMode && "ring-2 ring-primary/50", className)}
    />
  );
});

TraceMap.displayName = "TraceMap";
