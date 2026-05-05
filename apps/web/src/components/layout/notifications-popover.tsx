import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { buttonVariants } from "@curolia/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@curolia/ui/popover";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types/database";

export function NotificationsPopover({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);

  const {
    data: items = [],
    refetch,
    isPending,
    isFetching,
  } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return (data ?? []) as AppNotification[];
    },
    enabled: Boolean(userId),
  });

  React.useEffect(() => {
    if (open && userId) void refetch();
  }, [open, userId, refetch]);

  async function openNotification(n: AppNotification) {
    if (!n.read_at) {
      await supabase.rpc("mark_notification_read", { p_notification_id: n.id });
      void qc.invalidateQueries({ queryKey: ["notifications", userId] });
      void qc.invalidateQueries({ queryKey: ["notifications_unread", userId] });
    }
    if (n.action_path) {
      navigate(n.action_path);
    } else {
      navigate("/notifications");
    }
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "size-9 shrink-0 rounded-xl",
        )}
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="size-4 opacity-80" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(22rem,calc(100vw-2rem))] p-0"
      >
        <div className="border-border/60 flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          <button
            type="button"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "h-8 rounded-lg text-xs",
            )}
            onClick={() => {
              setOpen(false);
              navigate("/notifications");
            }}
          >
            See all
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {open ? (
            isPending || isFetching ? (
              <p className="text-muted-foreground px-3 py-4 text-sm">
                Loading…
              </p>
            ) : items.length === 0 ? (
              <p className="text-muted-foreground px-3 py-4 text-sm">
                No notifications yet.
              </p>
            ) : (
              <ul>
                {items.map((n) => (
                  <li
                    key={n.id}
                    className="border-border/40 border-b last:border-0"
                  >
                    <button
                      type="button"
                      className={cn(
                        "hover:bg-foreground/5 flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm transition-colors",
                        !n.read_at && "bg-primary/5",
                      )}
                      onClick={() => void openNotification(n)}
                    >
                      <span className="flex items-start gap-2">
                        {!n.read_at ? (
                          <span
                            className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full"
                            aria-hidden
                          />
                        ) : (
                          <span className="size-1.5 shrink-0" aria-hidden />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="font-medium">{n.title}</span>
                          {n.body ? (
                            <span className="text-muted-foreground mt-0.5 line-clamp-2 block text-xs">
                              {n.body}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
