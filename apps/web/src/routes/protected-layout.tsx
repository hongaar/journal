import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/providers/auth-provider";
import { JournalProvider } from "@/providers/journal-provider";
import { FloatingPanel } from "@/components/layout/floating-panel";

export function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-6">
        <FloatingPanel className="text-muted-foreground text-sm">Loading…</FloatingPanel>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <JournalProvider>
      <Outlet />
    </JournalProvider>
  );
}
