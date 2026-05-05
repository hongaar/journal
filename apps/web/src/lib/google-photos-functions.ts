import type { TracePhotoSuggestion } from "@curolia/plugin-contract";
import { supabase } from "@/lib/supabase";

export async function googlePhotosSearch(traceId: string): Promise<{
  suggestions: TracePhotoSuggestion[];
  needsLink: boolean;
}> {
  const { data, error } = await supabase.functions.invoke<{
    suggestions?: TracePhotoSuggestion[];
    error?: string;
  }>("google-photos", {
    body: { action: "search", traceId },
  });
  if (error) throw error;
  if (data?.error === "google_not_linked") {
    return { suggestions: [], needsLink: true };
  }
  return { suggestions: data?.suggestions ?? [], needsLink: false };
}

export async function googlePhotosImport(traceId: string, mediaItemIds: string[]): Promise<string[]> {
  const { data, error } = await supabase.functions.invoke<{
    importedIds?: string[];
    error?: string;
  }>("google-photos", {
    body: { action: "import", traceId, mediaItemIds },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.importedIds ?? [];
}
