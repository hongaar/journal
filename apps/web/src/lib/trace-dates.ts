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

export function formatTraceDateRange(date: string, endDate: string | null | undefined): string {
  if (!endDate || endDate === date) return formatLocalCalendarDay(date);
  return `${formatLocalCalendarDay(date)} – ${formatLocalCalendarDay(endDate)}`;
}

export function localTodayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
