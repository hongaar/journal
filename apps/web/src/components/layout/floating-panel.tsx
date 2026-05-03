import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function FloatingPanel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 text-[var(--panel-fg)] shadow-[var(--panel-shadow)] backdrop-blur-xl backdrop-saturate-150",
        className,
      )}
      {...props}
    />
  );
}
