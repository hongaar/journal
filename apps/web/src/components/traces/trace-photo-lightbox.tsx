import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import {
  photosToLightboxItems,
  type TracePhotoLightboxItem,
} from "@/lib/trace-photo-lightbox-items";
import { useTracePhotosSignedUrls } from "@/lib/use-trace-photos";
import { Button, buttonVariants } from "@curolia/ui/button";
import { cn } from "@/lib/utils";

type TracePhotoLightboxProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: TracePhotoLightboxItem[];
  /** First slide after `items` are available; falls back to 0 if id missing. */
  initialPhotoId?: string | null;
  /** Shown in the top bar (e.g. trace title). */
  title?: string;
  /** When true and `open`, show a loading state instead of an empty overlay. */
  isLoading?: boolean;
};

export function TracePhotoLightbox({
  open,
  onOpenChange,
  items,
  initialPhotoId = null,
  title,
  isLoading = false,
}: TracePhotoLightboxProps) {
  const [index, setIndex] = useState(0);
  const itemsKey = useMemo(() => items.map((i) => i.id).join("|"), [items]);

  useEffect(() => {
    if (!open) return;
    if (items.length === 0) return;
    const idx = initialPhotoId
      ? items.findIndex((x) => x.id === initialPhotoId)
      : 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync slide when gallery opens or items / entry id change
    setIndex(idx >= 0 ? idx : 0);
  }, [open, itemsKey, initialPhotoId, items]);

  const safeIndex = items.length > 0 ? Math.min(index, items.length - 1) : 0;
  const current = items[safeIndex];
  const n = items.length;
  const hasNav = n > 1;

  const goPrev = useCallback(() => {
    setIndex((i) => (n <= 0 ? 0 : (i - 1 + n) % n));
  }, [n]);

  const goNext = useCallback(() => {
    setIndex((i) => (n <= 0 ? 0 : (i + 1) % n));
  }, [n]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      } else if (e.key === "ArrowLeft" && hasNav) {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight" && hasNav) {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, hasNav, onOpenChange, goPrev, goNext]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const showEmpty = !isLoading && n === 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[200]"
      role="dialog"
      aria-modal="true"
      aria-label={title ? `Photos: ${title}` : "Photo gallery"}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/88 backdrop-blur-sm"
        aria-label="Close gallery"
        onClick={() => onOpenChange(false)}
      />
      <div className="pointer-events-none relative flex h-full min-h-0 flex-col">
        <header className="pointer-events-auto flex shrink-0 items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <div className="text-foreground min-w-0 flex-1 pl-1">
            {title ? (
              <p className="truncate text-sm font-medium text-white">{title}</p>
            ) : null}
            {n > 0 ? (
              <p className="text-white/70 text-xs tabular-nums">
                {safeIndex + 1} / {n}
              </p>
            ) : null}
          </div>
          <div className="pointer-events-auto flex shrink-0 items-center gap-1">
            {current?.originalProductUrl ? (
              <a
                href={current.originalProductUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon-sm" }),
                  "text-white hover:bg-white/10 hover:text-white",
                )}
                aria-label="Open in Google Photos"
              >
                <ExternalLink className="size-5" />
              </a>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-white hover:bg-white/10 hover:text-white"
              aria-label="Close"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-5" />
            </Button>
          </div>
        </header>

        <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-6 sm:px-6">
          {isLoading && n === 0 ? (
            <p className="text-muted-foreground pointer-events-auto text-sm">
              Loading photos…
            </p>
          ) : showEmpty ? (
            <p className="text-muted-foreground pointer-events-auto text-sm">
              No photos to show.
            </p>
          ) : current ? (
            <div className="pointer-events-auto relative flex max-h-full w-full max-w-full items-center justify-center">
              {hasNav ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10 hover:text-white absolute left-0 top-1/2 z-20 -translate-y-1/2 sm:-left-1"
                  aria-label="Previous photo"
                  onClick={(e) => {
                    e.stopPropagation();
                    goPrev();
                  }}
                >
                  <ChevronLeft className="size-8" />
                </Button>
              ) : null}
              <img
                src={current.url}
                alt=""
                className="max-h-[min(85dvh,calc(100vh-7rem))] max-w-[min(92vw,1200px)] object-contain shadow-2xl"
                draggable={false}
              />
              {hasNav ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10 hover:text-white absolute right-0 top-1/2 z-20 -translate-y-1/2 sm:-right-1"
                  aria-label="Next photo"
                  onClick={(e) => {
                    e.stopPropagation();
                    goNext();
                  }}
                >
                  <ChevronRight className="size-8" />
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

type TracePhotoLightboxByTraceIdProps = {
  traceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPhotoId?: string | null;
  title?: string;
};

/** Fetches all photos for a trace when open — for map hover and similar. */
export function TracePhotoLightboxByTraceId({
  traceId,
  open,
  onOpenChange,
  initialPhotoId = null,
  title,
}: TracePhotoLightboxByTraceIdProps) {
  const { photos, signedUrlByPhotoId, isLoading } = useTracePhotosSignedUrls(
    traceId ?? undefined,
  );
  const items = useMemo(
    () => photosToLightboxItems(photos, signedUrlByPhotoId),
    [photos, signedUrlByPhotoId],
  );

  return (
    <TracePhotoLightbox
      open={open && Boolean(traceId)}
      onOpenChange={onOpenChange}
      items={items}
      initialPhotoId={initialPhotoId}
      title={title}
      isLoading={isLoading}
    />
  );
}

type TracePhotoThumbProps = {
  url: string;
  alt?: string;
  className?: string;
  onOpen: () => void;
};

/** Clickable thumbnail that opens the parent-controlled lightbox. */
export function TracePhotoThumb({
  url,
  alt = "",
  className,
  onOpen,
}: TracePhotoThumbProps) {
  return (
    <button
      type="button"
      className={cn(
        "group block overflow-hidden border-0 p-0 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
        className,
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpen();
      }}
    >
      <img
        src={url}
        alt={alt}
        className="size-full object-cover transition-opacity group-hover:opacity-95"
        draggable={false}
      />
    </button>
  );
}
