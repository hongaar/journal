import { ChevronDown } from "lucide-react";
import { buttonVariants } from "@curolia/ui/button";
import { Label } from "@curolia/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@curolia/ui/popover";
import { cn } from "@/lib/utils";
import { PRESET_TRACE_TAG_COLOR_GRID } from "@/lib/preset-trace-tag-colors";

type PresetColorPickerProps = {
  id?: string;
  label: string;
  value: string;
  onChange: (hex: string) => void;
  className?: string;
};

export function PresetColorPicker({ id, label, value, onChange, className }: PresetColorPickerProps) {
  const normalized = value.toLowerCase();

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label ? (
        <Label htmlFor={id} className="block">
          {label}
        </Label>
      ) : null}
      <div className="min-w-0">
        <Popover>
          <PopoverTrigger
            id={id}
            type="button"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-10 w-full justify-between gap-2 rounded-lg px-3 font-normal",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="ring-border size-6 shrink-0 rounded-md ring-1 ring-inset"
                style={{ backgroundColor: value }}
                aria-hidden
              />
              <span className="text-muted-foreground truncate text-xs tabular-nums">{normalized}</span>
            </span>
            <ChevronDown className="text-muted-foreground size-4 shrink-0 opacity-70" aria-hidden />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={6}
            className="w-[min(calc(100vw-2rem),18rem)] gap-2 p-3"
          >
            <p className="text-muted-foreground text-xs font-medium">Preset colors</p>
            <div className="grid grid-cols-8 gap-1.5" role="listbox" aria-label="Color presets">
              {PRESET_TRACE_TAG_COLOR_GRID.map((row, ri) =>
                row.map((hex, ci) => {
                  const selected = hex.toLowerCase() === normalized;
                  return (
                    <button
                      key={`${ri}-${ci}`}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={cn(
                        "ring-border size-7 shrink-0 rounded-md ring-1 transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        selected && "ring-2 ring-foreground ring-offset-2 ring-offset-popover",
                      )}
                      style={{ backgroundColor: hex }}
                      title={hex}
                      onClick={() => onChange(hex)}
                    />
                  );
                }),
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
