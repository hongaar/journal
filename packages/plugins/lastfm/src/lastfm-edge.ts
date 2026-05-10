import type { SupabaseClient } from "@supabase/supabase-js";
import type { LastfmTracePayload } from "./lastfm-trace-data";

export type LastfmSyncResponse =
  | {
      skippedReason: "no_trace_date";
      cleared?: boolean;
    }
  | {
      synced: true;
      payload: LastfmTracePayload;
    }
  | {
      error: string;
      reason?: string;
    };

export async function lastfmSyncTraceListening(
  supabase: SupabaseClient,
  traceId: string,
): Promise<LastfmSyncResponse> {
  const { data, error } = await supabase.functions.invoke<LastfmSyncResponse>(
    "lastfm",
    { body: { action: "sync_top_tracks", traceId } },
  );
  if (error) {
    return { error: error.message || "lastfm_sync_failed" };
  }
  if (!data || typeof data !== "object") {
    return { error: "lastfm_sync_invalid_response" };
  }
  return data;
}
