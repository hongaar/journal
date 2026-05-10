/**
 * Builds a human-readable date line for Google Photos library search paste.
 * Dates are Postgres `YYYY-MM-DD` calendar days; interpreted in UTC midday to avoid TZ shifts.
 */
export function googlePhotosLibrarySearchPasteLine(
  startDay: string | null | undefined,
  endDay: string | null | undefined,
): string {
  const s = startDay?.trim()
    ? startDay.trim()
    : new Date().toISOString().slice(0, 10);
  const e = endDay?.trim() ? endDay.trim() : s;

  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  const utcNoon = (isoDay: string) => new Date(`${isoDay}T12:00:00.000Z`);

  const a = fmt.format(utcNoon(s));
  const b = fmt.format(utcNoon(e));
  return a === b ? a : `${a} - ${b}`;
}
