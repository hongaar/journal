import { cn } from "@/lib/utils";
import type { Trace } from "@/types/database";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef } from "react";

export type TraceWithTags = Trace & {
  trace_tags?: { tag_id: string; tags: { id: string; name: string; color: string; icon_emoji: string } | null }[];
};

type TraceMapProps = {
  traces: TraceWithTags[];
  selectedTagIds: Set<string>;
  onSelectTrace: (id: string) => void;
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

export function TraceMap({ traces, selectedTagIds, onSelectTrace, className }: TraceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

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
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (filtered.length === 0) return;

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

    for (const t of filtered) {
      const el = document.createElement("button");
      el.type = "button";
      el.className =
        "flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-[var(--map-marker-ring)] bg-primary text-lg text-primary-foreground shadow-lg ring-2 ring-primary/35 transition hover:scale-110 active:scale-95";
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

  return <div ref={containerRef} className={cn("h-full min-h-0 w-full min-w-0", className)} />;
}
