import type { PluginPackageManifest } from "@curolia/plugin-contract";
import { SpotifyAccountSettingsPanel } from "./account-settings-panel";
import { SpotifyIcon } from "./icon";
import { spotifyPluginMeta } from "./plugin-meta";
import { SpotifyTraceListeningSlot } from "./trace-listening-slot";

/** Spotify Web API scopes (PKCE); companion scopes for `spotify` live in `@curolia/plugin-oauth`. */
const SPOTIFY_RESOURCE_SCOPES = ["user-read-recently-played"] as const;

export const spotifyPluginManifest: PluginPackageManifest = {
  id: spotifyPluginMeta.typeId,
  displayName: spotifyPluginMeta.displayName,
  description:
    "Add your most-played Spotify tracks during each trace’s date range as links.",
  icon: SpotifyIcon,
  capabilities: ["trace_listening"] as const,
  implemented: spotifyPluginMeta.implemented,
  AccountSettingsPanel: SpotifyAccountSettingsPanel,
  TraceListeningSlot: SpotifyTraceListeningSlot,
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
          "Resolve Spotify listening history for a trace window and upsert link rows.",
      },
    ],
  },
};
