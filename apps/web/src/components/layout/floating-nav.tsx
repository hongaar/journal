import { NavLink } from "react-router-dom";
import { ChevronDown, Map, Plug, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FloatingPanel } from "@/components/layout/floating-panel";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    buttonVariants({ variant: "ghost", size: "sm" }),
    "h-9 gap-1.5 rounded-xl px-3 font-medium",
    isActive && "bg-foreground/10 text-foreground",
  );

export function FloatingNav() {
  const { signOut } = useAuth();
  const { journals, activeJournal, setActiveJournalId, createJournal } = useJournal();
  const [newJournalOpen, setNewJournalOpen] = useState(false);
  const [newJournalName, setNewJournalName] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreateJournal() {
    if (!newJournalName.trim()) return;
    setCreating(true);
    const { error } = await createJournal(newJournalName.trim());
    setCreating(false);
    if (!error) {
      setNewJournalName("");
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
            Journal
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "h-9 max-w-[12rem] shrink gap-1 rounded-xl px-2 font-normal sm:max-w-[16rem]",
              )}
            >
              <span className="truncate">{activeJournal?.name ?? "Select journal"}</span>
              <ChevronDown className="size-4 shrink-0 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Journals</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {journals.map((j) => (
                  <DropdownMenuItem
                    key={j.id}
                    onClick={() => setActiveJournalId(j.id)}
                    className={cn(j.id === activeJournal?.id && "bg-accent")}
                  >
                    {j.name}
                    {j.is_personal ? (
                      <span className="text-muted-foreground ml-1 text-xs">(personal)</span>
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setNewJournalOpen(true)}>
                <Plus className="size-4" />
                New journal…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </FloatingPanel>

        <FloatingPanel className="pointer-events-auto flex flex-wrap items-center gap-1 py-1.5 pr-1.5 pl-2 shadow-lg">
          <NavLink to="/" className={navLinkClass} end title="Map">
            <Map className="size-4 opacity-80" />
            <span className="hidden sm:inline">Map</span>
          </NavLink>
          <NavLink to="/settings/connectors" className={navLinkClass} title="Connectors">
            <Plug className="size-4 opacity-80" />
            <span className="hidden sm:inline">Connectors</span>
          </NavLink>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 rounded-xl px-3 text-muted-foreground hover:text-foreground"
            onClick={() => void signOut()}
          >
            Sign out
          </Button>
        </FloatingPanel>
      </header>

      <Dialog open={newJournalOpen} onOpenChange={setNewJournalOpen}>
        <DialogContent className="border-[var(--panel-border)] bg-[var(--panel-bg)] backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-semibold">New journal</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="jn">Name</Label>
            <Input
              id="jn"
              value={newJournalName}
              onChange={(e) => setNewJournalName(e.target.value)}
              placeholder="Family trips"
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
