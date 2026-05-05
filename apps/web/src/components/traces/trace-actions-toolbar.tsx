import type { SetStateAction } from "react";
import { Check, Plus, Scan, Settings2, Tag as TagIcon } from "lucide-react";
import {
  MapToolbarGroup,
  MapToolbarIconButton,
  MAP_TOOLBAR_ICON_CELL,
  MAP_TOOLBAR_LABEL_CELL,
  MAP_TOOLBAR_TRIGGER_CLASS,
} from "@/components/map/map-toolbar";
import { Button } from "@curolia/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@curolia/ui/dropdown-menu";
import type { Tag } from "@/types/database";
import { DROPDOWN_PANEL_WIDE_CLASS } from "@/lib/dropdown-panel";
import { cn } from "@/lib/utils";

type TraceActionsToolbarProps = {
  mode: "map" | "blog";
  placementActive?: boolean;
  onAddTrace: () => void;
  onNewTag: () => void;
  onEditTag: (tag: Tag) => void;
  /** Map only: fit camera to all traces matching the current tag filter. */
  onFitVisible?: () => void;
  tags: Tag[];
  filterTagIds: Set<string>;
  setFilterTagIds: (action: SetStateAction<Set<string>>) => void;
};

export function TraceActionsToolbar({
  mode,
  placementActive = false,
  onAddTrace,
  onNewTag,
  onEditTag,
  onFitVisible,
  tags,
  filterTagIds,
  setFilterTagIds,
}: TraceActionsToolbarProps) {
  const addLabel =
    mode === "map"
      ? placementActive
        ? "Placing pin…"
        : "Add trace"
      : "Add trace";

  return (
    <MapToolbarGroup>
      <MapToolbarIconButton
        icon={<Plus className="size-4" />}
        label={addLabel}
        active={mode === "map" ? placementActive : false}
        onClick={onAddTrace}
      />
      {mode === "map" && onFitVisible ? (
        <MapToolbarIconButton
          icon={<Scan className="size-4" />}
          label="Fit traces"
          title="Fit map to visible traces"
          onClick={onFitVisible}
        />
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            MAP_TOOLBAR_TRIGGER_CLASS,
            filterTagIds.size > 0 &&
              "bg-primary/8 ring-1 ring-inset ring-primary/15",
          )}
        >
          <span className={cn(MAP_TOOLBAR_ICON_CELL, "relative")}>
            <TagIcon className="size-4" />
            {filterTagIds.size > 0 ? (
              <span className="bg-primary ring-background absolute top-1.5 right-1.5 size-1.5 rounded-full ring-2" />
            ) : null}
          </span>
          <span className={MAP_TOOLBAR_LABEL_CELL}>Tags</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="right"
          sideOffset={8}
          align="start"
          className={DROPDOWN_PANEL_WIDE_CLASS}
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel>Tags</DropdownMenuLabel>
            {tags.length === 0 ? (
              <DropdownMenuItem disabled className="text-muted-foreground">
                No tags yet
              </DropdownMenuItem>
            ) : (
              tags.map((tag) => {
                const selected = filterTagIds.has(tag.id);
                return (
                  <div
                    key={tag.id}
                    className="flex items-center gap-0.5 rounded-md"
                  >
                    <DropdownMenuItem
                      closeOnClick={false}
                      className="min-w-0 flex-1 gap-1.5 pr-2"
                      onClick={() => {
                        setFilterTagIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(tag.id)) next.delete(tag.id);
                          else next.add(tag.id);
                          return next;
                        });
                      }}
                    >
                      <span className="text-base shrink-0" aria-hidden>
                        {tag.icon_emoji}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {tag.name}
                      </span>
                      {selected ? (
                        <Check
                          className="text-foreground ml-auto size-4 shrink-0"
                          aria-hidden
                        />
                      ) : (
                        <span className="ml-auto size-4 shrink-0" aria-hidden />
                      )}
                    </DropdownMenuItem>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title="Tag settings"
                      className="text-muted-foreground hover:text-foreground size-8 shrink-0 rounded-md"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onEditTag(tag);
                      }}
                    >
                      <Settings2 className="size-4" />
                    </Button>
                  </div>
                );
              })
            )}
          </DropdownMenuGroup>
          {filterTagIds.size > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setFilterTagIds(new Set());
                }}
              >
                Clear filters
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onNewTag()}>
            <Plus className="size-4" />
            New tag…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </MapToolbarGroup>
  );
}
