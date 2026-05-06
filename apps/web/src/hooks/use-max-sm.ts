import { useSyncExternalStore } from "react";

/** Matches Tailwind `max-sm` (viewport below 640px). */
const QUERY = "(max-width: 639px)";

export function useMaxSm(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = matchMedia(QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => matchMedia(QUERY).matches,
    () => false,
  );
}
