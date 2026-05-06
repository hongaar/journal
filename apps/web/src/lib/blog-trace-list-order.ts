import type { TraceWithTags } from "@/lib/trace-with-tags";

export type BlogTraceListOrder = "chronological" | "alphabetical";

const STORAGE_KEY = "journal:blogTraceListOrder";

type StoredPayload = {
  v: 1;
  byJournal: Record<string, BlogTraceListOrder>;
};

function isBlogTraceListOrder(v: unknown): v is BlogTraceListOrder {
  return v === "chronological" || v === "alphabetical";
}

function parsePayload(raw: string | null): StoredPayload["byJournal"] {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return {};
    const o = data as Partial<StoredPayload>;
    if (o.v !== 1 || !o.byJournal || typeof o.byJournal !== "object") return {};
    const entries = Object.entries(o.byJournal).filter(
      ([key, mode]) =>
        typeof key === "string" && key.length > 0 && isBlogTraceListOrder(mode),
    ) as [string, BlogTraceListOrder][];
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

/** Default when nothing is stored for this journal. */
export function readBlogTraceListOrder(
  journalId: string | null,
): BlogTraceListOrder {
  if (!journalId) return "chronological";
  if (typeof localStorage === "undefined") return "chronological";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const byJournal = parsePayload(raw);
    const stored = byJournal[journalId];
    return stored ?? "chronological";
  } catch {
    return "chronological";
  }
}

export function writeBlogTraceListOrder(
  journalId: string | null,
  order: BlogTraceListOrder,
): void {
  if (!journalId) return;
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const byJournal = { ...parsePayload(raw), [journalId]: order };
    const payload: StoredPayload = { v: 1, byJournal };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

/** Traces filtered from a chronological query; alphabetical re-sorts, chronological keeps Array order. */
export function orderedBlogTraceList(
  traces: TraceWithTags[],
  order: BlogTraceListOrder,
): TraceWithTags[] {
  if (order !== "alphabetical") return traces;

  return [...traces].sort((a, b) => {
    const ta = (a.title?.trim() || "Untitled trace").toLocaleLowerCase();
    const tb = (b.title?.trim() || "Untitled trace").toLocaleLowerCase();
    const cmp = ta.localeCompare(tb, undefined, { sensitivity: "base" });
    if (cmp !== 0) return cmp;
    return a.id.localeCompare(b.id);
  });
}
