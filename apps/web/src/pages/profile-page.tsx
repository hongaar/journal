import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import type { Profile } from "@/types/database";
import { FloatingPanel } from "@/components/layout/floating-panel";
import { PageBackButton } from "@/components/layout/page-back-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/user-avatar";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

function extFromImageFile(file: File): string | null {
  return MIME_TO_EXT[file.type] ?? null;
}

export function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
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

  async function uploadAvatar(file: File) {
    if (!user) return;
    setMessage(null);
    const ext = extFromImageFile(file);
    if (!ext) {
      setMessage("Please choose a JPEG, PNG, GIF, or WebP image.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setMessage("Image must be 2 MB or smaller.");
      return;
    }
    setUploading(true);
    const path = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
      contentType: file.type || `image/${ext === "jpg" ? "jpeg" : ext}`,
    });
    if (uploadError) {
      setUploading(false);
      setMessage(uploadError.message);
      return;
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = pub.publicUrl;
    const { error: dbError } = await supabase
      .from("profiles")
      .update({
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    setUploading(false);
    if (dbError) {
      setMessage(dbError.message);
      return;
    }
    setAvatarUrl(publicUrl);
    setMessage("Photo updated.");
    await qc.invalidateQueries({ queryKey: ["profile", user.id] });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function removeAvatar() {
    if (!user) return;
    setMessage(null);
    setUploading(true);
    const { data: files } = await supabase.storage.from("avatars").list(user.id);
    if (files?.length) {
      const paths = files.map((f) => `${user.id}/${f.name}`);
      await supabase.storage.from("avatars").remove(paths);
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        avatar_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    setUploading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setAvatarUrl("");
    setMessage("Photo removed. Your Gravatar or default icon will show if applicable.");
    await qc.invalidateQueries({ queryKey: ["profile", user.id] });
  }

  return (
    <div className="h-full overflow-y-auto px-3 pt-[4.75rem] pb-10 sm:px-6 sm:pt-[5.25rem]">
      <div className="mx-auto max-w-lg space-y-4">
        <PageBackButton />
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
            <div className="space-y-3">
              <Label>Photo</Label>
              <div className="flex flex-wrap items-center gap-4">
                <UserAvatar
                  storedAvatarUrl={avatarUrl}
                  email={user?.email}
                  gravatarSize={256}
                  className="size-24 shrink-0"
                  imgClassName="size-24"
                  label={displayName.trim() || user?.email || "Profile"}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="sr-only"
                  aria-label="Upload profile photo"
                  disabled={uploading || profileQuery.isLoading || !user}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadAvatar(file);
                  }}
                />
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      disabled={uploading || profileQuery.isLoading || !user}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploading ? "Working…" : "Upload photo"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="rounded-xl"
                      disabled={uploading || profileQuery.isLoading || !user || !avatarUrl.trim()}
                      onClick={() => void removeAvatar()}
                    >
                      Remove photo
                    </Button>
                  </div>
                  <p className="text-muted-foreground max-w-sm text-xs leading-relaxed">
                    If you do not upload a photo, we show your{" "}
                    <a
                      className="text-foreground underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground/60"
                      href="https://gravatar.com"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Gravatar
                    </a>{" "}
                    for this email, then the default icon.
                  </p>
                </div>
              </div>
            </div>
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
