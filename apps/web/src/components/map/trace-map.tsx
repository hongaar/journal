import { cn } from "@/lib/utils";
import type { Trace } from "@/types/database";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

export type TraceWithTags = Trace & {
  trace_tags?: { tag_id: string; tags: { id: string; name: string; color: string; icon_emoji: string } | null }[];
};

/** Pin hotspot at tip (bottom center), fallback crosshair */
const PIN_CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 24 36"><path fill="#15653c" stroke="white" stroke-width="1.2" d="M12 1.5C6.8 1.5 2.5 5.8 2.5 11c0 6.2 7.5 19.2 9.2 22.5.2.4.8.4 1 0C14.5 30.2 21.5 17.2 21.5 11 21.5 5.8 17.2 1.5 12 1.5z"/><circle cx="12" cy="11" r="3.2" fill="white"/></svg>`;
const PIN_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(PIN_CURSOR_SVG)}") 14 36, crosshair`;

type TraceMapProps = {
  traces: TraceWithTags[];
  selectedTagIds: Set<string>;
  onSelectTrace: (id: string) => void;
  /** When true, map shows a pin cursor and the next map click calls `onPlacementClick`. */
  placementMode?: boolean;
  onPlacementClick?: (lng: number, lat: number) => void;
  className?: string;
};

/** Light basemap; pairs with parchment UI panels */
const BASE_STYLE = "https://tiles.openfreemap.org/styles/positron";

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

export function TraceMap({
  traces,
  selectedTagIds,
  onSelectTrace,
  placementMode = false,
  onPlacementClick,
  className,
}: TraceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const onPlacementClickRef = useRef(onPlacementClick);
  onPlacementClickRef.current = onPlacementClick;

  const filtered = useMemo(() => filterTraces(traces, selectedTagIds), [traces, selectedTagIds]);

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
    }
    return () => {
      map.off("click", onClick);
      map.dragRotate.enable();
      map.touchZoomRotate.enable();
    };
  }, [placementMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (filtered.length === 0) return;

    if (!placementMode) {
      if (filtered.length === 1) {
        const t = filtered[0];
        map.jumpTo({ center: [t.lng, t.lat], zoom: 10 });
      } else {
        const bounds = new maplibregl.LngLatBounds(
          [filtered[0].lng, filtered[0].lat],
          [filtered[0].lng, filtered[0].lat],
        );
        for (const t of filtered) {
          bounds.extend([t.lng, t.lat]);
        }
        map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 600 });
      }
    }

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
  }, [filtered, onSelectTrace, placementMode]);

  return (
    <div
      ref={containerRef}
      className={cn("h-full min-h-0 w-full min-w-0", placementMode && "ring-2 ring-primary/50", className)}
      style={placementMode ? { cursor: PIN_CURSOR } : undefined}
    />
  );
}
