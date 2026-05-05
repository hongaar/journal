import { useNavigate } from "react-router-dom";
import { NavigationSidebarContent } from "@/components/layout/navigation-sidebar-content";
import { useAuth } from "@/providers/auth-provider";
import { useNavigationShell } from "@/providers/navigation-shell-provider";

/** Scrollable rail body only (aside shell + animation live in AppShell). */
export function NavigationSidebarColumn() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { openNewJournalDialog } = useNavigationShell();

  return (
    <NavigationSidebarContent
      userId={user?.id}
      openNewJournalDialog={openNewJournalDialog}
      onOpenJournalSettings={(journalId) =>
        void navigate(`/journals/${journalId}/settings`)
      }
    />
  );
}
