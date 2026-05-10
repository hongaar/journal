import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  TracePhotoLightbox,
  TracePhotoThumb,
} from "@/components/traces/trace-photo-lightbox";
import { photosToLightboxItems } from "@/lib/trace-photo-lightbox-items";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useJournal } from "@/providers/journal-provider";
import type { Trace } from "@/types/database";
import { useTracePhotosSignedUrls } from "@/lib/use-trace-photos";
import { TraceFormDialogTrigger } from "@/components/traces/trace-form-dialog";
import { TraceLinksList } from "@/components/traces/trace-links-list";
import { PageBackButton } from "@/components/layout/page-back-button";
import { buttonVariants } from "@curolia/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@curolia/ui/card";
import { Badge } from "@curolia/ui/badge";
import { formatTraceDateRange } from "@/lib/trace-dates";
import { TraceMetadataFooter } from "@/components/traces/trace-metadata-footer";
import { journalViewHref } from "@/lib/app-paths";
import { contrastingForeground } from "@/lib/utils";
type TraceRow = Trace & {
  trace_tags?: {
    tag_id: string;
    tags: {
      id: string;
      name: string;
      color: string;
      icon_emoji: string;
    } | null;
  }[];
  creator?: { display_name: string | null } | null;
  modifier?: { display_name: string | null } | null;
};

export function TraceDetailPage() {
  const { journalSlug, traceSlug } = useParams<{
    journalSlug: string;
    traceSlug: string;
  }>();
  const navigate = useNavigate();
  const { journals, activeJournalId } = useJournal();
  const [photoLightbox, setPhotoLightbox] = useState<{
    photoId: string;
  } | null>(null);

  const journalForRoute = useMemo(
    () =>
      journals.find(
        (j) => j.slug.toLowerCase() === journalSlug?.trim().toLowerCase(),
      ) ?? null,
    [journals, journalSlug],
  );

  const traceQuery = useQuery({
    queryKey: ["trace", journalForRoute?.id, traceSlug],
    queryFn: async () => {
      if (!journalForRoute || !traceSlug?.trim()) return null;
      const slugNorm = traceSlug.trim().toLowerCase();
      const { data, error } = await supabase
        .from("traces")
        .select(
          `*,
          trace_tags ( tag_id, tags ( id, name, color, icon_emoji ) ),
          creator:profiles!traces_created_by_user_id_fkey ( display_name ),
          modifier:profiles!traces_modified_by_user_id_fkey ( display_name )`,
        )
        .eq("journal_id", journalForRoute.id)
        .eq("slug", slugNorm)
        .maybeSingle();
      if (error) throw error;
      return data as TraceRow | null;
    },
    enabled: Boolean(journalForRoute && traceSlug?.trim()),
  });

  const traceIdResolved = traceQuery.data?.id;

  const { photos, signedUrlByPhotoId } =
    useTracePhotosSignedUrls(traceIdResolved);

  const trace = traceQuery.data;
  const wrongJournal =
    trace && activeJournalId && trace.journal_id !== activeJournalId;

  const tagBadges = useMemo(() => {
    const rows = trace?.trace_tags ?? [];
    return rows.map((tt) => tt.tags).filter(Boolean) as {
      id: string;
      name: string;
      color: string;
      icon_emoji: string;
    }[];
  }, [trace]);

  const lightboxItems = useMemo(
    () => photosToLightboxItems(photos, signedUrlByPhotoId),
    [photos, signedUrlByPhotoId],
  );

  if (traceQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-muted-foreground text-sm">Loading trace…</p>
      </div>
    );
  }

  if (!trace || wrongJournal) {
    return (
      <div className="flex h-full flex-col items-start gap-4 px-4 pt-[4.75rem] pb-8 sm:px-6 sm:pt-[5.25rem]">
        <p className="text-muted-foreground text-sm">
          Trace not found or not in this journal.
        </p>
        <button
          type="button"
          className={buttonVariants({
            variant: "outline",
            className: "inline-flex gap-1 rounded-xl",
          })}
          onClick={() => {
            const fromTrace =
              trace &&
              journals.find((x) => x.id === trace.journal_id)?.slug?.trim();
            const slug =
              fromTrace ||
              journals.find((x) => x.id === activeJournalId)?.slug?.trim();
            navigate(slug ? journalViewHref("map", slug) : "/");
          }}
        >
          Home
        </button>
      </div>
    );
  }

  const traceDateSubtitle = formatTraceDateRange(trace.date, trace.end_date);

  return (
    <div className="h-full overflow-y-auto px-3 pt-[4.75rem] pb-10 sm:px-6 sm:pt-[5.25rem]">
      <div className="mx-auto max-w-2xl space-y-4">
        <PageBackButton />
        <Card className="border-[var(--panel-border)] bg-[var(--panel-bg)] shadow-[var(--panel-shadow)] backdrop-blur-xl">
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="font-display text-2xl font-normal tracking-tight">
                {trace.title || "Untitled place"}
              </CardTitle>
              {traceDateSubtitle ? (
                <p className="text-muted-foreground mt-1 text-sm">
                  {traceDateSubtitle}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1">
                {tagBadges.map((t) => (
                  <Badge
                    key={t.id}
                    variant="secondary"
                    className="border-0"
                    style={{
                      backgroundColor: t.color,
                      color: contrastingForeground(t.color),
                    }}
                  >
                    {t.icon_emoji} {t.name}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-start">
              <TraceFormDialogTrigger
                journalId={trace.journal_id}
                trace={trace}
                variant="outline"
                size="sm"
                className="rounded-xl"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {trace.description ? (
              <p className="text-sm whitespace-pre-wrap">{trace.description}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {photos.map((p) => {
                const url = signedUrlByPhotoId[p.id];
                return url ? (
                  <TracePhotoThumb
                    key={p.id}
                    url={url}
                    className="h-24 w-24 shrink-0 overflow-hidden rounded-md border"
                    onOpen={() => setPhotoLightbox({ photoId: p.id })}
                  />
                ) : (
                  <div
                    key={p.id}
                    className="text-muted-foreground flex h-24 w-24 items-center justify-center rounded-md border text-xs"
                  >
                    …
                  </div>
                );
              })}
            </div>
            <TraceLinksList traceId={trace.id} />
            <TraceMetadataFooter
              createdAt={trace.created_at}
              updatedAt={trace.updated_at}
              creatorDisplayName={trace.creator?.display_name}
              modifierDisplayName={trace.modifier?.display_name}
            />
          </CardContent>
        </Card>
        <TracePhotoLightbox
          open={photoLightbox !== null}
          onOpenChange={(o) => {
            if (!o) setPhotoLightbox(null);
          }}
          items={lightboxItems}
          initialPhotoId={photoLightbox?.photoId ?? null}
          title={trace.title?.trim() || "Untitled place"}
        />
      </div>
    </div>
  );
}
