import { buttonVariants } from "@curolia/ui/button";
import { cn } from "@/lib/utils";

/** Full-width bordered row opener for sidebar pickers (journal / tags / notifications). */
export function sidebarPickerTriggerClass(extra?: string) {
  return cn(
    buttonVariants({ variant: "ghost", size: "sm" }),
    "border-border/60 hover:bg-foreground/[0.06] h-11 w-full justify-between gap-2 rounded-xl border px-3 font-normal",
    extra,
  );
}
