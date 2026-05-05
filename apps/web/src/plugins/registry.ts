import type {
  PluginDefinition,
  PluginRegistry,
} from "@curolia/plugin-contract";
import { installedPluginManifests } from "@/plugins/generated-manifests";

export const pluginRegistry = Object.fromEntries(
  installedPluginManifests.map((manifest) => [manifest.id, manifest]),
) as PluginRegistry;

export const pluginList =
  installedPluginManifests as readonly PluginDefinition[];

export function getPluginDefinition(id: string): PluginDefinition | undefined {
  return pluginRegistry[id];
}
