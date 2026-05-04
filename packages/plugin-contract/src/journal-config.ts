/**
 * Generic helpers for `journal_plugins.config` JSON (per plugin-type keys).
 */

export type JournalPluginLike = {
  config?: unknown;
};

export function journalPluginConfigRecord(jp: JournalPluginLike | undefined | null): Record<string, unknown> {
  const c = jp?.config;
  if (c && typeof c === "object" && !Array.isArray(c)) return { ...(c as Record<string, unknown>) };
  return {};
}

/** Shallow merge for `journal_plugins.config` updates. */
export function mergeJournalPluginConfig(
  _pluginTypeId: string,
  existing: Record<string, unknown> | undefined | null,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...existing }
      : {};
  return { ...base, ...patch };
}
