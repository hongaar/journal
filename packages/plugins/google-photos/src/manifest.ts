import type { PluginPackageManifest } from "@curolia/plugin-contract";
import { OAUTH_COMPANION_SCOPES_BY_PROVIDER } from "@curolia/plugin-oauth";
import { GooglePhotosAccountSettingsPanel } from "./account-settings-panel";
import { GooglePhotosIcon } from "./icon";

/** API/resource scopes only; companion `openid`/`email`/`profile` come from `@curolia/plugin-oauth`. */
const GOOGLE_PHOTOS_RESOURCE_SCOPES = [
  "https://www.googleapis.com/auth/photospicker.mediaitems.readonly",
] as const;

export const googlePhotosPluginManifest: PluginPackageManifest = {
  id: "google_photos",
  displayName: "Google Photos",
  description: "Link photos from Google Photos.",
  icon: GooglePhotosIcon,
  capabilities: ["import_media", "trace_photo_suggestions"] as const,
  implemented: true,
  AccountSettingsPanel: GooglePhotosAccountSettingsPanel,
  contributions: {
    oauth: [
      {
        provider: "google",
        scopes: [
          ...OAUTH_COMPANION_SCOPES_BY_PROVIDER.google,
          ...GOOGLE_PHOTOS_RESOURCE_SCOPES,
        ],
      },
    ],
    appHooks: [
      {
        name: "photos.suggestionsForTrace",
        description:
          "Pick photos from Google Photos for a trace via the google-photos Edge function.",
      },
    ],
    edgeFunctions: [
      {
        slug: "google-photos",
        verifyJwt: true,
        description:
          "Google Photos Picker sessions and import picked media for a trace.",
      },
    ],
  },
};
