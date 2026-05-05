import { LocateFixed, Minus, Plus, Scan } from "lucide-react";
import type { TraceMapHandle } from "@/components/map/trace-map";
import {
  MapToolbarGroup,
  MapToolbarIconButton,
} from "@/components/map/map-toolbar";
import type { RefObject } from "react";

type MapControlsToolbarProps = {
  mapRef: RefObject<TraceMapHandle | null>;
  className?: string;
};

/** MapLibre actions with app-styled controls (matches `MapToolbarGroup` / Lucide). */
export function MapControlsToolbar({
  mapRef,
  className,
}: MapControlsToolbarProps) {
  return (
    <div className={className}>
      <MapToolbarGroup>
        <MapToolbarIconButton
          icon={<Scan className="size-4" />}
          label="Fit traces"
          title="Fit map to visible traces"
          onClick={() => mapRef.current?.fitVisibleTraces()}
        />
        <MapToolbarIconButton
          icon={<Plus className="size-4" />}
          label="Zoom in"
          onClick={() => mapRef.current?.zoomIn()}
        />
        <MapToolbarIconButton
          icon={<Minus className="size-4" />}
          label="Zoom out"
          onClick={() => mapRef.current?.zoomOut()}
        />
        <MapToolbarIconButton
          icon={<LocateFixed className="size-4" />}
          label="My location"
          title="Find my location"
          onClick={() => mapRef.current?.triggerGeolocate()}
        />
      </MapToolbarGroup>
    </div>
  );
}
