import { useEffect, useState } from "react";
import { UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getGravatarUrl } from "@/lib/gravatar";

/** 0 = custom URL, 1 = Gravatar, 2 = give up (placeholder). */
type Attempt = 0 | 1 | 2;

export type UserAvatarProps = {
  /** Custom URL from profile (upload or legacy pasted URL). */
  storedAvatarUrl: string | null | undefined;
  email: string | null | undefined;
  /** Pixel size requested from Gravatar (display CSS may differ). */
  gravatarSize?: number;
  className?: string;
  imgClassName?: string;
  /** Accessible label when showing the photo. */
  label?: string;
};

export function UserAvatar({
  storedAvatarUrl,
  email,
  gravatarSize = 160,
  className,
  imgClassName,
  label = "",
}: UserAvatarProps) {
  const stored = storedAvatarUrl?.trim() || null;
  const [attempt, setAttempt] = useState<Attempt>(() => (stored ? 0 : 1));
  const [gravatar, setGravatar] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset fallback chain when photo or email identity changes
    setAttempt(stored ? 0 : 1);
  }, [stored, email]);

  useEffect(() => {
    if (!email?.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear resolved URL when email is absent
      setGravatar(null);
      return;
    }
    let cancelled = false;
    void getGravatarUrl(email, gravatarSize).then((url) => {
      if (!cancelled) setGravatar(url);
    });
    return () => {
      cancelled = true;
    };
  }, [email, gravatarSize]);

  const tryStored = attempt === 0;
  const tryGravatar = attempt === 1;
  const src = tryStored && stored ? stored : tryGravatar && gravatar ? gravatar : null;

  if (!src) {
    return (
      <span className={cn("text-muted-foreground inline-flex", className)} aria-hidden>
        <UserCircle className={cn("size-7", imgClassName)} />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex shrink-0", className)}>
      <img
        src={src}
        alt={label}
        className={cn("size-8 rounded-full object-cover ring-1 ring-foreground/15", imgClassName)}
        referrerPolicy="no-referrer"
        onError={() => {
          setAttempt((a) => (a < 2 ? ((a + 1) as Attempt) : 2));
        }}
      />
    </span>
  );
}
