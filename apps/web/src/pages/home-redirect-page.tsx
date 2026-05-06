import { JournalViewInitialLoader } from "@/components/layout/journal-view-initial-loader";
import { journalViewHref } from "@/lib/app-paths";
import { useJournal } from "@/providers/journal-provider";
import { Navigate } from "react-router-dom";

/** `/` — redirect to the user's map URL for the active journal. */
export function HomeRedirectPage() {
  const { journals, activeJournal, loading } = useJournal();
  const journal = activeJournal ?? journals[0];

  if (loading) {
    return <JournalViewInitialLoader />;
  }
  if (!journal?.slug) {
    return (
      <JournalViewInitialLoader label="No journal available." busy={false} />
    );
  }

  return <Navigate to={journalViewHref("map", journal.slug)} replace />;
}

/** Legacy `/blog` — redirect using the active journal slug. */
export function BlogHomeRedirectPage() {
  const { journals, activeJournal, loading } = useJournal();
  const journal = activeJournal ?? journals[0];

  if (loading) {
    return <JournalViewInitialLoader />;
  }
  if (!journal?.slug) {
    return (
      <JournalViewInitialLoader label="No journal available." busy={false} />
    );
  }

  return <Navigate to={journalViewHref("blog", journal.slug)} replace />;
}
