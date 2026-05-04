import type { PluginCapability } from "./capabilities";
import type { PluginContributions } from "./contributions";

export type PluginDefinition = {
  id: string;
  displayName: string;
  capabilities: readonly PluginCapability[];
  /** When false, UI shows that sync is not implemented yet */
  implemented: boolean;
  /** Optional metadata for settings UI, hooks registry, and Edge deploy lists */
  contributions?: PluginContributions;
};

export type PluginRegistry = Record<string, PluginDefinition>;

export type PluginPackageManifest = PluginDefinition;
