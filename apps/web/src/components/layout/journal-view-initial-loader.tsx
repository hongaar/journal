import { FloatingPanel } from "@/components/layout/floating-panel";

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
  return (
    <div
      className="flex h-full items-center justify-center p-6"
      role={busy ? "status" : undefined}
      aria-busy={busy ? "true" : undefined}
      aria-live={busy ? "polite" : undefined}
    >
      <FloatingPanel className="max-w-sm text-center">
        <p className="text-muted-foreground text-sm">{label}</p>
      </FloatingPanel>
    </div>
  );
}
