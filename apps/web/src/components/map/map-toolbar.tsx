import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export const MAP_TOOLBAR_TRIGGER_CLASS =
  "group/tb inline-flex h-9 max-w-9 cursor-pointer items-center justify-start overflow-hidden border-0 bg-transparent p-0 text-left outline-none transition-[max-width] duration-200 ease-out hover:max-w-[min(13rem,calc(100vw-5rem))] focus-visible:max-w-[min(13rem,calc(100vw-5rem))] hover:bg-foreground/[0.06] focus-visible:bg-foreground/[0.06] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30";

export const MAP_TOOLBAR_ICON_CELL =
  "flex size-9 shrink-0 flex-col items-center justify-center leading-none [&_svg]:block";

export const MAP_TOOLBAR_LABEL_CELL =
  "flex min-h-9 min-w-0 flex-1 items-center self-center py-0 pr-2 text-sm font-medium text-foreground";

type MapToolbarIconButtonProps = {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  title?: string;
  className?: string;
};

/** Icon-sized by default; width grows on hover/focus to show label (MapLibre control style). */
export function MapToolbarIconButton({
  icon,
  label,
  active,
  onClick,
  title,
  className,
}: MapToolbarIconButtonProps) {
  return (
    <button
      type="button"
      title={title ?? label}
      onClick={onClick}
      className={cn(
        MAP_TOOLBAR_TRIGGER_CLASS,
        active &&
          "bg-primary/10 ring-1 ring-inset ring-primary/20 hover:bg-primary/12",
        className,
      )}
    >
      <span className={MAP_TOOLBAR_ICON_CELL}>{icon}</span>
      <span className={MAP_TOOLBAR_LABEL_CELL}>{label}</span>
    </button>
  );
}

type MapToolbarGroupProps = {
  children: ReactNode;
  className?: string;
};

/** Vertical control group similar to `maplibregl-ctrl-group`. */
export function MapToolbarGroup({ children, className }: MapToolbarGroupProps) {
  return (
    <div
      className={cn(
        "pointer-events-auto box-content flex w-9 flex-col divide-y divide-foreground/10 overflow-visible rounded-md border border-foreground/15 bg-[var(--panel-bg)] shadow-md ring-1 ring-black/[0.04] dark:ring-white/10",
        className,
      )}
    >
      {children}
    </div>
  );
}
