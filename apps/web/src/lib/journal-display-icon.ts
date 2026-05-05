/** Shown when `journals.icon_emoji` is null. */
export function defaultJournalIcon(isPersonal: boolean): string {
  return isPersonal ? "🔒" : "📓";
}

/** Persist null when the chosen emoji matches the built-in default for that journal. */
export function normalizeJournalIconForPersist(
  selected: string,
  isPersonal: boolean,
): string | null {
  const t = selected.trim();
  if (!t) return null;
  return t === defaultJournalIcon(isPersonal) ? null : t;
}
