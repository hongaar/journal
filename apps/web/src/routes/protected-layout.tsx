import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/providers/auth-provider";
import { JournalProvider } from "@/providers/journal-provider";
import { FloatingPanel } from "@/components/layout/floating-panel";

export function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-6">
        <FloatingPanel className="text-muted-foreground text-sm">
          Loading…
        </FloatingPanel>
      </div>
    );
  }

  if (!user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return (
    <JournalProvider>
      <Outlet />
    </JournalProvider>
  );
}
