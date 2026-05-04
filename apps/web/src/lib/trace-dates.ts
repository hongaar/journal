/** Format YYYY-MM-DD in the user's local calendar (avoids UTC parsing pitfalls). */
export function formatLocalCalendarDay(ymd: string): string {
  const parts = ymd.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return ymd;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatTraceDateRange(date: string | null | undefined, endDate: string | null | undefined): string {
  if (!date) return "";
  if (!endDate || endDate === date) return formatLocalCalendarDay(date);
  return `${formatLocalCalendarDay(date)} – ${formatLocalCalendarDay(endDate)}`;
}

/** One line: optional date range plus coordinates (middle dot only between present parts). */
export function formatTraceLocationLine(
  date: string | null | undefined,
  endDate: string | null | undefined,
  lat: number,
  lng: number,
  coordDecimals = 5,
): string {
  const datePart = formatTraceDateRange(date, endDate);
  const coords = `${lat.toFixed(coordDecimals)}, ${lng.toFixed(coordDecimals)}`;
  return datePart ? `${datePart} · ${coords}` : coords;
}

export function formatTraceMetadataTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** True when the row was edited after insert (strictly after `created_at`). */
export function traceWasModifiedAfterCreate(createdAt: string, updatedAt: string): boolean {
  return new Date(updatedAt).getTime() > new Date(createdAt).getTime();
}

export function localTodayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
