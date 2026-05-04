import type { Photo, Trace } from "@/types/database";

export type TraceWithTags = Trace & {
  trace_tags?: { tag_id: string; tags: { id: string; name: string; color: string; icon_emoji: string } | null }[];
  photos?: Pick<Photo, "id" | "storage_path" | "sort_order">[] | null;
};

export function filterTracesByTags(traces: TraceWithTags[], selectedTagIds: Set<string>) {
  return traces.filter((t) => {
    if (selectedTagIds.size === 0) return true;
    const tagIds = new Set(
      (t.trace_tags ?? [])
        .map((tt) => tt.tags?.id)
        .filter((id): id is string => Boolean(id)),
    );
    for (const id of selectedTagIds) {
      if (tagIds.has(id)) return true;
    }
    return false;
  });
}
