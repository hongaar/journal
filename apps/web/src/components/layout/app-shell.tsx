import { FloatingNav } from "@/components/layout/floating-nav";
import { NavigationSidebarColumn } from "@/components/layout/navigation-sidebar-column";
import { NotificationsRealtimeSync } from "@/components/layout/notifications-realtime-sync";
import { NAV_SIDEBAR_LAYOUT_FLUSH_EVENT } from "@/lib/navigation-shell-layout";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import {
  NavigationShellProvider,
  useNavigationShell,
} from "@/providers/navigation-shell-provider";
import { TagSidebarProvider } from "@/providers/tag-sidebar-provider";
import { useEffect } from "react";
import { Outlet } from "react-router-dom";

function AppShellInner() {
  const { user } = useAuth();
  const { sidebarOpen } = useNavigationShell();

  useEffect(() => {
    let frame = 0;
    const startedAt = performance.now();
    const durationMs = 340;

    const tick = (now: number) => {
      window.dispatchEvent(new Event("resize"));
      if (now - startedAt < durationMs) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [sidebarOpen]);

  return (
    <div className="relative h-svh w-full overflow-hidden bg-background">
      {user ? <NotificationsRealtimeSync userId={user.id} /> : null}
      <div className="flex h-full w-full min-w-0 overflow-hidden">
        <aside
          id="curolia-navigation-sidebar"
          aria-hidden={!sidebarOpen}
          inert={sidebarOpen ? undefined : true}
          className={cn(
            "border-sidebar-border bg-sidebar text-sidebar-foreground shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out motion-reduce:transition-none",
            sidebarOpen
              ? "border-r w-[var(--nav-sidebar-expanded-w)]"
              : "w-0 border-r-0",
          )}
          onTransitionEnd={(event) => {
            if (
              event.propertyName === "width" &&
              event.target === event.currentTarget
            ) {
              window.dispatchEvent(
                new CustomEvent(NAV_SIDEBAR_LAYOUT_FLUSH_EVENT),
              );
              window.dispatchEvent(new Event("resize"));
            }
          }}
        >
          {/* min-w locks rail content layout while aside width animates (clip reveals); differs from animated width */}
          <div className="flex h-full min-w-[var(--nav-sidebar-expanded-w)] flex-col">
            <NavigationSidebarColumn />
          </div>
        </aside>
        <div
          data-app-main
          className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        >
          <div className="min-h-0 flex-1 overflow-hidden">
            <Outlet />
          </div>
        </div>
      </div>
      <FloatingNav />
    </div>
  );
}

export function AppShell() {
  return (
    <TagSidebarProvider>
      <NavigationShellProvider>
        <AppShellInner />
      </NavigationShellProvider>
    </TagSidebarProvider>
  );
}
