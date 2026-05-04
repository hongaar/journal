import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { useJournal } from "@/providers/journal-provider";
import { FloatingPanel } from "@/components/layout/floating-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function JournalSettingsPage() {
  const { journalId } = useParams<{ journalId: string }>();
  const { user } = useAuth();
  const { journals, activeJournalId, setActiveJournalId } = useJournal();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const journal = useMemo(() => journals.find((j) => j.id === journalId) ?? null, [journals, journalId]);

  const roleQuery = useQuery({
    queryKey: ["journal_member_role", journalId, user?.id],
    queryFn: async () => {
      if (!journalId || !user) return null;
      const { data, error: err } = await supabase
        .from("journal_members")
        .select("role")
        .eq("journal_id", journalId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (err) throw err;
      return data?.role ?? null;
    },
    enabled: Boolean(journalId && user),
  });

  const isOwner = roleQuery.data === "owner";

  useEffect(() => {
    if (!journal) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset field when switching journal
    setName(journal.name);
  }, [journal]);

  async function save() {
    if (!journalId || !name.trim()) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from("journals")
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq("id", journalId);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (user) await qc.invalidateQueries({ queryKey: ["journals", user.id] });
  }

  if (!journalId) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <FloatingPanel className="text-muted-foreground text-sm">Missing journal.</FloatingPanel>
      </div>
    );
  }

  if (!journal) {
    return (
      <div className="h-full overflow-y-auto px-3 pt-[4.75rem] pb-10 sm:px-6 sm:pt-[5.25rem]">
        <div className="mx-auto max-w-lg">
          <FloatingPanel className="p-6">
            <p className="text-muted-foreground text-sm">You do not have access to this journal or it does not exist.</p>
            <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4 inline-flex rounded-xl")} to="/">
              Back to map
            </Link>
          </FloatingPanel>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-3 pt-[4.75rem] pb-10 sm:px-6 sm:pt-[5.25rem]">
      <div className="mx-auto max-w-lg">
        <FloatingPanel className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-foreground text-2xl font-semibold tracking-tight">Journal settings</h1>
              <p className="text-muted-foreground mt-1 text-sm">More options will land here later.</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate(-1)}>
              Back
            </Button>
          </div>

          <div className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="jn-name">Journal name</Label>
              <Input
                id="jn-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isOwner || roleQuery.isLoading}
              />
              {!isOwner && !roleQuery.isLoading ? (
                <p className="text-muted-foreground text-xs">Only owners can rename a journal.</p>
              ) : null}
            </div>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button
                className="rounded-xl"
                disabled={saving || !isOwner || !name.trim() || name.trim() === journal.name}
                onClick={() => void save()}
              >
                Save
              </Button>
              {activeJournalId !== journalId ? (
                <Button
                  variant="secondary"
                  className="rounded-xl"
                  type="button"
                  onClick={() => {
                    setActiveJournalId(journalId);
                    navigate("/");
                  }}
                >
                  Switch to this journal
                </Button>
              ) : null}
            </div>
          </div>
        </FloatingPanel>
      </div>
    </div>
  );
}
