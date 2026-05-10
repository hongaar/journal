import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/providers/auth-provider";
import { JournalProvider } from "@/providers/journal-provider";
import { CuroliaLoadingSplash } from "@/components/layout/curolia-loading-splash";

export function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <CuroliaLoadingSplash className="min-h-svh" statusLabel="Loading" />;
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
