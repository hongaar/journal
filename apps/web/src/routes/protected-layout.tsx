import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/providers/auth-provider";
import { JournalProvider } from "@/providers/journal-provider";

export function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="text-muted-foreground flex min-h-svh items-center justify-center text-sm">
        Loading…
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
