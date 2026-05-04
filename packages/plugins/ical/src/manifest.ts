import type { PluginPackageManifest } from "@curolia/plugin-contract";

export const icalPluginManifest: PluginPackageManifest = {
  id: "ical",
  displayName: "iCalendar",
  capabilities: ["export_ics"] as const,
  implemented: true,
  contributions: {
    journalSettings: {
      panel: "inline",
      title: "iCalendar feed",
    },
    edgeFunctions: [
      {
        slug: "ical-feed",
        verifyJwt: false,
        description: "Public .ics subscription URL (token query param).",
      },
    ],
  },
};
