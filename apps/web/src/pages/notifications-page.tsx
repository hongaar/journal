import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { FloatingPanel } from "@/components/layout/floating-panel";
import { PageBackButton } from "@/components/layout/page-back-button";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types/database";

export function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const listQuery = useQuery({
    queryKey: ["notifications", user?.id, "all"],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as AppNotification[];
    },
    enabled: Boolean(user),
  });

  async function openOne(n: AppNotification) {
    if (!user) return;
    if (!n.read_at) {
      await supabase.rpc("mark_notification_read", { p_notification_id: n.id });
      void qc.invalidateQueries({ queryKey: ["notifications", user.id] });
      void qc.invalidateQueries({ queryKey: ["notifications", user.id, "all"] });
      void qc.invalidateQueries({ queryKey: ["notifications_unread", user.id] });
    }
    if (n.action_path) {
      navigate(n.action_path);
    }
  }

  const items = listQuery.data ?? [];

  return (
    <div className="h-full overflow-y-auto px-3 pt-[4.75rem] pb-10 sm:px-6 sm:pt-[5.25rem]">
      <div className="mx-auto max-w-lg space-y-4">
        <PageBackButton />
        <FloatingPanel className="p-5 sm:p-6">
          <h1 className="font-display text-foreground text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-1 text-sm">Opens are marked as read. Email and push use your settings.</p>

          <ul className="mt-6 divide-y divide-border/60 rounded-xl border border-border/60">
            {listQuery.isLoading ? (
              <li className="text-muted-foreground px-3 py-4 text-sm">Loading…</li>
            ) : items.length === 0 ? (
              <li className="text-muted-foreground px-3 py-4 text-sm">Nothing here yet.</li>
            ) : (
              items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={cn(
                      "hover:bg-foreground/5 flex w-full gap-3 px-3 py-3 text-left text-sm transition-colors",
                      !n.read_at && "bg-primary/5",
                    )}
                    onClick={() => void openOne(n)}
                  >
                    {!n.read_at ? (
                      <span className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full" aria-hidden />
                    ) : (
                      <span className="size-1.5 shrink-0" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{n.title}</span>
                      {n.body ? (
                        <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">{n.body}</span>
                      ) : null}
                      <span className="text-muted-foreground mt-1 block text-[10px] opacity-80">
                        {new Date(n.created_at).toLocaleString()}
                      </span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </FloatingPanel>
      </div>
    </div>
  );
}
