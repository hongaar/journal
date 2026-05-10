import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import type {
  JournalInvitation,
  JournalMemberRole,
  Profile,
} from "@/types/database";
import { Button } from "@curolia/ui/button";
import { CautionPanel } from "@curolia/ui/caution-panel";
import { Input } from "@curolia/ui/input";
import { Label } from "@curolia/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@curolia/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@curolia/ui/dialog";
import {
  journalRoleLabel,
  type InviteJournalRole,
} from "@/lib/journal-member-roles";

type MemberRow = {
  user_id: string;
  role: JournalMemberRole;
  profile: Profile | null;
};

export function JournalSharingSection({
  journalId,
  journalName,
  isOwner,
}: {
  journalId: string;
  journalName: string;
  isOwner: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteJournalRole>("viewer");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteErr, setInviteErr] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTo, setTransferTo] = useState<string>("");
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferErr, setTransferErr] = useState<string | null>(null);

  const membersQuery = useQuery({
    queryKey: ["journal_members_detail", journalId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("journal_members")
        .select("user_id, role")
        .eq("journal_id", journalId);
      if (error) throw error;
      const ids = (rows ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [] as MemberRow[];
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("*")
        .in("id", ids);
      if (pErr) throw pErr;
      const byId = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));
      return (rows ?? []).map((r) => ({
        user_id: r.user_id,
        role: r.role as JournalMemberRole,
        profile: byId.get(r.user_id) ?? null,
      }));
    },
    enabled: Boolean(journalId),
  });

  const invitationsQuery = useQuery({
    queryKey: ["journal_invitations", journalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_invitations")
        .select("*")
        .eq("journal_id", journalId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as JournalInvitation[];
    },
    enabled: Boolean(journalId && isOwner),
  });

  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const pendingInvites = invitationsQuery.data ?? [];

  const transferCandidates = useMemo(
    () => members.filter((m) => m.role !== "owner" && m.user_id !== user?.id),
    [members, user?.id],
  );

  async function sendInvite() {
    if (!inviteEmail.trim()) return;
    setInviteBusy(true);
    setInviteErr(null);
    const { data, error } = await supabase.rpc("invite_journal_member", {
      p_journal_id: journalId,
      p_invitee_email: inviteEmail.trim(),
      p_invited_role: inviteRole,
    });
    setInviteBusy(false);
    if (error) {
      setInviteErr(error.message);
      return;
    }
    if (data) {
      void qc.invalidateQueries({
        queryKey: ["journal_invitations", journalId],
      });
      void qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
      void qc.invalidateQueries({
        queryKey: ["notifications_unread", user?.id],
      });
      setInviteEmail("");
    }
  }

  async function cancelInvite(id: string) {
    const { error } = await supabase.rpc("cancel_journal_invitation", {
      p_invitation_id: id,
    });
    if (error) {
      setInviteErr(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["journal_invitations", journalId] });
  }

  async function removeMember(uid: string) {
    const { error } = await supabase.rpc("remove_journal_member", {
      p_journal_id: journalId,
      p_user_id: uid,
    });
    if (error) {
      setInviteErr(error.message);
      return;
    }
    void qc.invalidateQueries({
      queryKey: ["journal_members_detail", journalId],
    });
  }

  async function changeRole(uid: string, role: JournalMemberRole) {
    if (role === "owner") return;
    const { error } = await supabase.rpc("update_journal_member_role", {
      p_journal_id: journalId,
      p_user_id: uid,
      p_role: role,
    });
    if (error) {
      setInviteErr(error.message);
      return;
    }
    void qc.invalidateQueries({
      queryKey: ["journal_members_detail", journalId],
    });
  }

  async function runTransfer() {
    if (!transferTo) return;
    setTransferBusy(true);
    setTransferErr(null);
    const { error } = await supabase.rpc("transfer_journal_ownership", {
      p_journal_id: journalId,
      p_new_owner_user_id: transferTo,
    });
    setTransferBusy(false);
    if (error) {
      setTransferErr(error.message);
      return;
    }
    setTransferOpen(false);
    setTransferTo("");
    void qc.invalidateQueries({
      queryKey: ["journal_members_detail", journalId],
    });
    void qc.invalidateQueries({
      queryKey: ["journal_member_role", journalId, user?.id],
    });
    void qc.invalidateQueries({ queryKey: ["journal_plugins", journalId] });
    void qc.invalidateQueries({
      queryKey: ["journal_ical_feed_token", journalId],
    });
    void qc.invalidateQueries({ queryKey: ["journals", user?.id] });
    void qc.invalidateQueries({ queryKey: ["notifications", transferTo] });
    void qc.invalidateQueries({
      queryKey: ["notifications_unread", transferTo],
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-foreground text-sm font-semibold tracking-tight">
          Sharing
        </h2>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          Invite others by email. They must sign in with that email to accept.
          Connectors stay with each owner; transferring ownership clears all
          plugins for this journal.
        </p>
      </div>

      {inviteErr ? (
        <p className="text-destructive text-sm">{inviteErr}</p>
      ) : null}

      <div className="space-y-3">
        <h3 className="text-foreground text-xs font-medium uppercase tracking-wide">
          Members
        </h3>
        <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
          {membersQuery.isLoading ? (
            <li className="text-muted-foreground px-3 py-2 text-sm">
              Loading…
            </li>
          ) : (
            members.map((m) => {
              const isSelf = m.user_id === user?.id;
              const label =
                m.profile?.display_name?.trim() || (isSelf ? "You" : "Member");
              return (
                <li
                  key={m.user_id}
                  className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm"
                >
                  <span className="min-w-0 flex-1 font-medium">
                    {label}
                    {isSelf && user?.email ? (
                      <span className="text-muted-foreground block truncate text-xs font-normal">
                        {user.email}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {journalRoleLabel(m.role)}
                  </span>
                  {isOwner && !isSelf && m.role !== "owner" ? (
                    <div className="flex shrink-0 flex-wrap items-center gap-1">
                      <Select
                        value={m.role}
                        onValueChange={(v) =>
                          void changeRole(m.user_id, v as JournalMemberRole)
                        }
                      >
                        <SelectTrigger className="h-8 w-[9.5rem] rounded-lg text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Reader</SelectItem>
                          <SelectItem value="editor">Contributor</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive h-8 rounded-lg text-xs"
                        onClick={() => void removeMember(m.user_id)}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </div>

      {isOwner ? (
        <>
          <div className="space-y-3">
            <h3 className="text-foreground text-xs font-medium uppercase tracking-wide">
              Invite by email
            </h3>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="inv-email">Email</Label>
                <Input
                  id="inv-email"
                  type="email"
                  autoComplete="email"
                  placeholder="friend@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="w-full space-y-2 sm:w-40">
                <Label>Access</Label>
                <Select
                  value={inviteRole}
                  onValueChange={(v) => setInviteRole(v as InviteJournalRole)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Reader</SelectItem>
                    <SelectItem value="editor">Contributor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                className="rounded-xl"
                disabled={inviteBusy || !inviteEmail.trim()}
                onClick={() => void sendInvite()}
              >
                Send invite
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              If they already have an account, they get an in-app notification.
              Pending invites work after they sign up with the same email.
            </p>
          </div>

          {pendingInvites.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-foreground text-xs font-medium uppercase tracking-wide">
                Pending invitations
              </h3>
              <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
                {pendingInvites.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {inv.invitee_email}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {journalRoleLabel(inv.invited_role)}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-lg text-xs"
                      onClick={() => void cancelInvite(inv.id)}
                    >
                      Cancel
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <CautionPanel
            title="Transfer ownership"
            description={
              <>
                Choose an existing member. You will become a contributor. All
                journal plugins and calendar feed links for &quot;{journalName}
                &quot; will be removed.
              </>
            }
          >
            <Button
              type="button"
              variant="secondary"
              className="rounded-xl"
              onClick={() => {
                setTransferErr(null);
                setTransferOpen(true);
              }}
            >
              Transfer ownership…
            </Button>
          </CautionPanel>

          <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
            <DialogContent className="border-[var(--panel-border)] bg-[var(--panel-bg)] backdrop-blur-xl">
              <DialogHeader>
                <DialogTitle className="font-display text-xl font-normal">
                  Transfer ownership
                </DialogTitle>
                <DialogDescription>
                  This cannot be undone from here. Connectors and iCal tokens
                  for this journal will be cleared.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <Label>New owner</Label>
                <Select
                  value={transferTo}
                  onValueChange={(v) => setTransferTo(v ?? "")}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Choose a member" />
                  </SelectTrigger>
                  <SelectContent>
                    {transferCandidates.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.profile?.display_name?.trim() || "Member"} (
                        {journalRoleLabel(m.role)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {transferErr ? (
                  <p className="text-destructive text-sm">{transferErr}</p>
                ) : null}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTransferOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={!transferTo || transferBusy}
                  onClick={() => void runTransfer()}
                >
                  Confirm transfer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <p className="text-muted-foreground text-xs">
          Only the journal owner can invite people or transfer ownership.
        </p>
      )}
    </div>
  );
}
