import {
  googlePhotosImport,
  googlePhotosPickerCreate,
  googlePhotosPickerList,
  googlePhotosPickerThumbnails,
  googlePhotosWaitForPickerSelection,
} from "@/lib/google-photos-functions";
import { googlePhotosLibrarySearchPasteLine } from "@/lib/google-photos-search-paste";
import { supabase } from "@/lib/supabase";
import { getPluginDefinition } from "@/plugins/registry";
import { useAuth } from "@/providers/auth-provider";
import type { TracePhotoSuggestion } from "@curolia/plugin-contract";
import { Button } from "@curolia/ui/button";
import { Checkbox } from "@curolia/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@curolia/ui/dialog";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Props = {
  traceId: string;
  journalId: string;
  traceDate?: string | null;
  traceEndDate?: string | null;
};

/** Survives TraceGooglePhotosSuggestions unmount (e.g. dialog closes while Google picker is open). */
function googlePhotosPickerCacheKey(traceId: string) {
  return ["google-photos-picker", traceId] as const;
}

type GooglePhotosPickerCache = {
  sessionId: string;
  suggestions: TracePhotoSuggestion[];
};

export function TraceGooglePhotosSuggestions({
  traceId,
  journalId,
  traceDate,
  traceEndDate,
}: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const def = getPluginDefinition("google_photos");
  const [suggestions, setSuggestions] = useState<TracePhotoSuggestion[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  /** Imports resolve picked bytes against this session until upload completes. */
  const [pickerSessionId, setPickerSessionId] = useState<string | null>(null);
  const [pickPrepOpen, setPickPrepOpen] = useState(false);

  const searchPasteLine = useMemo(
    () => googlePhotosLibrarySearchPasteLine(traceDate, traceEndDate),
    [traceDate, traceEndDate],
  );

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
    placeholderData: keepPreviousData,
  });

  const pluginEnabled =
    Boolean(enabledQuery.data?.enabled) && (def?.implemented ?? false);

  const prevTraceIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pluginEnabled) return;
    const switched = prevTraceIdRef.current !== traceId;
    prevTraceIdRef.current = traceId;

    const cached = qc.getQueryData<GooglePhotosPickerCache>(
      googlePhotosPickerCacheKey(traceId),
    );
    queueMicrotask(() => {
      if (cached) {
        setSuggestions(cached.suggestions);
        setPickerSessionId(cached.sessionId);
        setSelected(
          new Set(
            cached.suggestions
              .map((i) => i.externalId)
              .filter((id): id is string => Boolean(id)),
          ),
        );
        return;
      }
      if (switched) {
        setSuggestions([]);
        setSelected(new Set());
        setPickerSessionId(null);
      }
    });
  }, [pluginEnabled, qc, traceId]);

  const pickMut = useMutation({
    mutationFn: async () => {
      const { sessionId, pickerUri, expireTime } =
        await googlePhotosPickerCreate(traceId);
      const openUrl = pickerUri.endsWith("/")
        ? `${pickerUri}autoclose`
        : `${pickerUri}/autoclose`;
      // Avoid `noopener` here: some browsers return null from window.open and/or omit
      // Window.closed, so we cannot detect when /autoclose finishes before mediaItemsSet polls.
      const win = window.open(
        openUrl,
        "_blank",
        "popup=yes,width=1100,height=800",
      );
      if (!win) {
        throw new Error("popup_blocked");
      }
      try {
        win.opener = null;
      } catch {
        /* cross-origin */
      }
      const done = await googlePhotosWaitForPickerSelection(
        sessionId,
        expireTime,
        win,
      );
      if (!done) {
        throw new Error("picker_cancelled_or_timed_out");
      }
      const { suggestions: items } = await googlePhotosPickerList(sessionId);
      const ids = items.map((i) => i.externalId);
      let thumbs: Record<string, string> = {};
      if (ids.length > 0) {
        try {
          thumbs = await googlePhotosPickerThumbnails(sessionId, ids);
        } catch {
          /* thumbnails optional */
        }
      }
      const merged = items.map((s) => ({
        ...s,
        thumbnailUrl: thumbs[s.externalId] ?? s.thumbnailUrl,
      }));
      const result: { sessionId: string; suggestions: TracePhotoSuggestion[] } =
        { sessionId, suggestions: merged };
      qc.setQueryData(googlePhotosPickerCacheKey(traceId), result);
      return result;
    },
    onSuccess: ({ sessionId, suggestions: items }) => {
      setSuggestions(items);
      setSelected(
        new Set(
          items
            .map((i) => i.externalId)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      setPickerSessionId(sessionId);
      if (items.length === 0) {
        toast.message("No photos selected.");
      }
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "pick_failed";
      if (msg === "popup_blocked") {
        toast.error("Allow pop-ups for this site to open Google Photos.");
        return;
      }
      if (msg === "picker_cancelled_or_timed_out") {
        toast.message("Selection closed or timed out without photos.");
        return;
      }
      toast.error(e instanceof Error ? e.message : "Picker failed");
    },
  });

  const importMut = useMutation({
    mutationFn: async (payload: { ids: string[]; pickerSessionId: string }) => {
      const { ids, pickerSessionId: sessionForImport } = payload;
      if (!sessionForImport.trim()) {
        throw new Error("Pick photos first (session expired).");
      }
      return googlePhotosImport(traceId, ids, sessionForImport);
    },
    onSuccess: async (importedIds) => {
      if (importedIds.length === 0) {
        toast.message(
          "Nothing imported. If files already exist or Google denied download, choose different items.",
        );
      } else {
        toast.success(
          importedIds.length === 1
            ? "Imported 1 photo."
            : `Imported ${importedIds.length} photos.`,
        );
      }
      setSelected(new Set());
      setPickerSessionId(null);
      qc.removeQueries({ queryKey: googlePhotosPickerCacheKey(traceId) });
      await qc.invalidateQueries({ queryKey: ["photos", traceId] });
      await qc.invalidateQueries({ queryKey: ["photo-urls", traceId] });
      await qc.invalidateQueries({
        queryKey: ["journal-trace-photos", journalId],
      });
      await qc.refetchQueries({ queryKey: ["photos", traceId] });
      await qc.refetchQueries({ queryKey: ["photo-urls", traceId] });
      await qc.refetchQueries({
        queryKey: ["journal-trace-photos", journalId],
      });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Import failed");
    },
  });

  const busy = pickMut.isPending || importMut.isPending;

  const selectedArr = useMemo(() => [...selected], [selected]);

  const importDisabled = busy || selectedArr.length === 0 || !pickerSessionId;

  function toggleId(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  if (!pluginEnabled) return null;

  function openPickerOnly() {
    setPickPrepOpen(false);
    pickMut.mutate();
  }

  async function copySearchPasteAndStartPicker() {
    try {
      await navigator.clipboard.writeText(searchPasteLine);
      toast.success("Date range copied. Paste it into Google Photos search.");
    } catch {
      toast.message(
        "Could not copy automatically — copy the text in the dialog.",
      );
    }
    setPickPrepOpen(false);
    pickMut.mutate();
  }

  return (
    <div className="border-border/60 border-t pt-4">
      <Dialog open={pickPrepOpen} onOpenChange={setPickPrepOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Search in Google Photos</DialogTitle>
            <DialogDescription>
              Copy this line, open Google Photos, paste it into search, then
              pick the photos you want.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/50 rounded-lg border px-3 py-2 font-mono text-sm break-words">
            {searchPasteLine}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => openPickerOnly()}
            >
              Open only
            </Button>
            <Button
              type="button"
              size="sm"
              className="rounded-xl"
              onClick={() => void copySearchPasteAndStartPicker()}
            >
              Copy & open Google Photos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <h3 className="mb-2 text-sm font-medium">Google Photos</h3>
      <p className="text-muted-foreground mb-3 text-xs leading-relaxed">
        Open Google Photos to choose photos from your library.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="default"
          size="sm"
          className="rounded-xl"
          disabled={busy}
          onClick={() => setPickPrepOpen(true)}
        >
          {pickMut.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          Pick from Google Photos
        </Button>
        <Button
          type="button"
          size="sm"
          className="rounded-xl"
          disabled={importDisabled}
          onClick={() => {
            if (!pickerSessionId) return;
            importMut.mutate({
              ids: selectedArr,
              pickerSessionId,
            });
          }}
        >
          {importMut.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
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
                onCheckedChange={(checked) =>
                  toggleId(s.externalId, Boolean(checked))
                }
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
                  <p className="text-muted-foreground truncate tabular-nums">
                    {s.capturedAt.slice(0, 16)}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
