import type { SupabaseClient } from "@supabase/supabase-js";
import type { SpotifyTracePayload } from "./spotify-trace-data";

export type SpotifySyncResponse =
  | {
      skippedReason: "no_trace_date";
      cleared?: boolean;
    }
  | {
      synced: true;
      payload: SpotifyTracePayload;
    }
  | {
      error: string;
      reason?: string;
    };

export async function spotifySyncTraceListening(
  supabase: SupabaseClient,
  traceId: string,
): Promise<SpotifySyncResponse> {
  const { data, error } = await supabase.functions.invoke<SpotifySyncResponse>(
    "spotify",
    { body: { action: "sync_top_tracks", traceId } },
  );
  if (error) {
    return { error: error.message || "spotify_sync_failed" };
  }
  if (!data || typeof data !== "object") {
    return { error: "spotify_sync_invalid_response" };
  }
  return data;
}
