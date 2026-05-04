import type { ConnectorPackageManifest } from "@curolia/connector-contract";

export const icalConnectorManifest: ConnectorPackageManifest = {
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
