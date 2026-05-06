import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { journalViewHref } from "@/lib/app-paths";
import { useAuth } from "@/providers/auth-provider";
import { useJournal } from "@/providers/journal-provider";
import { FloatingPanel } from "@/components/layout/floating-panel";
import { PageBackButton } from "@/components/layout/page-back-button";
import { Button } from "@curolia/ui/button";

export function InvitationsPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const { user } = useAuth();
  const { activeJournal } = useJournal();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!token || !user) return;
    let cancelled = false;
    void (async () => {
      await supabase.rpc("mark_notification_read_by_token", {
        p_invitation_token: token,
      });
      if (!cancelled) {
        void qc.invalidateQueries({ queryKey: ["notifications", user.id] });
        void qc.invalidateQueries({
          queryKey: ["notifications_unread", user.id],
        });
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user, qc]);

  async function accept() {
    if (!token) return;
    setBusy("accept");
    setError(null);
    const { data: journalId, error: err } = await supabase.rpc(
      "accept_journal_invitation",
      {
        p_token: token,
      },
    );
    setBusy(null);
    if (err) {
      setError(err.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["journals", user?.id] });
    void qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
    void qc.invalidateQueries({ queryKey: ["notifications_unread", user?.id] });
    if (journalId && typeof journalId === "string") {
      void qc.invalidateQueries({
        queryKey: ["journal_members_detail", journalId],
      });
      void qc.invalidateQueries({
        queryKey: ["journal_invitations", journalId],
      });
      navigate(`/journals/${journalId}/settings`, { replace: true });
    } else {
      const slug = activeJournal?.slug?.trim();
      navigate(slug ? journalViewHref("map", slug) : "/", { replace: true });
    }
  }

  async function decline() {
    if (!token) return;
    setBusy("decline");
    setError(null);
    const { error: err } = await supabase.rpc("decline_journal_invitation", {
      p_token: token,
    });
    setBusy(null);
    if (err) {
      setError(err.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
    void qc.invalidateQueries({ queryKey: ["notifications_unread", user?.id] });
    navigate("/notifications", { replace: true });
  }

  if (!token) {
    return (
      <div className="h-full overflow-y-auto px-3 pt-[4.75rem] pb-10 sm:px-6 sm:pt-[5.25rem]">
        <div className="mx-auto max-w-lg space-y-4">
          <PageBackButton />
          <FloatingPanel className="p-6">
            <p className="text-muted-foreground text-sm">
              Missing invitation link. Open the link from your email or
              notification.
            </p>
          </FloatingPanel>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-3 pt-[4.75rem] pb-10 sm:px-6 sm:pt-[5.25rem]">
      <div className="mx-auto max-w-lg space-y-4">
        <PageBackButton />
        <FloatingPanel className="p-6">
          <h1 className="font-display text-foreground text-2xl font-normal tracking-tight">
            Curolia journal invitation
          </h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            {ready
              ? "You can accept to join this journal or decline."
              : "Loading…"}
          </p>
          {error ? (
            <p className="text-destructive mt-3 text-sm">{error}</p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              className="rounded-xl"
              disabled={!ready || busy !== null}
              onClick={() => void accept()}
            >
              {busy === "accept" ? "Accepting…" : "Accept"}
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={!ready || busy !== null}
              onClick={() => void decline()}
            >
              {busy === "decline" ? "Declining…" : "Decline"}
            </Button>
          </div>
        </FloatingPanel>
      </div>
    </div>
  );
}
