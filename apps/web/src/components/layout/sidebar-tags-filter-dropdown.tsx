import type { SetStateAction } from "react";
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
import { cn } from "@/lib/utils";
import type { Tag } from "@/types/database";
import { DROPDOWN_PANEL_WIDE_CLASS } from "@/lib/dropdown-panel";
import { sidebarPickerTriggerClass } from "@/components/layout/sidebar-dropdown-triggers";
import {
  Check,
  ChevronDown,
  Plus,
  Settings2,
  Tag as TagIcon,
} from "lucide-react";

type SidebarTagsFilterDropdownProps = {
  tags: Tag[];
  filterTagIds: Set<string>;
  setFilterTagIds: (action: SetStateAction<Set<string>>) => void;
  onNewTag: () => void;
  onEditTag: (tag: Tag) => void;
};

/** Tags menu matching the legacy map toolbar dropdown. */
export function SidebarTagsFilterDropdown({
  tags,
  filterTagIds,
  setFilterTagIds,
  onNewTag,
  onEditTag,
}: SidebarTagsFilterDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={sidebarPickerTriggerClass(
          cn(
            filterTagIds.size > 0 &&
              "bg-primary/8 ring-primary/15 ring-1 ring-inset",
          ),
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="relative inline-flex shrink-0">
            <TagIcon className="size-4 opacity-80" />
            {filterTagIds.size > 0 ? (
              <span
                className="bg-primary ring-background absolute top-px right-px size-1.5 rounded-full ring-2"
                aria-hidden
              />
            ) : null}
          </span>
          <span className="truncate">Tags</span>
        </span>
        <ChevronDown className="size-4 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="start"
        sideOffset={6}
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
                    <span className="min-w-0 flex-1 truncate">{tag.name}</span>
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
  );
}
