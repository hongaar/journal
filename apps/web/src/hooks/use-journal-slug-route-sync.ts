import {
  journalViewHref,
  journalViewSegmentFromPathname,
} from "@/lib/app-paths";
import { useJournal } from "@/providers/journal-provider";
import { useLayoutEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Locks `activeJournal` to `journalSlug` from the route. Invalid slugs normalize
 * onto the user's current journal slug for the active view (map vs blog).
 */
export function useJournalSlugRouteSync(journalSlug: string | undefined) {
  const { journals, loading, activeJournalId, setActiveJournalId } =
    useJournal();
  const navigate = useNavigate();
  const location = useLocation();

  const resolvedJournal = useMemo(() => {
    if (!journalSlug) return null;
    const needle = journalSlug.trim().toLowerCase();
    return journals.find((j) => j.slug.toLowerCase() === needle) ?? null;
  }, [journals, journalSlug]);

  useLayoutEffect(() => {
    if (loading) return;
    if (journals.length === 0) return;
    if (!journalSlug) return;

    if (resolvedJournal) {
      if (resolvedJournal.id !== activeJournalId) {
        setActiveJournalId(resolvedJournal.id);
      }
      return;
    }

    const fallback =
      journals.find((j) => j.id === activeJournalId) ?? journals[0] ?? null;
    if (!fallback?.slug) return;

    const segment = journalViewSegmentFromPathname(location.pathname);
    navigate(`${journalViewHref(segment, fallback.slug)}${location.search}`, {
      replace: true,
    });
  }, [
    loading,
    journals,
    journalSlug,
    resolvedJournal,
    activeJournalId,
    setActiveJournalId,
    navigate,
    location.pathname,
    location.search,
  ]);
}
