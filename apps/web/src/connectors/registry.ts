import type { ConnectorDefinition, ConnectorRegistry } from "@curolia/connector-contract";
import { icalConnectorManifest } from "@curolia/connector-ical";

const mapsStub = {
  capabilities: ["export_trace", "import_media"] as const,
  implemented: false,
} satisfies Omit<ConnectorDefinition, "id" | "displayName">;

const mediaStub = {
  capabilities: ["import_media"] as const,
  implemented: false,
} satisfies Omit<ConnectorDefinition, "id" | "displayName">;

const calendarStub = {
  capabilities: ["calendar_traces"] as const,
  implemented: false,
} satisfies Omit<ConnectorDefinition, "id" | "displayName">;

export const connectorRegistry = {
  google_maps: { id: "google_maps", displayName: "Google Maps", ...mapsStub },
  osmand: { id: "osmand", displayName: "OsmAnd", ...mapsStub },
  google_photos: {
    id: "google_photos",
    displayName: "Google Photos",
    ...mediaStub,
    contributions: {
      appHooks: [
        {
          name: "photos.suggestionsForTrace",
          description:
            "Future: suggest library photos using trace coordinates and date range (web/mobile shell will subscribe).",
        },
      ],
    },
  },
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
  [icalConnectorManifest.id]: icalConnectorManifest,
} satisfies ConnectorRegistry;

export function getConnectorDefinition(id: string): ConnectorDefinition | undefined {
  return connectorRegistry[id];
}
