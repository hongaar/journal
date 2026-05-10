import type { SupabaseClient } from "@supabase/supabase-js";

export type SpotifySyncTopTracksResult = {
  added: number;
  skippedExisting: number;
  scannedPages: number;
  playsInRange: number;
  limitedByPagination: boolean;
  skippedReason?: string;
};

export async function spotifySyncTopTracksForTrace(
  supabase: SupabaseClient,
  traceId: string,
): Promise<SpotifySyncTopTracksResult> {
  const { data, error } =
    await supabase.functions.invoke<SpotifySyncTopTracksResult>("spotify", {
      body: { action: "sync_top_tracks", traceId },
    });
  if (error) throw new Error(error.message || "spotify_sync_failed");
  if (!data || typeof data.added !== "number") {
    throw new Error("spotify_sync_invalid_response");
  }
  return data;
}
