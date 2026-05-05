/** Per-journal iCalendar plugin settings stored in `journal_plugins.config`. */
export type IcalJournalPluginConfig = {
  publishFeed?: boolean;
};

export const ICAL_PLUGIN_ID = "ical" as const;

export function parseIcalJournalConfig(
  raw: Record<string, unknown> | undefined | null,
): IcalJournalPluginConfig {
  if (!raw || typeof raw !== "object") return {};
  return {
    publishFeed: raw.publishFeed === true,
  };
}
