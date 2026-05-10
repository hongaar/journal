import type { PluginPackageManifest } from "@curolia/plugin-contract";
import { SpotifyAccountSettingsPanel } from "./account-settings-panel";
import { SpotifyIcon } from "./icon";
import { spotifyPluginMeta } from "./plugin-meta";
import { SpotifyTraceDetailSection } from "./trace-detail-section";

/** Spotify Web API scopes (PKCE); companion scopes for `spotify` live in `@curolia/plugin-oauth`. */
const SPOTIFY_RESOURCE_SCOPES = ["user-read-recently-played"] as const;

export const spotifyPluginManifest: PluginPackageManifest = {
  id: spotifyPluginMeta.typeId,
  displayName: spotifyPluginMeta.displayName,
  description:
    "Show your most-played Spotify tracks during each trace’s date range on the trace page.",
  icon: SpotifyIcon,
  implemented: spotifyPluginMeta.implemented,
  AccountSettingsPanel: SpotifyAccountSettingsPanel,
  TraceDetailSection: SpotifyTraceDetailSection,
  contributions: {
    oauth: [
      {
        provider: "spotify",
        scopes: [...SPOTIFY_RESOURCE_SCOPES],
      },
    ],
    edgeFunctions: [
      {
        slug: "spotify",
        verifyJwt: true,
        description:
          "Fetch Spotify listening history for a trace window and upsert plugin_entity_data.",
      },
    ],
  },
};
