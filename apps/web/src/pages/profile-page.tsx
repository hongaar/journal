import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import type { Profile } from "@/types/database";
import { FloatingPanel } from "@/components/layout/floating-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  const profile = profileQuery.data;

  useEffect(() => {
    if (!profile) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate controlled fields when server profile loads
    setDisplayName(profile.display_name ?? "");
    setAvatarUrl(profile.avatar_url ?? "");
  }, [profile]);

  async function save() {
    if (!user) return;
    setSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Saved.");
    await qc.invalidateQueries({ queryKey: ["profile", user.id] });
  }

  return (
    <div className="h-full overflow-y-auto px-3 pt-[4.75rem] pb-10 sm:px-6 sm:pt-[5.25rem]">
      <div className="mx-auto max-w-lg">
        <FloatingPanel className="p-5 sm:p-6">
          <h1 className="font-display text-foreground text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Update how you appear in the app. Email is managed by your account provider.
          </p>
          {user?.email ? (
            <p className="text-muted-foreground mt-3 text-sm">
              Signed in as <span className="text-foreground font-medium">{user.email}</span>
            </p>
          ) : null}
          <div className="mt-6 grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="pf-name">Display name</Label>
              <Input
                id="pf-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                disabled={profileQuery.isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pf-avatar">Avatar URL</Label>
              <Input
                id="pf-avatar"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://…"
                disabled={profileQuery.isLoading}
              />
              <p className="text-muted-foreground text-xs">Paste a direct image URL. Hosted uploads can come later.</p>
            </div>
            {message ? <p className="text-sm">{message}</p> : null}
            <Button className="w-fit rounded-xl" disabled={saving || profileQuery.isLoading} onClick={() => void save()}>
              Save changes
            </Button>
          </div>
        </FloatingPanel>
      </div>
    </div>
  );
}
