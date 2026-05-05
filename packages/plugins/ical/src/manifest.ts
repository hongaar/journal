import type { PluginPackageManifest } from "@curolia/plugin-contract";
import { IcalIcon } from "./icon";

export const icalPluginManifest: PluginPackageManifest = {
  id: "ical",
  displayName: "iCalendar",
  description: "Publish traces as iCalendar (.ics) files.",
  icon: IcalIcon,
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
