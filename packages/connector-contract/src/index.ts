export type { ConnectorCapability } from "./capabilities";
export type {
  AppHookDeclaration,
  ConnectorContributions,
  EdgeFunctionDeclaration,
  GlobalSettingField,
  GlobalSettingsDeclaration,
  JournalSettingsDeclaration,
} from "./contributions";
export type { ConnectorDefinition, ConnectorPackageManifest, ConnectorRegistry } from "./definition";
export {
  journalConnectorConfigRecord,
  mergeJournalConnectorConfig,
  type JournalConnectorLike,
} from "./journal-config";
