import { supabase } from "@/lib/supabase";

export type TraceSearchRow = {
  id: string;
  journal_id: string;
  title: string | null;
  description: string | null;
  location_label: string | null;
  lat: number;
  lng: number;
  date: string | null;
};

/** Strip characters that break PostgREST `or()` / `ilike` patterns or add noise. */
export function sanitizeSearchFragment(raw: string): string {
  return raw
    .trim()
    .replace(/[%_,\\]/g, " ")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

export async function searchTracesInJournals(
  journalIds: string[],
  query: string,
): Promise<TraceSearchRow[]> {
  const q = sanitizeSearchFragment(query);
  if (q.length < 2 || journalIds.length === 0) return [];

  const pattern = `%${q}%`;
  const { data, error } = await supabase
    .from("traces")
    .select("id, journal_id, title, description, location_label, lat, lng, date")
    .in("journal_id", journalIds)
    .or(`title.ilike.${pattern},description.ilike.${pattern},location_label.ilike.${pattern}`)
    .order("date", { ascending: false, nullsFirst: false })
    .limit(40);

  if (error) throw error;
  return (data ?? []) as TraceSearchRow[];
}

export function sortTracesByPreferredJournal<T extends { journal_id: string; date?: string | null }>(
  rows: T[],
  preferredJournalId: string | null,
): T[] {
  return [...rows].sort((a, b) => {
    const ap = preferredJournalId && a.journal_id === preferredJournalId ? 0 : 1;
    const bp = preferredJournalId && b.journal_id === preferredJournalId ? 0 : 1;
    if (ap !== bp) return ap - bp;
    const ad = a.date ?? "";
    const bd = b.date ?? "";
    return bd.localeCompare(ad);
  });
}
