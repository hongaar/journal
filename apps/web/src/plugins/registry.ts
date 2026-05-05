import type { PluginDefinition, PluginRegistry } from "@curolia/plugin-contract";
import { googlePhotosPluginManifest } from "@curolia/plugin-google-photos";
import { icalPluginManifest } from "@curolia/plugin-ical";

const mapsStub = {
  capabilities: ["export_trace", "import_media"] as const,
  implemented: false,
} satisfies Omit<PluginDefinition, "id" | "displayName">;

const mediaStub = {
  capabilities: ["import_media"] as const,
  implemented: false,
} satisfies Omit<PluginDefinition, "id" | "displayName">;

const calendarStub = {
  capabilities: ["calendar_traces"] as const,
  implemented: false,
} satisfies Omit<PluginDefinition, "id" | "displayName">;

export const pluginRegistry = {
  google_maps: { id: "google_maps", displayName: "Google Maps", ...mapsStub },
  osmand: { id: "osmand", displayName: "OsmAnd", ...mapsStub },
  google_photos: googlePhotosPluginManifest,
  immich: {
    id: "immich",
    displayName: "Immich",
    ...mediaStub,
  },
  google_calendar: {
    id: "google_calendar",
    displayName: "Google Calendar",
    ...calendarStub,
  },
  [icalPluginManifest.id]: icalPluginManifest,
} satisfies PluginRegistry;

export function getPluginDefinition(id: string): PluginDefinition | undefined {
  return pluginRegistry[id];
}
