import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/** Subscribes to `notifications` for the signed-in user; keeps React Query caches fresh. */
export function NotificationsRealtimeSync({ userId }: { userId: string }) {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ["notifications", userId] });
          void qc.invalidateQueries({
            queryKey: ["notifications", userId, "all"],
          });
          void qc.invalidateQueries({
            queryKey: ["notifications_unread", userId],
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  return null;
}
