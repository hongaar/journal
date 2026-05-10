export type PluginCapability =
  | "export_trace"
  | "import_media"
  | "sync_places"
  /** Traces surfaced as events on Google Calendar */
  | "calendar_traces"
  /** Export as standard .ics calendar files */
  | "export_ics"
  /** Suggest library photos for a trace (date + location) */
  | "trace_photo_suggestions"
  /** Attach listening history for the trace period (e.g. Spotify top tracks). */
  | "trace_listening";
