import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { TraceLink } from "@/types/database";

export function useTraceLinks(traceId: string | undefined) {
  return useQuery({
    queryKey: ["trace-links", traceId],
    queryFn: async () => {
      if (!traceId) return [] as TraceLink[];
      const { data, error } = await supabase
        .from("trace_links")
        .select("*")
        .eq("trace_id", traceId)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as TraceLink[];
    },
    enabled: Boolean(traceId),
  });
}
