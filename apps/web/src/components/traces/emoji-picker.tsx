import { buttonVariants } from "@/components/ui/button";
import {
  EmojiPickerContent,
  EmojiPickerFooter,
  EmojiPicker as EmojiPickerRoot,
  EmojiPickerSearch,
} from "@/components/ui/emoji-picker";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

type EmojiPickerProps = {
  id?: string;
  label: string;
  value: string;
  onChange: (emoji: string) => void;
  className?: string;
  disabled?: boolean;
};

/** Tag icon field: popover + Frimousse (liveblocks/frimousse), installed via shadcn registry emoji-picker block. */
export function EmojiPicker({ id, label, value, onChange, className, disabled = false }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const displayChar = value || "📍";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} className="block">
        {label}
      </Label>
      {/* Wrapper: open popover injects focus-guard siblings next to the trigger; keep them off the label-spacing flex axis */}
      <div className="min-w-0">
        <Popover open={disabled ? false : open} onOpenChange={(o) => !disabled && setOpen(o)}>
          <PopoverTrigger
            id={id}
            type="button"
            disabled={disabled}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-10 w-full justify-between gap-2 rounded-lg px-3 font-normal",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="text-xl leading-none" aria-hidden>
                {displayChar}
              </span>
              <span className="text-muted-foreground truncate text-xs">Choose emoji</span>
            </span>
            <ChevronDown className="text-muted-foreground size-4 shrink-0 opacity-70" aria-hidden />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={6}
            className="z-[100] w-[min(calc(100vw-2rem),17rem)] p-0"
          >
            <EmojiPickerRoot
              className="h-[min(360px,50vh)] w-full max-w-full rounded-md border-0 bg-transparent shadow-none"
              onEmojiSelect={(emoji) => {
                onChange(emoji.emoji);
                setOpen(false);
              }}
            >
              <EmojiPickerSearch />
              <EmojiPickerContent className="min-h-0 flex-1" />
              <EmojiPickerFooter />
            </EmojiPickerRoot>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
