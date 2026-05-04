export type ConnectorCapability =
  | "export_trace"
  | "import_media"
  | "sync_places"
  /** Traces surfaced as events on Google Calendar */
  | "calendar_traces"
  /** Export as standard .ics calendar files */
  | "export_ics";
