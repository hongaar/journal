import type { PluginPackageManifest } from "@curolia/plugin-contract";
import { LastfmAccountSettingsPanel } from "./account-settings-panel";
import { LastfmIcon } from "./icon";
import { lastfmPluginMeta } from "./plugin-meta";
import { LastfmTraceDetailSection } from "./trace-detail-section";

export const lastfmPluginManifest: PluginPackageManifest = {
  id: lastfmPluginMeta.typeId,
  displayName: lastfmPluginMeta.displayName,
  description:
    "Show your most-scrobbled Last.fm tracks during each trace’s date range on the trace page.",
  icon: LastfmIcon,
  implemented: lastfmPluginMeta.implemented,
  AccountSettingsPanel: LastfmAccountSettingsPanel,
  TraceDetailSection: LastfmTraceDetailSection,
  contributions: {
    edgeFunctions: [
      {
        slug: "lastfm",
        verifyJwt: true,
        description:
          "Fetch Last.fm recent tracks for a trace window and upsert plugin_entity_data.",
      },
    ],
  },
};
