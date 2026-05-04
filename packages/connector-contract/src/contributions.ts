/**
 * Declarative description of app-wide connector settings (e.g. OAuth client IDs,
 * API keys stored in env or a future `app_connector_settings` table).
 * The web shell can render forms from this metadata later.
 */
export type GlobalSettingField =
  | ({
      kind: "section";
      label: string;
      description?: string;
    } & { children: GlobalSettingField[] })
  | ({
      kind: "oauth" | "api_key" | "text" | "url" | "boolean";
      key: string;
      label: string;
      description?: string;
      /** Suggested env var name for documentation / codegen */
      envVar?: string;
    } & { children?: never });

export type GlobalSettingsDeclaration = {
  title: string;
  fields: GlobalSettingField[];
};

/**
 * Per-journal settings (stored in `journal_connectors.config` or dedicated tables).
 * UI registration stays in the app shell; this describes intent for docs and tooling.
 */
export type JournalSettingsDeclaration = {
  /** How the web app should mount connector-specific panels */
  panel: "inline" | "modal";
  title?: string;
};

/**
 * Named extension points for web/mobile (e.g. photo suggestions for a trace).
 * Runtime: app registers handlers; connectors only declare names for discovery.
 */
export type AppHookDeclaration = {
  /** Dot-separated namespaced id, e.g. `photos.suggestionsForTrace` */
  name: string;
  description: string;
};

/**
 * Edge Function deployed via Supabase (source under connector package;
 * synced into repo-root `supabase/functions/`).
 */
export type EdgeFunctionDeclaration = {
  slug: string;
  verifyJwt?: boolean;
  description?: string;
};

export type ConnectorContributions = {
  globalSettings?: GlobalSettingsDeclaration;
  journalSettings?: JournalSettingsDeclaration;
  appHooks?: AppHookDeclaration[];
  edgeFunctions?: EdgeFunctionDeclaration[];
};
