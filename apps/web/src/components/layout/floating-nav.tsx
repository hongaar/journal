import { MainToolbarPanel } from "@/components/layout/main-toolbar-panel";
import { UserAvatar } from "@/components/user-avatar";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import type { Profile } from "@/types/database";
import { buttonVariants } from "@curolia/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@curolia/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { Bell, Plug, Settings2, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * Shell chrome over the entire app (viewport-fixed). Sidebar rail scrolls underneath the left toolbar.
 */
export function FloatingNav() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
    enabled: Boolean(user),
  });

  return (
    <header className="pointer-events-none fixed top-0 right-0 left-0 z-[96] flex items-start justify-between gap-3 p-[var(--nav-shell-pad)] sm:items-center">
      <MainToolbarPanel />
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            buttonVariants({ variant: "outline" }),
            "pointer-events-auto relative size-10 shrink-0 overflow-hidden rounded-full border-[var(--panel-border)] bg-[var(--panel-bg)] p-0 shadow-[var(--panel-shadow)] backdrop-blur-xl backdrop-saturate-150",
            "focus-visible:bg-[var(--panel-bg)] data-popup-open:bg-[var(--panel-bg)] hover:bg-[var(--panel-bg)] data-popup-open:border-[var(--panel-border)]",
          )}
          title="Account"
          aria-label="Account menu"
        >
          <UserAvatar
            storedAvatarUrl={profileQuery.data?.avatar_url}
            email={user?.email}
            gravatarSize={128}
            label="Account"
            className="flex size-full items-center justify-center"
            imgClassName="size-full object-cover ring-0"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-normal">
              <span className="text-muted-foreground text-xs">Signed in</span>
              <span className="block truncate text-sm font-medium">
                {user?.email ?? "—"}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/profile")}>
              <User className="size-4 opacity-80" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/notifications")}>
              <Bell className="size-4 opacity-80" />
              Notifications
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <Settings2 className="size-4 opacity-80" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings/plugins")}>
              <Plug className="size-4 opacity-80" />
              Plugins
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => void signOut()}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
