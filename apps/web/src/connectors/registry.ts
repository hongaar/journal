import type { ConnectorDefinition, ConnectorRegistry } from "./types";

const stub: Omit<ConnectorDefinition, "id" | "displayName"> = {
  capabilities: ["export_trace", "import_media"],
  implemented: false,
};

export const connectorRegistry: ConnectorRegistry = {
  google_maps: { id: "google_maps", displayName: "Google Maps", ...stub },
  osmand: { id: "osmand", displayName: "OsmAnd", ...stub },
  google_photos: {
    id: "google_photos",
    displayName: "Google Photos",
    capabilities: ["import_media"],
    implemented: false,
  },
  immich: {
    id: "immich",
    displayName: "Immich",
    capabilities: ["import_media"],
    implemented: false,
  },
};

export function getConnectorDefinition(id: string): ConnectorDefinition | undefined {
  return connectorRegistry[id];
}
