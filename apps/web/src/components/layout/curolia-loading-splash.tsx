import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Avoid a one-frame logo flash when auth or data resolves almost immediately. */
const SHOW_LOGO_AFTER_MS = 200;

type CuroliaLoadingSplashProps = {
  className?: string;
  /** Announced to assistive technology (visual copy is the logo only). */
  statusLabel?: string;
};

export function CuroliaLoadingSplash({
  className,
  statusLabel = "Loading",
}: CuroliaLoadingSplashProps) {
  const [showLogo, setShowLogo] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setShowLogo(true), SHOW_LOGO_AFTER_MS);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div
      className={cn(
        "flex w-full flex-1 items-center justify-center bg-background",
        className,
      )}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">{statusLabel}</span>
      <div className="flex size-24 shrink-0 items-center justify-center">
        {showLogo ? (
          <img
            src="/favicon.svg"
            alt=""
            width={96}
            height={92}
            decoding="async"
            className="size-24 motion-safe:animate-curolia-splash motion-reduce:animate-none motion-reduce:opacity-90"
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
}
