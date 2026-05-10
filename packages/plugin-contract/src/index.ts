export type { PluginCapability } from "./capabilities";
export type {
  AppHookDeclaration,
  EdgeFunctionDeclaration,
  GlobalSettingField,
  GlobalSettingsDeclaration,
  JournalSettingsDeclaration,
  PluginContributions,
  PluginOAuthDeclaration,
} from "./contributions";
export type {
  PluginDefinition,
  PluginPackageManifest,
  PluginRegistry,
} from "./definition";
export type {
  PluginAccountPanelProps,
  PluginAccountSettingsComponent,
  PluginOAuthLinkStatusResult,
  PluginOAuthShellHandlers,
  PluginUserPluginSnapshot,
} from "./account-panel";
export {
  journalPluginConfigRecord,
  mergeJournalPluginConfig,
  type JournalPluginLike,
} from "./journal-config";

/** Trace photo suggestion payload (plugins return from Edge or client bridges). */
export type TracePhotoSuggestionContext = {
  traceId: string;
  journalId: string;
  date: string | null;
  endDate: string | null;
  lat: number;
  lng: number;
  /** Search radius in meters (shell default if unset). */
  radiusM?: number;
};

export type TracePhotoSuggestion = {
  externalId: string;
  thumbnailUrl?: string;
  title?: string;
  capturedAt?: string;
  /** Distance from trace center in meters when known. */
  distanceM?: number;
  meta?: Record<string, unknown>;
};
