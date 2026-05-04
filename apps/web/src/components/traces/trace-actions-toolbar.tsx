import type { SetStateAction } from "react";
import { ListFilter, Plus, Scan, Tag as TagIcon } from "lucide-react";
import {
  MapToolbarGroup,
  MapToolbarIconButton,
  MAP_TOOLBAR_ICON_CELL,
  MAP_TOOLBAR_LABEL_CELL,
  MAP_TOOLBAR_TRIGGER_CLASS,
} from "@/components/map/map-toolbar";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Tag } from "@/types/database";
import { cn } from "@/lib/utils";

type TraceActionsToolbarProps = {
  mode: "map" | "blog";
  placementActive?: boolean;
  onAddTrace: () => void;
  onNewTag: () => void;
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
  onFitVisible,
  tags,
  filterTagIds,
  setFilterTagIds,
}: TraceActionsToolbarProps) {
  const addLabel = mode === "map" ? (placementActive ? "Placing pin…" : "Add trace") : "Add trace";

  return (
    <MapToolbarGroup>
      <MapToolbarIconButton
        icon={<Plus className="size-4" />}
        label={addLabel}
        active={mode === "map" ? placementActive : false}
        onClick={onAddTrace}
      />
      <MapToolbarIconButton
        icon={<TagIcon className="size-4" />}
        label="New tag"
        onClick={onNewTag}
        className="bg-muted/20 hover:bg-muted/40"
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
            filterTagIds.size > 0 && "bg-primary/8 ring-1 ring-inset ring-primary/15",
          )}
        >
          <span className={cn(MAP_TOOLBAR_ICON_CELL, "relative")}>
            <ListFilter className="size-4" />
            {filterTagIds.size > 0 ? (
              <span className="bg-primary ring-background absolute top-1.5 right-1.5 size-1.5 rounded-full ring-2" />
            ) : null}
          </span>
          <span className={MAP_TOOLBAR_LABEL_CELL}>Filter</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" sideOffset={8} align="start" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Filter by tag</DropdownMenuLabel>
            {tags.length === 0 ? (
              <DropdownMenuItem disabled className="text-muted-foreground">
                No tags yet
              </DropdownMenuItem>
            ) : (
              tags.map((tag) => (
                <DropdownMenuCheckboxItem
                  key={tag.id}
                  checked={filterTagIds.has(tag.id)}
                  onCheckedChange={(c) => {
                    setFilterTagIds((prev) => {
                      const next = new Set(prev);
                      if (c === true) next.add(tag.id);
                      else next.delete(tag.id);
                      return next;
                    });
                  }}
                >
                  <span className="text-base">{tag.icon_emoji}</span>
                  {tag.name}
                </DropdownMenuCheckboxItem>
              ))
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
        </DropdownMenuContent>
      </DropdownMenu>
    </MapToolbarGroup>
  );
}
