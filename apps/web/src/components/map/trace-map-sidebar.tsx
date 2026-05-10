import { FloatingPanel } from "@/components/layout/floating-panel";
import type { TraceMapHandle } from "@/components/map/trace-map";
import { TraceFormDialog } from "@/components/traces/trace-form-dialog";
import {
  TracePhotoLightbox,
  TracePhotoThumb,
} from "@/components/traces/trace-photo-lightbox";
import { useMaxSm } from "@/hooks/use-max-sm";
import { traceDetailHref } from "@/lib/app-paths";
import { mapAnchorPanelMiddleware } from "@/lib/map-anchor-floating-ui";
import { supabase } from "@/lib/supabase";
import { formatTraceDateRange } from "@/lib/trace-dates";
import { photosToLightboxItems } from "@/lib/trace-photo-lightbox-items";
import type { TraceWithTags } from "@/lib/trace-with-tags";
import { useTracePhotosSignedUrls } from "@/lib/use-trace-photos";
import { cn, contrastingForeground } from "@/lib/utils";
import type { Trace } from "@/types/database";
import { Badge } from "@curolia/ui/badge";
import { Button, buttonVariants } from "@curolia/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@curolia/ui/sheet";
import { autoUpdate, computePosition } from "@floating-ui/dom";
import { useQuery } from "@tanstack/react-query";
import { Pencil, X } from "lucide-react";
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Link } from "react-router-dom";

type TraceSidebarRow = TraceWithTags;

type TraceMapSidebarProps = {
  traceId: string;
  journalId: string | null;
  /** Journal URL segment for `/traces/:journalSlug/:traceSlug`. */
  journalSlug: string | null;
  mapRef: RefObject<TraceMapHandle | null>;
  /** Marker position from map list detail (immediate); avoids fixed-panel flash before trace query resolves. */
  listAnchorLngLat?: { lat: number; lng: number } | null;
  onClose: () => void;
};

function validLngLat(
  lat: unknown,
  lng: unknown,
): { lat: number; lng: number } | null {
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  )
    return null;
  return { lat, lng };
}

