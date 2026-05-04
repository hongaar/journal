import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FloatingPanel } from "@/components/layout/floating-panel";
import { PageBackButton } from "@/components/layout/page-back-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import type { Profile } from "@/types/database";
import { cn } from "@/lib/utils";

type ThemeChoice = "light" | "dark" | "system";

export function AppSettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);
  const [notifMsg, setNotifMsg] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
    enabled: Boolean(user),
  });

  useEffect(() => {
    const p = profileQuery.data;
    if (!p) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate toggles from server
    setEmailNotif(p.notification_email_enabled ?? true);
    setPushNotif(p.notification_push_enabled ?? false);
  }, [profileQuery.data]);

  const current = (theme === "light" || theme === "dark" ? theme : "system") as ThemeChoice;

  function pick(next: ThemeChoice) {
    setTheme(next);
  }

  async function saveNotificationPrefs() {
    if (!user) return;
    setSavingNotif(true);
    setNotifMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        notification_email_enabled: emailNotif,
        notification_push_enabled: pushNotif,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    setSavingNotif(false);
    if (error) {
      setNotifMsg(error.message);
      return;
    }
    setNotifMsg("Saved.");
    await qc.invalidateQueries({ queryKey: ["profile", user.id] });
  }

  const notifDirty =
    profileQuery.data != null &&
    (emailNotif !== (profileQuery.data.notification_email_enabled ?? true) ||
      pushNotif !== (profileQuery.data.notification_push_enabled ?? false));

  return (
    <div className="h-full overflow-y-auto px-3 pt-[4.75rem] pb-10 sm:px-6 sm:pt-[5.25rem]">
      <div className="mx-auto max-w-lg space-y-4">
        <PageBackButton />
        <FloatingPanel className="p-5 sm:p-6">
          <h1 className="font-display text-foreground text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">Appearance and other preferences.</p>

          <section className="mt-8">
            <h2 className="text-foreground text-sm font-semibold tracking-tight">Theme</h2>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Choose a color scheme. System follows your device setting.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(
                [
                  { id: "light" as const, label: "Light" },
                  { id: "dark" as const, label: "Dark" },
                  { id: "system" as const, label: "System" },
                ] as const
              ).map(({ id, label }) => (
                <Button
                  key={id}
                  type="button"
                  variant={current === id ? "default" : "outline"}
                  size="sm"
                  className={cn("rounded-xl", current === id && "pointer-events-none")}
                  onClick={() => pick(id)}
                >
                  {label}
                </Button>
              ))}
            </div>
            {current === "system" && resolvedTheme ? (
              <p className="text-muted-foreground mt-3 text-xs">
                Active appearance: <span className="text-foreground font-medium capitalize">{resolvedTheme}</span>
              </p>
            ) : null}
          </section>

          <section className="mt-10">
            <h2 className="text-foreground text-sm font-semibold tracking-tight">Notifications</h2>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              In-app notifications are always on. Email and push control how we may reach you when delivery is
              available.
            </p>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 space-y-0.5">
                  <Label htmlFor="notif-email" className="text-sm font-normal">
                    Email
                  </Label>
                  <p className="text-muted-foreground text-xs">Invitation and activity summaries by email when enabled.</p>
                </div>
                <Switch id="notif-email" checked={emailNotif} onCheckedChange={(c) => setEmailNotif(c === true)} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 space-y-0.5">
                  <Label htmlFor="notif-push" className="text-sm font-normal">
                    Push (native app)
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Preference only for now; the native app will use this when push is implemented.
                  </p>
                </div>
                <Switch id="notif-push" checked={pushNotif} onCheckedChange={(c) => setPushNotif(c === true)} />
              </div>
            </div>
            {notifMsg ? <p className="text-muted-foreground mt-3 text-xs">{notifMsg}</p> : null}
            <Button
              type="button"
              className="mt-4 rounded-xl"
              size="sm"
              disabled={!notifDirty || savingNotif || !user}
              onClick={() => void saveNotificationPrefs()}
            >
              Save notification preferences
            </Button>
          </section>
        </FloatingPanel>
      </div>
    </div>
  );
}
