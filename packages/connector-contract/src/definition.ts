import type { ConnectorCapability } from "./capabilities";
import type { ConnectorContributions } from "./contributions";

export type ConnectorDefinition = {
  id: string;
  displayName: string;
  capabilities: readonly ConnectorCapability[];
  /** When false, UI shows that sync is not implemented yet */
  implemented: boolean;
  /** Optional metadata for settings UI, hooks registry, and Edge deploy lists */
  contributions?: ConnectorContributions;
};

export type ConnectorRegistry = Record<string, ConnectorDefinition>;

export type ConnectorPackageManifest = ConnectorDefinition;
