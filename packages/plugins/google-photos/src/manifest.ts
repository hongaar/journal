import type { PluginPackageManifest } from "@curolia/plugin-contract";

export const googlePhotosPluginManifest: PluginPackageManifest = {
  id: "google_photos",
  displayName: "Google Photos",
  capabilities: ["import_media", "trace_photo_suggestions"] as const,
  implemented: true,
  contributions: {
    oauth: [
      {
        provider: "google",
        scopes: ["https://www.googleapis.com/auth/photoslibrary.readonly"],
      },
    ],
    appHooks: [
      {
        name: "photos.suggestionsForTrace",
        description:
          "Suggest library photos using trace coordinates and date range via the google-photos Edge function.",
      },
    ],
    edgeFunctions: [
      {
        slug: "google-photos",
        verifyJwt: true,
        description: "Search and import Google Photos library items for a trace.",
      },
    ],
  },
};
