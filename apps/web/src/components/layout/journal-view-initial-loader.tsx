import { FloatingPanel } from "@/components/layout/floating-panel";
import { CuroliaLoadingSplash } from "@/components/layout/curolia-loading-splash";

type JournalViewInitialLoaderProps = {
  /** Displayed message (default: loading copy). */
  label?: string;
  /** When true, shown as a busy region (omit for static empty states). */
  busy?: boolean;
};

export function JournalViewInitialLoader({
  label = "Loading…",
  busy = true,
}: JournalViewInitialLoaderProps) {
  if (busy) {
    return (
      <CuroliaLoadingSplash
        className="h-full min-h-[12rem]"
        statusLabel={label.endsWith("…") ? `${label.slice(0, -1)}` : label}
      />
    );
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      <FloatingPanel className="max-w-sm text-center">
        <p className="text-muted-foreground text-sm">{label}</p>
      </FloatingPanel>
    </div>
  );
}
