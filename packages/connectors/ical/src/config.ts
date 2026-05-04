/** Per-journal iCalendar connector settings stored in `journal_connectors.config`. */
export type IcalJournalConnectorConfig = {
  publishFeed?: boolean;
};

export const ICAL_CONNECTOR_ID = "ical" as const;

export function parseIcalJournalConfig(raw: Record<string, unknown> | undefined | null): IcalJournalConnectorConfig {
  if (!raw || typeof raw !== "object") return {};
  return {
    publishFeed: raw.publishFeed === true,
  };
}
