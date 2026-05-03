import { NavLink, Outlet } from "react-router-dom";
import { Map, Plug, Plus } from "lucide-react";
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

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(buttonVariants({ variant: isActive ? "secondary" : "ghost", size: "sm" }));

export function AppShell() {
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
    <div className="flex min-h-svh flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <span className="font-semibold tracking-tight">Journal</span>
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "min-w-40 justify-between",
            )}
          >
            {activeJournal?.name ?? "Select journal"}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Journals</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {journals.map((j) => (
                <DropdownMenuItem
                  key={j.id}
                  onClick={() => setActiveJournalId(j.id)}
                  className={cn(j.id === activeJournal?.id && "bg-muted")}
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

        <Dialog open={newJournalOpen} onOpenChange={setNewJournalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New journal</DialogTitle>
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

        <nav className="ml-auto flex items-center gap-1">
          <NavLink to="/" className={navClass} end>
            <Map className="size-4" />
            Map
          </NavLink>
          <NavLink to="/settings/connectors" className={navClass}>
            <Plug className="size-4" />
            Connectors
          </NavLink>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
