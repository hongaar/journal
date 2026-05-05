import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TracePhotoSuggestion } from "@curolia/plugin-contract";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { googlePhotosImport, googlePhotosSearch } from "@/lib/google-photos-functions";
import { useAuth } from "@/providers/auth-provider";
import { getPluginDefinition } from "@/plugins/registry";
import { Button } from "@curolia/ui/button";
import { Checkbox } from "@curolia/ui/checkbox";

type Props = {
  traceId: string;
  journalId: string;
};

export function TraceGooglePhotosSuggestions({ traceId, journalId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const def = getPluginDefinition("google_photos");
  const [suggestions, setSuggestions] = useState<TracePhotoSuggestion[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const enabledQuery = useQuery({
    queryKey: ["user_plugins", user?.id, "google_photos"],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_plugins")
        .select("enabled")
        .eq("user_id", user.id)
        .eq("plugin_type_id", "google_photos")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(user),
  });

  const pluginEnabled = Boolean(enabledQuery.data?.enabled) && (def?.implemented ?? false);

  const searchMut = useMutation({
    mutationFn: async () => googlePhotosSearch(traceId),
    onSuccess: (result) => {
      setSuggestions(result.suggestions);
      setSelected(new Set());
      if (result.needsLink) {
        toast.info("Link Google Photos under Settings → Plugins, then try again.");
        return;
      }
      if (result.suggestions.length === 0) {
        toast.message("No matching photos found in your library for this date and place.");
      }
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Search failed");
    },
  });

  const importMut = useMutation({
    mutationFn: async (ids: string[]) => googlePhotosImport(traceId, ids),
    onSuccess: async (importedIds) => {
      toast.success(importedIds.length === 1 ? "Imported 1 photo." : `Imported ${importedIds.length} photos.`);
      setSelected(new Set());
      await qc.invalidateQueries({ queryKey: ["photos", traceId] });
      await qc.invalidateQueries({ queryKey: ["journal-trace-photos", journalId] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Import failed");
    },
  });

  const busy = searchMut.isPending || importMut.isPending;

  const selectedArr = useMemo(() => [...selected], [selected]);

  function toggleId(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  if (!pluginEnabled) return null;

  return (
    <div className="border-border/60 border-t pt-4">
      <h3 className="mb-2 text-sm font-medium">Google Photos</h3>
      <p className="text-muted-foreground mb-3 text-xs leading-relaxed">
        Search your library for shots near this trace and in its date range, then import copies into this trace.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl"
          disabled={busy}
          onClick={() => searchMut.mutate()}
        >
          {searchMut.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Search library
        </Button>
        <Button
          type="button"
          size="sm"
          className="rounded-xl"
          disabled={busy || selectedArr.length === 0}
          onClick={() => importMut.mutate(selectedArr)}
        >
          {importMut.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Import selected
        </Button>
      </div>
      {suggestions.length > 0 ? (
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {suggestions.map((s) => (
            <li
              key={s.externalId}
              className="border-border/80 bg-muted/30 flex gap-2 rounded-lg border p-2 text-xs"
            >
              <Checkbox
                checked={selected.has(s.externalId)}
                onCheckedChange={(v) => toggleId(s.externalId, v === true)}
                aria-label={s.title ?? "Photo"}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                {s.thumbnailUrl ? (
                  <img
                    src={s.thumbnailUrl}
                    alt=""
                    className="mb-1 aspect-square w-full rounded-md object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="bg-muted mb-1 aspect-square w-full rounded-md" />
                )}
                <p className="truncate font-medium">{s.title ?? "Untitled"}</p>
                {s.capturedAt ? (
                  <p className="text-muted-foreground truncate tabular-nums">{s.capturedAt.slice(0, 16)}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
