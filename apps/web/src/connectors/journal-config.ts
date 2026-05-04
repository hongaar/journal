import type { JournalConnector } from "@/types/database";

/** Per-journal iCalendar connector settings stored in `journal_connectors.config`. */
export type IcalJournalConnectorConfig = {
  publishFeed?: boolean;
};

export function parseIcalJournalConfig(raw: Record<string, unknown> | undefined | null): IcalJournalConnectorConfig {
  if (!raw || typeof raw !== "object") return {};
  return {
    publishFeed: raw.publishFeed === true,
  };
}

/** Shallow merge for `journal_connectors.config` updates (extend per connector as needed). */
export function mergeJournalConnectorConfig(
  _connectorTypeId: string,
  existing: Record<string, unknown> | undefined | null,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...existing }
      : {};
  return { ...base, ...patch };
}

export function journalConnectorConfigObject(jc: JournalConnector | undefined): Record<string, unknown> {
  const c = jc?.config;
  if (c && typeof c === "object" && !Array.isArray(c)) return { ...(c as Record<string, unknown>) };
  return {};
}
