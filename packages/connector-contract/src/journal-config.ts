/**
 * Generic helpers for `journal_connectors.config` JSON (per connector-type keys).
 */

export type JournalConnectorLike = {
  config?: unknown;
};

export function journalConnectorConfigRecord(
  jc: JournalConnectorLike | undefined | null,
): Record<string, unknown> {
  const c = jc?.config;
  if (c && typeof c === "object" && !Array.isArray(c)) return { ...(c as Record<string, unknown>) };
  return {};
}

/** Shallow merge for `journal_connectors.config` updates. */
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
