export type ConnectorCapability = "export_trace" | "import_media" | "sync_places";

export type ConnectorDefinition = {
  id: string;
  displayName: string;
  capabilities: ConnectorCapability[];
  /** When false, UI shows “Coming soon” for sync actions */
  implemented: boolean;
};

export type ConnectorRegistry = Record<string, ConnectorDefinition>;
