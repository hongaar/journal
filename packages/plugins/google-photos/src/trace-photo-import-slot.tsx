import type { TracePhotoImportSlotProps } from "@curolia/plugin-contract";
import { Button } from "@curolia/ui/button";
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
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  googlePhotosImport,
  googlePhotosPickerCreate,
  googlePhotosPickerList,
  googlePhotosWaitForPickerSelection,
} from "./google-photos-edge";
import { googlePhotosLibrarySearchPasteLine } from "./google-photos-search-paste";
import { GooglePhotosIcon } from "./icon";
import { googlePhotosPluginMeta } from "./plugin-meta";

export function GooglePhotosTracePhotoImportSlot({
  supabase,
  userId,
  traceId,
  journalId,
  traceDate,
  traceEndDate,
}: TracePhotoImportSlotProps) {
  const qc = useQueryClient();
  const [pickPrepOpen, setPickPrepOpen] = useState(false);

  const searchPasteLine = useMemo(
    () => googlePhotosLibrarySearchPasteLine(traceDate, traceEndDate),
    [traceDate, traceEndDate],
  );

  const enabledQuery = useQuery({
    queryKey: ["user_plugins", userId, googlePhotosPluginMeta.typeId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("user_plugins")
        .select("enabled")
        .eq("user_id", userId)
        .eq("plugin_type_id", googlePhotosPluginMeta.typeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(userId),
    placeholderData: keepPreviousData,
  });

  const pluginEnabled =
    Boolean(enabledQuery.data?.enabled) && googlePhotosPluginMeta.implemented;

  const pickAndImportMut = useMutation({
    mutationFn: async () => {
      const { sessionId, pickerUri, expireTime } =
        await googlePhotosPickerCreate(supabase, traceId);
      const openUrl = pickerUri.endsWith("/")
        ? `${pickerUri}autoclose`
        : `${pickerUri}/autoclose`;
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
        supabase,
        sessionId,
        expireTime,
        win,
      );
      if (!done) {
        throw new Error("picker_cancelled_or_timed_out");
      }
      const { suggestions: items } = await googlePhotosPickerList(
        supabase,
        sessionId,
      );
      const ids = items
        .map((i) => i.externalId)
        .filter((id): id is string => Boolean(id));
      if (ids.length === 0) {
        return { kind: "none_selected" as const };
      }
      const importedIds = await googlePhotosImport(
        supabase,
        traceId,
        ids,
        sessionId,
      );
      return { kind: "imported" as const, importedIds };
    },
    onSuccess: async (result) => {
      if (!result || result.kind === "none_selected") {
        toast.message("No photos selected.");
        return;
      }
      const { importedIds } = result;
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
      const msg = e instanceof Error ? e.message : "pick_failed";
      if (msg === "popup_blocked") {
        toast.error("Allow pop-ups for this site to open Google Photos.");
        return;
      }
      if (msg === "picker_cancelled_or_timed_out") {
        toast.message("Selection closed or timed out without photos.");
        return;
      }
      toast.error(e instanceof Error ? e.message : "Import failed");
    },
  });

  const busy = pickAndImportMut.isPending;

  if (!pluginEnabled) return null;

  function openPickerOnly() {
    setPickPrepOpen(false);
    pickAndImportMut.mutate();
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
    pickAndImportMut.mutate();
  }

  const label = `Select from ${googlePhotosPluginMeta.displayName}`;

  return (
    <>
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-xl gap-2"
        disabled={busy}
        onClick={() => setPickPrepOpen(true)}
        aria-label={label}
      >
        {busy ? <Loader2 className="size-4 shrink-0 animate-spin" /> : null}
        <GooglePhotosIcon className="size-4 shrink-0" />
        <span>{label}</span>
      </Button>
    </>
  );
}
