import { Outlet } from "react-router-dom";
import { FloatingNav } from "@/components/layout/floating-nav";

export function AppShell() {
  return (
    <div className="relative h-svh w-full overflow-hidden bg-background">
      <FloatingNav />
      <div className="absolute inset-0 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
