export type ConnectorCapability =
  | "export_trace"
  | "import_media"
  | "sync_places"
  /** Traces surfaced as events on Google Calendar */
  | "calendar_traces"
  /** Export as standard .ics calendar files */
  | "export_ics";

export type ConnectorDefinition = {
  id: string;
  displayName: string;
  capabilities: ConnectorCapability[];
  /** When false, UI shows “Coming soon” for sync actions */
  implemented: boolean;
};

export type ConnectorRegistry = Record<string, ConnectorDefinition>;
