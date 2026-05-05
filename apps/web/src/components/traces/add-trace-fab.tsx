import { Plus } from "lucide-react";
import { Button } from "@curolia/ui/button";
import { cn } from "@/lib/utils";

type AddTraceFabProps = {
  onClick: () => void;
  /** When true (e.g. map placement mode), button shows active styling. */
  active?: boolean;
  className?: string;
};

/** Large + FAB; expands on hover to reveal the label. */
export function AddTraceFab({
  onClick,
  active,
  className,
}: AddTraceFabProps) {
  return (
    <Button
      type="button"
      size="lg"
      variant={active ? "secondary" : "default"}
      title="Add trace"
      onClick={onClick}
      className={cn(
        "group pointer-events-auto flex h-14 max-w-[min(calc(100vw-3rem),16rem)] items-center gap-0 overflow-hidden rounded-full px-0 shadow-lg transition-[gap,padding,width] duration-200 ease-out sm:gap-0",
        "w-14 justify-center hover:w-max hover:max-w-[min(calc(100vw-3rem),16rem)] hover:justify-start hover:gap-3 hover:px-5 focus-visible:w-max focus-visible:justify-start focus-visible:gap-3 focus-visible:px-5",
        active && "ring-2 ring-primary/35",
        className,
      )}
    >
      <Plus className="size-7 shrink-0" strokeWidth={2.25} />
      <span
        className="inline-flex max-w-0 overflow-hidden opacity-0 transition-[max-width,opacity] duration-200 ease-out group-hover:max-w-[140px] group-hover:opacity-100 group-focus-visible:max-w-[140px] group-focus-visible:opacity-100"
        aria-hidden
      >
        <span className="inline-block whitespace-nowrap text-sm font-semibold">
          Add trace
        </span>
      </span>
      <span className="sr-only">Add trace</span>
    </Button>
  );
}
