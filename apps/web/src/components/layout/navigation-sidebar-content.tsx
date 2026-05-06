import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Check,
  ChevronDown,
  Map,
  Plus,
  Settings2,
} from "lucide-react";
import { Button, buttonVariants } from "@curolia/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@curolia/ui/dropdown-menu";
import { Separator } from "@curolia/ui/separator";
import { cn } from "@/lib/utils";
import { useJournal } from "@/providers/journal-provider";
import { useRegisteredTagSidebar } from "@/providers/tag-sidebar-provider";
import type { Journal } from "@/types/database";
import { defaultJournalIcon } from "@/lib/journal-display-icon";
import { NotificationsPopover } from "@/components/layout/notifications-popover";
import { DROPDOWN_PANEL_WIDE_CLASS } from "@/lib/dropdown-panel";
import { sidebarPickerTriggerClass } from "@/components/layout/sidebar-dropdown-triggers";
import { SidebarTagsFilterDropdown } from "@/components/layout/sidebar-tags-filter-dropdown";
import { journalSwitchHref, journalViewHref } from "@/lib/app-paths";

const navRowClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    buttonVariants({ variant: "ghost", size: "sm" }),
    "text-foreground hover:bg-foreground/[0.06] h-11 w-full justify-start gap-2 rounded-xl px-3 font-normal",
    isActive && "bg-foreground/10 font-medium",
  );

function journalEmoji(journal: Journal) {
  return journal.icon_emoji ?? defaultJournalIcon(journal.is_personal);
}

type NavigationSidebarContentProps = {
  userId: string | undefined;
  openNewJournalDialog: () => void;
  onOpenJournalSettings: (journalId: string) => void;
};

export function NavigationSidebarContent({
  userId,
  openNewJournalDialog,
  onOpenJournalSettings,
}: NavigationSidebarContentProps) {
  const tagSidebar = useRegisteredTagSidebar();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { journals, activeJournal, setActiveJournalId } = useJournal();
  const mapTo = activeJournal?.slug
    ? journalViewHref("map", activeJournal.slug)
    : "/";
  const blogTo = activeJournal?.slug
    ? journalViewHref("blog", activeJournal.slug)
    : "/";

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6 pt-[calc(var(--app-toolbar-h)+0.5rem)]">
      <div className="flex flex-col gap-1">
        <div className="text-muted-foreground px-3 pt-2 text-xs font-medium tracking-wide uppercase">
          View
        </div>
        <NavLink to={mapTo} className={navRowClass} end>
          <Map className="size-4 opacity-80" />
          Map
        </NavLink>
        <NavLink to={blogTo} className={navRowClass}>
          <BookOpen className="size-4 opacity-80" />
          Blog
        </NavLink>
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground px-3 text-xs font-medium tracking-wide uppercase">
          Journal
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger className={sidebarPickerTriggerClass()}>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              {activeJournal ? (
                <>
                  <span className="text-base leading-none shrink-0" aria-hidden>
                    {journalEmoji(activeJournal)}
                  </span>
                  <span className="truncate">{activeJournal.name}</span>
                </>
              ) : (
                <span className="truncate">Select journal</span>
              )}
            </span>
            <ChevronDown className="size-4 shrink-0 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={6}
            className={DROPDOWN_PANEL_WIDE_CLASS}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>Journals</DropdownMenuLabel>
              {journals.map((j) => {
                const selected = j.id === activeJournal?.id;
                return (
                  <div
                    key={j.id}
                    className="flex items-center gap-0.5 rounded-md"
                  >
                    <DropdownMenuItem
                      className="min-w-0 flex-1 gap-1.5 pr-2"
                      onClick={() => {
                        setActiveJournalId(j.id);
                        navigate(journalSwitchHref(j, pathname, search));
                      }}
                    >
                      <span
                        className="text-base shrink-0 leading-none"
                        aria-hidden
                      >
                        {journalEmoji(j)}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate",
                          selected && "font-medium",
                        )}
                      >
                        {j.name}
                        {j.is_personal ? (
                          <span className="text-muted-foreground ml-1 text-xs font-normal">
                            (personal)
                          </span>
                        ) : null}
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
                      title="Journal settings"
                      className="text-muted-foreground hover:text-foreground size-8 shrink-0 rounded-md"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onOpenJournalSettings(j.id);
                      }}
                    >
                      <Settings2 className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openNewJournalDialog()}>
              <Plus className="size-4" />
              New journal…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground px-3 text-xs font-medium tracking-wide uppercase">
          Tags & filters
        </span>
        {tagSidebar ? (
          <SidebarTagsFilterDropdown
            tags={tagSidebar.tags}
            filterTagIds={tagSidebar.filterTagIds}
            setFilterTagIds={tagSidebar.setFilterTagIds}
            onNewTag={tagSidebar.onNewTag}
            onEditTag={tagSidebar.onEditTag}
          />
        ) : (
          <p className="text-muted-foreground px-3 text-sm">
            Open Map or Blog to filter traces by tags.
          </p>
        )}
      </div>

      {userId ? (
        <>
          <Separator />
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground px-3 text-xs font-medium tracking-wide uppercase">
              Activity
            </span>
            <NotificationsPopover variant="sidebar-row" userId={userId} />
          </div>
        </>
      ) : null}
    </div>
  );
}
