import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { traceDetailHref } from "@/lib/app-paths";
import { TRACE_ID_PARAM_RE } from "@/lib/map-view-params";
import { supabase } from "@/lib/supabase";

export function TraceLegacyRedirectPage() {
  const { legacyTraceId } = useParams<{ legacyTraceId: string }>();
  const navigate = useNavigate();

  const destQuery = useQuery({
    queryKey: ["trace-legacy-redirect", legacyTraceId],
    queryFn: async () => {
      if (!legacyTraceId || !TRACE_ID_PARAM_RE.test(legacyTraceId)) return null;
      const { data: row, error } = await supabase
        .from("traces")
        .select("slug, journal_id")
        .eq("id", legacyTraceId)
        .maybeSingle();
      if (error) throw error;
      if (!row) return null;
      const { data: journal, error: jErr } = await supabase
        .from("journals")
        .select("slug")
        .eq("id", row.journal_id)
        .maybeSingle();
      if (jErr) throw jErr;
      const js = journal?.slug?.trim();
      if (!js) return null;
      return traceDetailHref(js, row.slug);
    },
    enabled: Boolean(legacyTraceId && TRACE_ID_PARAM_RE.test(legacyTraceId)),
  });

  useEffect(() => {
    if (!legacyTraceId || !TRACE_ID_PARAM_RE.test(legacyTraceId)) return;
    if (destQuery.isPending) return;
    const path = destQuery.data;
    if (path) navigate(path, { replace: true });
  }, [legacyTraceId, navigate, destQuery.data, destQuery.isPending]);

  if (!legacyTraceId || !TRACE_ID_PARAM_RE.test(legacyTraceId)) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-muted-foreground text-sm">Trace not found.</p>
      </div>
    );
  }

  if (destQuery.isError || (!destQuery.isPending && !destQuery.data)) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-muted-foreground text-sm">Trace not found.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      <p className="text-muted-foreground text-sm">Redirecting…</p>
    </div>
  );
}
