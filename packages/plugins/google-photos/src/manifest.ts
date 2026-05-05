import type { PluginPackageManifest } from "@curolia/plugin-contract";
import { GooglePhotosIcon } from "./icon";

export const googlePhotosPluginManifest: PluginPackageManifest = {
  id: "google_photos",
  displayName: "Google Photos",
  description: "Link photos from Google Photos.",
  icon: GooglePhotosIcon,
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
        description:
          "Search and import Google Photos library items for a trace.",
      },
    ],
  },
};
