import { useQuery } from "@tanstack/react-query";
import { NavLink, useNavigate } from "react-router-dom";
import { Bell, BookOpen, Check, ChevronDown, Map, Plug, Plus, Settings2, User } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useJournal } from "@/providers/journal-provider";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@curolia/ui/dialog";
import { Input } from "@curolia/ui/input";
import { Label } from "@curolia/ui/label";
import { FloatingPanel } from "@/components/layout/floating-panel";
import { GlobalSearch } from "@/components/layout/global-search";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/database";
import { UserAvatar } from "@/components/user-avatar";
import { NotificationsPopover } from "@/components/layout/notifications-popover";
import { DROPDOWN_PANEL_WIDE_CLASS } from "@/lib/dropdown-panel";
import type { Journal } from "@/types/database";
import { defaultJournalIcon } from "@/lib/journal-display-icon";
import { EmojiPicker } from "@/components/traces/emoji-picker";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    buttonVariants({ variant: "ghost", size: "sm" }),
    "h-9 gap-1.5 rounded-xl px-3 font-medium",
    isActive && "bg-foreground/10 text-foreground",
  );

function journalEmoji(journal: Journal) {
  return journal.icon_emoji ?? defaultJournalIcon(journal.is_personal);
}

export function FloatingNav() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { journals, activeJournal, setActiveJournalId, createJournal } = useJournal();
  const [newJournalOpen, setNewJournalOpen] = useState(false);
  const [newJournalName, setNewJournalName] = useState("");
  const [newJournalIcon, setNewJournalIcon] = useState(() => defaultJournalIcon(false));
  const [creating, setCreating] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
    enabled: Boolean(user),
  });

  const unreadNotificationsQuery = useQuery({
    queryKey: ["notifications_unread", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", user.id)
        .is("read_at", null)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data != null;
    },
    enabled: Boolean(user),
    refetchInterval: 60_000,
  });

  async function handleCreateJournal() {
    if (!newJournalName.trim()) return;
    setCreating(true);
    const { error } = await createJournal(newJournalName.trim(), newJournalIcon);
    setCreating(false);
    if (!error) {
      setNewJournalOpen(false);
    }
  }

  return (
    <>
      <header
        className={cn(
          "pointer-events-none absolute top-0 right-0 left-0 z-50 flex flex-wrap items-start justify-center gap-3 p-3 sm:justify-between sm:p-4",
        )}
      >
        <FloatingPanel className="pointer-events-auto flex min-w-0 max-w-full flex-wrap items-center gap-2 py-2 pr-3 pl-4 shadow-lg sm:gap-3">
          <span className="font-display text-foreground shrink-0 text-lg font-semibold tracking-tight italic">
            Curolia
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "h-9 max-w-[12rem] shrink gap-1.5 rounded-xl px-2 font-normal sm:max-w-[16rem]",
              )}
            >
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
              <ChevronDown className="size-4 shrink-0 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className={DROPDOWN_PANEL_WIDE_CLASS}>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Journals</DropdownMenuLabel>
                {journals.map((j) => {
                  const selected = j.id === activeJournal?.id;
                  return (
                    <div key={j.id} className="flex items-center gap-0.5 rounded-md">
                      <DropdownMenuItem
                        className="min-w-0 flex-1 gap-1.5 pr-2"
                        onClick={() => setActiveJournalId(j.id)}
                      >
                        <span className="text-base shrink-0 leading-none" aria-hidden>
                          {journalEmoji(j)}
                        </span>
                        <span className={cn("min-w-0 flex-1 truncate", selected && "font-medium")}>
                          {j.name}
                          {j.is_personal ? (
                            <span className="text-muted-foreground ml-1 text-xs font-normal">(personal)</span>
                          ) : null}
                        </span>
                        {selected ? (
                          <Check className="text-foreground ml-auto size-4 shrink-0" aria-hidden />
                        ) : (
                          <span className="ml-auto size-4 shrink-0" aria-hidden />
                        )}
                      </DropdownMenuItem>
                      <button
                        type="button"
                        title="Journal settings"
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "icon" }),
                          "text-muted-foreground hover:text-foreground size-8 shrink-0 rounded-md",
                        )}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(`/journals/${j.id}/settings`);
                        }}
                      >
                        <Settings2 className="size-4" />
                      </button>
                    </div>
                  );
                })}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setNewJournalOpen(true)}>
                <Plus className="size-4" />
                New journal…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <GlobalSearch />
        </FloatingPanel>

        <FloatingPanel className="pointer-events-auto flex flex-wrap items-center gap-1 py-1.5 pr-1.5 pl-2 shadow-lg">
          <NavLink to="/" className={navLinkClass} end title="Map">
            <Map className="size-4 opacity-80" />
            <span className="hidden sm:inline">Map</span>
          </NavLink>
          <NavLink to="/blog" className={navLinkClass} title="Blog">
            <BookOpen className="size-4 opacity-80" />
            <span className="hidden sm:inline">Blog</span>
          </NavLink>

          {user ? <NotificationsPopover userId={user.id} /> : null}

          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "size-9 shrink-0 rounded-xl",
              )}
              title="Account"
              aria-label="Account menu"
            >
              <UserAvatar
                storedAvatarUrl={profileQuery.data?.avatar_url}
                email={user?.email}
                gravatarSize={128}
                className="flex items-center justify-center"
                imgClassName="size-8"
                showUnreadDot={unreadNotificationsQuery.data === true}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal">
                  <span className="text-muted-foreground text-xs">Signed in</span>
                  <span className="block truncate text-sm font-medium">{user?.email ?? "—"}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <User className="size-4 opacity-80" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/notifications")}>
                  <Bell className="size-4 opacity-80" />
                  Notifications
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <Settings2 className="size-4 opacity-80" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings/plugins")}>
                  <Plug className="size-4 opacity-80" />
                  Plugins
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => void signOut()}>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </FloatingPanel>
      </header>

      <Dialog
        open={newJournalOpen}
        onOpenChange={(open) => {
          setNewJournalOpen(open);
          if (!open) {
            setNewJournalName("");
            setNewJournalIcon(defaultJournalIcon(false));
          }
        }}
      >
        <DialogContent className="border-[var(--panel-border)] bg-[var(--panel-bg)] backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-semibold">New journal</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="jn">Name</Label>
              <Input
                id="jn"
                value={newJournalName}
                onChange={(e) => setNewJournalName(e.target.value)}
                placeholder="Family trips"
              />
            </div>
            <EmojiPicker
              id="jn-icon"
              label="Icon"
              value={newJournalIcon}
              onChange={setNewJournalIcon}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewJournalOpen(false)}>
              Cancel
            </Button>
            <Button disabled={creating} onClick={() => void handleCreateJournal()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
