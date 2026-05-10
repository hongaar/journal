import { cn } from "@/lib/utils";
import { Button } from "@curolia/ui/button";
import { Plus, X } from "lucide-react";

type AddTraceFabProps = {
  onClick: () => void;
  /** When true (e.g. map placement mode), button shows active styling. */
  active?: boolean;
  className?: string;
};

/** Map primary action — icon + label with stable sizing (no hover width animation). */
export function AddTraceFab({ onClick, active, className }: AddTraceFabProps) {
  const title = active ? "Stop adding traces" : "Add trace";

  return (
    <Button
      type="button"
      variant={active ? "secondary" : "default"}
      title={title}
      onClick={onClick}
      aria-pressed={active || undefined}
      className={cn(
        "h-14 shrink-0 gap-3 rounded-full px-6 text-sm font-semibold shadow-lg",
        active && "ring-2 ring-primary/35",
        className,
      )}
    >
      {active ? (
        <X className="size-7 shrink-0" strokeWidth={2.25} aria-hidden />
      ) : (
        <Plus className="size-7 shrink-0" strokeWidth={2.25} aria-hidden />
      )}
      <span>{active ? "Stop adding" : "Add trace"}</span>
    </Button>
  );
}
