import { useQuery } from "@tanstack/react-query";
import { Menu } from "lucide-react";
import { Button } from "@curolia/ui/button";
import { FloatingPanel } from "@/components/layout/floating-panel";
import { GlobalSearch } from "@/components/layout/global-search";
import { useAuth } from "@/providers/auth-provider";
import { useNavigationShell } from "@/providers/navigation-shell-provider";
import { supabase } from "@/lib/supabase";

/**
 * Single floating main toolbar — always overlays the viewport (not mounted in the sidebar rail).
 */
export function MainToolbarPanel() {
  const { sidebarOpen, setSidebarOpen } = useNavigationShell();
  const { user } = useAuth();

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
  });

  return (
    <FloatingPanel className="pointer-events-auto flex min-h-[3.25rem] w-full max-w-[var(--nav-toolbar-w)] min-w-0 flex-1 items-center gap-1.5 py-2 pr-3 pl-2 shadow-lg sm:flex-initial sm:gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={
          unreadNotificationsQuery.data
            ? "Toggle menu — unread notifications"
            : "Toggle menu"
        }
        aria-expanded={sidebarOpen}
        aria-controls="curolia-navigation-sidebar"
        id="curolia-navigation-menu-trigger"
        className="relative size-9 shrink-0 rounded-xl"
        onClick={() => setSidebarOpen((o) => !o)}
      >
        <Menu className="size-5" />
        {unreadNotificationsQuery.data === true ? (
          <span
            className="bg-primary ring-background absolute top-2 right-2 size-2 rounded-full ring-2"
            aria-hidden
          />
        ) : null}
      </Button>

      <span className="font-display text-foreground hidden shrink-0 text-lg font-normal tracking-tight sm:inline sm:text-xl">
        Curolia
      </span>

      <div className="min-w-0 flex-1 md:self-stretch">
        <GlobalSearch toolbarEmbed />
      </div>
    </FloatingPanel>
  );
}
