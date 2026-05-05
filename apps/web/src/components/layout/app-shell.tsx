import { Outlet } from "react-router-dom";
import { FloatingNav } from "@/components/layout/floating-nav";
import { NotificationsRealtimeSync } from "@/components/layout/notifications-realtime-sync";
import { useAuth } from "@/providers/auth-provider";

export function AppShell() {
  const { user } = useAuth();
  return (
    <div className="relative h-svh w-full overflow-hidden bg-background">
      {user ? <NotificationsRealtimeSync userId={user.id} /> : null}
      <FloatingNav />
      <div className="absolute inset-0 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