export function TraceMapSidebar({
  traceId,
  journalId,
  journalSlug,
  mapRef,
  listAnchorLngLat = null,
  onClose,
}: TraceMapSidebarProps) {
  const isMobile = useMaxSm();
  const floatingRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [photoLightbox, setPhotoLightbox] = useState<{
    photoId: string;
  } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  /** Desktop floating: hide until first computePosition applies (avoids 0,0 / flow flash). */
  const [placementReady, setPlacementReady] = useState(false);

  const virtualReference = useMemo(
    () => ({
      getBoundingClientRect() {
        const a = anchorRef.current;
        return new DOMRect(a.x, a.y, 0, 0);
      },
    }),
    [],
  );

  const traceQuery = useQuery({
    queryKey: ["trace", traceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("traces")
        .select(
          `*,
          trace_tags ( tag_id, tags ( id, name, color, icon_emoji ) )`,
        )
        .eq("id", traceId)
        .maybeSingle();
      if (error) throw error;
      return data as TraceSidebarRow | null;
    },
    enabled: Boolean(traceId),
  });

  const trace = traceQuery.data;
  const { photos, signedUrlByPhotoId } = useTracePhotosSignedUrls(traceId);
  const wrongJournal = trace && journalId && trace.journal_id !== journalId;

  const anchorCoords = useMemo(() => {
    const fromRow = trace ? validLngLat(trace.lat, trace.lng) : null;
    if (fromRow) return fromRow;
    return listAnchorLngLat
      ? validLngLat(listAnchorLngLat.lat, listAnchorLngLat.lng)
      : null;
  }, [trace, listAnchorLngLat]);

  const lightboxItems = useMemo(
    () => photosToLightboxItems(photos, signedUrlByPhotoId),
    [photos, signedUrlByPhotoId],
  );

  const tagBadges = useMemo(() => {
    const rows = trace?.trace_tags ?? [];
    return rows.map((tt) => tt.tags).filter(Boolean) as {
      id: string;
      name: string;
      color: string;
      icon_emoji: string;
    }[];
  }, [trace]);

  useLayoutEffect(() => {
    if (isMobile || !anchorCoords) return;
    const floating = floatingRef.current;
    if (!floating) return;

    let cancelled = false;
    let pulseRaf = 0;
    let pulseCount = 0;

    /** Project marker to screen — null until TraceMap canvas is ready after navigation/remount/refresh. */
    const latestScreenAnchor = (): { x: number; y: number } | null => {
      return (
        mapRef.current?.lngLatToScreen(anchorCoords.lng, anchorCoords.lat) ??
        null
      );
    };

    /** Never call Floating UI with a stale {0,0} anchor — that pins the panel to the top-left. */
    const run = () => {
      if (cancelled) return;
      const p = latestScreenAnchor();
      if (!p) {
        floating.style.removeProperty("left");
        floating.style.removeProperty("top");
        floating.style.removeProperty("right");
        floating.style.removeProperty("bottom");
        floating.style.removeProperty("position");
        setPlacementReady(false);
        return;
      }

      anchorRef.current = { x: p.x, y: p.y };

      void computePosition(virtualReference, floating, {
        placement: "right",
        strategy: "fixed",
        middleware: mapAnchorPanelMiddleware(),
      }).then((data) => {
        if (cancelled) return;
        const host = floatingRef.current;
        if (!host) return;
        const verify = latestScreenAnchor();
        if (!verify) {
          setPlacementReady(false);
          return;
        }
        anchorRef.current = { x: verify.x, y: verify.y };

        Object.assign(host.style, {
          position: "fixed",
          left: `${data.x}px`,
          top: `${data.y}px`,
          right: "auto",
          bottom: "auto",
        });
        setPlacementReady(true);
      });
    };

    run();

    const pulse = () => {
      run();
      pulseCount += 1;
      if (!cancelled && pulseCount < 30) {
        pulseRaf = requestAnimationFrame(pulse);
      }
    };
    pulseRaf = requestAnimationFrame(pulse);

    const unsub = mapRef.current?.subscribeCamera(run) ?? (() => {});

    const onResize = () => run();
    window.addEventListener("resize", onResize);

    const stopAu = autoUpdate(
      virtualReference,
      floating,
      () => {
        run();
      },
      {
        animationFrame: true,
        layoutShift: true,
      },
    );

    return () => {
      cancelled = true;
      cancelAnimationFrame(pulseRaf);
      unsub();
      window.removeEventListener("resize", onResize);
      stopAu();
    };
  }, [isMobile, anchorCoords, virtualReference, traceId, mapRef]);

  const traceForEdit: Trace | null = trace ?? null;

  const titleText = traceQuery.isLoading
    ? "Loading…"
    : trace?.title || "Untitled place";

  const traceDateSubtitle =
    trace && !wrongJournal
      ? formatTraceDateRange(trace.date, trace.end_date)
      : "";

  const body = (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pt-2">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-display text-foreground min-w-0 flex-1 text-lg leading-tight font-normal tracking-tight">
          {titleText}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          {trace && journalId ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="size-4" />
              Edit
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 rounded-lg"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {traceQuery.isLoading ? (
        <p className="text-muted-foreground text-sm">Fetching trace…</p>
      ) : !trace || wrongJournal ? (
        <p className="text-muted-foreground text-sm">
          Trace not found or not in this journal.
        </p>
      ) : (
        <>
          {traceDateSubtitle ? (
            <p className="text-muted-foreground text-sm">{traceDateSubtitle}</p>
          ) : null}
          {tagBadges.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {tagBadges.map((t) => (
                <Badge
                  key={t.id}
                  variant="secondary"
                  className="border-0"
                  style={{
                    backgroundColor: t.color,
                    color: contrastingForeground(t.color),
                  }}
                >
                  {t.icon_emoji} {t.name}
                </Badge>
              ))}
            </div>
          ) : null}
          {trace.description ? (
            <p className="text-foreground max-h-40 overflow-y-auto text-sm whitespace-pre-wrap">
              {trace.description}
            </p>
          ) : null}
          {photos.length > 0 ? (
            <div className="min-h-0 shrink-0">
              <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {photos.map((p) => {
                  const url = signedUrlByPhotoId[p.id];
                  return url ? (
                    <TracePhotoThumb
                      key={p.id}
                      url={url}
                      className="border-border size-20 shrink-0 overflow-hidden rounded-lg border sm:size-24"
                      onOpen={() => setPhotoLightbox({ photoId: p.id })}
                    />
                  ) : (
                    <div
                      key={p.id}
                      className="bg-muted size-20 shrink-0 animate-pulse rounded-lg border sm:size-24"
                    />
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className="mt-auto flex flex-col gap-3">
            <Link
              to={
                journalSlug?.trim()
                  ? traceDetailHref(journalSlug.trim(), trace.slug)
                  : "#"
              }
              className={buttonVariants({
                variant: "secondary",
                size: "lg",
                className: "inline-flex gap-2 rounded-xl",
              })}
            >
              View trace
            </Link>
          </div>
          <TracePhotoLightbox
            open={photoLightbox !== null}
            onOpenChange={(o) => {
              if (!o) setPhotoLightbox(null);
            }}
            items={lightboxItems}
            initialPhotoId={photoLightbox?.photoId ?? null}
            title={trace.title?.trim() || "Untitled place"}
          />
        </>
      )}
    </div>
  );

  const panelClass = cn(
    "flex min-w-[min(calc(100vw-2rem),22rem)] max-w-[min(calc(100vw-2rem),22rem)] flex-col gap-0 overflow-hidden",
    anchorCoords &&
      "max-h-[min(85dvh,36rem)] sm:max-h-[min(calc(100dvh-6rem),40rem)]",
    !isMobile &&
      !anchorCoords &&
      "fixed top-[4.5rem] right-3 bottom-4 z-40 max-h-none w-[min(calc(100vw-1.5rem),22rem)] max-w-none min-w-0 sm:top-[5.25rem] sm:right-4",
  );

  const desktopFallback = !isMobile && !anchorCoords;

  const editDialog =
    traceForEdit && journalId ? (
      <TraceFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        journalId={journalId}
        trace={traceForEdit}
      />
    ) : null;

  if (isMobile) {
    return (
      <>
        {/* Pointer dismissal off: map marker taps were closing the sheet ~24ms after onSelectTrace (see debug logs). Dismiss empty map via TraceMap.onMapBackgroundClick. */}
        <Sheet
          open
          modal={false}
          disablePointerDismissal
          onOpenChange={(o) => !o && onClose()}
        >
          <SheetContent
            side="bottom"
            showCloseButton={false}
            overlayClassName="pointer-events-none bg-transparent supports-backdrop-filter:backdrop-blur-none"
            className="pointer-events-auto gap-0 rounded-t-2xl border border-[var(--panel-border)] bg-card text-card-foreground shadow-[var(--panel-shadow)] p-0"
          >
            <SheetTitle className="sr-only">{titleText}</SheetTitle>
            <div className="flex max-h-[90dvh] flex-col overflow-hidden px-4 pt-4 pb-6">
              {body}
            </div>
          </SheetContent>
        </Sheet>
        {editDialog}
      </>
    );
  }

  if (!anchorCoords && traceQuery.isPending) {
    return editDialog;
  }

  return (
    <>
      {!desktopFallback ? (
        <div
          ref={floatingRef}
          className={cn(
            "pointer-events-none z-[45] w-max min-w-0 max-w-none",
            placementReady ? "visible opacity-100" : "invisible opacity-0",
          )}
        >
          <div className="pointer-events-auto">
            <FloatingPanel className={panelClass}>{body}</FloatingPanel>
          </div>
        </div>
      ) : (
        <FloatingPanel className={cn(panelClass, "pointer-events-auto z-40")}>
          {body}
        </FloatingPanel>
      )}
      {editDialog}
    </>
  );
}
