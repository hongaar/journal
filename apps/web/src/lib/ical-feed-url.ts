/** Public Edge Function URL for the journal iCalendar feed (anon + token). */
export function icalFeedPublicUrl(supabaseProjectUrl: string, token: string): string {
  const base = supabaseProjectUrl.replace(/\/$/, "");
  return `${base}/functions/v1/ical-feed?token=${encodeURIComponent(token)}`;
}
