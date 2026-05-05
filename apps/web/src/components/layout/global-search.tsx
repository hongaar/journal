import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  Map as MapIcon,
  MapPin,
  Notebook,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useMatch, useNavigate } from "react-router-dom";
import { buttonVariants } from "@curolia/ui/button";
import { Input } from "@curolia/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@curolia/ui/popover";
import { cn } from "@/lib/utils";
import {
  applyMapBboxToSearchParams,
  applyMapCameraToSearchParams,
  applySelectedTraceToSearchParams,
  normalizeCameraForUrl,
  TRACE_FOCUS_ZOOM,
} from "@/lib/map-view-params";
import { searchPhotonPlaces, type PhotonPlace } from "@/lib/photon-geocode";
import {
  searchTracesInJournals,
  sortTracesByPreferredJournal,
  type TraceSearchRow,
} from "@/lib/trace-text-search";
import { useJournal } from "@/providers/journal-provider";
import type { Journal } from "@/types/database";

const DEBOUNCE_MS = 320;

function journalTitle(
  trace: TraceSearchRow,
  journalById: Map<string, Journal>,
) {
  return journalById.get(trace.journal_id)?.name ?? "Journal";
}

function tracePrimaryLabel(t: TraceSearchRow): string {
  const title = t.title?.trim();
  if (title) return title;
  const place = t.location_label?.trim();
  if (place) return place;
  const desc = t.description?.trim();
  if (desc) return desc.length > 72 ? `${desc.slice(0, 72)}…` : desc;
  return "Untitled trace";
}

type ResultButtonProps = {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onPick: () => void;
};

function ResultRow({ icon, title, subtitle, onPick }: ResultButtonProps) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "h-auto min-h-9 w-full justify-start gap-2 rounded-md px-2 py-1.5 text-left font-normal",
      )}
    >
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-foreground text-sm leading-tight">
          {title}
        </span>
        {subtitle ? (
          <span className="text-muted-foreground mt-0.5 block truncate text-xs leading-tight">
            {subtitle}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-muted-foreground px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider">
      {children}
    </div>
  );
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const isMapRoute = Boolean(useMatch({ path: "/", end: true }));
  const { journals, activeJournalId, setActiveJournalId } = useJournal();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(input.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [input]);

  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const journalIds = useMemo(() => journals.map((j) => j.id), [journals]);
  const journalIdsKey = useMemo(
    () => [...journalIds].sort().join(","),
    [journalIds],
  );
  const journalById = useMemo(
    () => new Map(journals.map((j) => [j.id, j])),
    [journals],
  );

  const journalMatches = useMemo(() => {
    const q = debounced.toLowerCase();
    if (q.length < 1) return [];
    return journals
      .filter((j) => j.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const as = a.id === activeJournalId ? 0 : 1;
        const bs = b.id === activeJournalId ? 0 : 1;
        if (as !== bs) return as - bs;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 12);
  }, [debounced, journals, activeJournalId]);

  const tracesQuery = useQuery({
    queryKey: ["global-search-traces", debounced, journalIdsKey],
    queryFn: () => searchTracesInJournals(journalIds, debounced),
    enabled: open && debounced.length >= 2 && journalIds.length > 0,
  });

  const placesQuery = useQuery({
    queryKey: ["global-search-places", debounced],
    queryFn: () => searchPhotonPlaces(debounced),
    enabled: open && isMapRoute && debounced.length >= 2,
    staleTime: 60_000,
  });

  const tracesSorted = useMemo(() => {
    const rows = tracesQuery.data ?? [];
    return sortTracesByPreferredJournal(rows, activeJournalId);
  }, [tracesQuery.data, activeJournalId]);

  function onPickJournal(j: Journal) {
    setActiveJournalId(j.id);
    setOpen(false);
  }

  function onPickTrace(t: TraceSearchRow) {
    // Commit journal before updating the URL so MapPage never sees ?trace= for another journal
    // while traces are still scoped to the previous activeJournalId (would clear trace from URL).
    flushSync(() => {
      setActiveJournalId(t.journal_id);
    });
    if (isMapRoute) {
      const withTrace = applySelectedTraceToSearchParams(
        new URLSearchParams(),
        t.id,
      );
      const params = applyMapCameraToSearchParams(
        withTrace,
        normalizeCameraForUrl({
          lat: t.lat,
          lng: t.lng,
          zoom: TRACE_FOCUS_ZOOM,
        }),
      );
      navigate(`/?${params.toString()}`);
    } else {
      navigate(`/traces/${t.id}`);
    }
    setOpen(false);
  }

  function onPickPlace(p: PhotonPlace) {
    let params = new URLSearchParams();
    if (p.bbox) {
      params = applyMapBboxToSearchParams(params, p.bbox);
    }
    const center = p.bbox
      ? {
          lat: (p.bbox.south + p.bbox.north) / 2,
          lng: (p.bbox.west + p.bbox.east) / 2,
          zoom: 11,
        }
      : { lat: p.lat, lng: p.lng, zoom: 12 };
    params = applyMapCameraToSearchParams(
      params,
      normalizeCameraForUrl(center),
    );
    navigate(`/?${params.toString()}`);
    setOpen(false);
  }

  const showPlaces = isMapRoute && debounced.length >= 2;
  const showTraces = debounced.length >= 2;
  const busy =
    (showTraces && tracesQuery.isFetching) ||
    (showPlaces && placesQuery.isFetching);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setInput("");
          setDebounced("");
        }
      }}
    >
      <PopoverTrigger
        type="button"
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "h-9 gap-1.5 rounded-xl border-[var(--panel-border)] bg-background/80 px-2.5 shadow-sm backdrop-blur-md sm:px-3",
        )}
        title="Search (Ctrl+K)"
      >
        <Search className="size-4 shrink-0 opacity-80" />
        <span className="text-muted-foreground hidden max-w-[10rem] truncate sm:inline">
          Search…
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[min(calc(100vw-1.5rem),22rem)] gap-0 border-[var(--panel-border)] bg-[var(--panel-bg)] p-0 shadow-xl backdrop-blur-xl"
      >
        <PopoverTitle className="sr-only">
          Search journals and traces
        </PopoverTitle>
        <div className="border-border/60 flex items-center gap-2 border-b px-2 py-2">
          <Search
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden
          />
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Journals, traces…"
            className="border-0 bg-transparent shadow-none focus-visible:ring-0"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {busy ? (
            <Loader2
              className="text-muted-foreground size-4 shrink-0 animate-spin"
              aria-hidden
            />
          ) : null}
        </div>

        <div className="max-h-[min(50vh,300px)] overflow-y-auto px-1 pb-2">
          {debounced.length === 0 ? (
            <p className="text-muted-foreground px-2 py-3 text-center text-xs">
              Search journals by name. Type two or more characters to find
              traces
              {isMapRoute ? " and map places" : ""}.
            </p>
          ) : null}

          {debounced.length >= 1 && journalMatches.length > 0 ? (
            <>
              <SectionLabel>Journals</SectionLabel>
              {journalMatches.map((j) => (
                <ResultRow
                  key={j.id}
                  icon={<Notebook className="size-4" />}
                  title={j.name}
                  subtitle={j.is_personal ? "Personal" : undefined}
                  onPick={() => onPickJournal(j)}
                />
              ))}
            </>
          ) : null}

          {debounced.length >= 1 &&
          journalMatches.length === 0 &&
          debounced.length < 2 ? (
            <p className="text-muted-foreground px-2 py-2 text-xs">
              No journals match. Add another letter to search traces
              {isMapRoute ? " and places" : ""}.
            </p>
          ) : null}

          {showTraces ? (
            <>
              <SectionLabel>Traces</SectionLabel>
              {tracesQuery.isError ? (
                <p className="text-muted-foreground px-2 py-1 text-xs">
                  Could not load traces.
                </p>
              ) : tracesQuery.isFetching && tracesSorted.length === 0 ? (
                <p className="text-muted-foreground px-2 py-1 text-xs">
                  Searching…
                </p>
              ) : tracesSorted.length === 0 ? (
                <p className="text-muted-foreground px-2 py-1 text-xs">
                  No matching traces.
                </p>
              ) : (
                tracesSorted.map((t) => (
                  <ResultRow
                    key={t.id}
                    icon={<MapPin className="size-4" />}
                    title={tracePrimaryLabel(t)}
                    subtitle={journalTitle(t, journalById)}
                    onPick={() => onPickTrace(t)}
                  />
                ))
              )}
            </>
          ) : null}

          {showPlaces ? (
            <>
              <SectionLabel>Places</SectionLabel>
              {placesQuery.isError ? (
                <p className="text-muted-foreground px-2 py-1 text-xs">
                  Could not load places.
                </p>
              ) : placesQuery.isFetching &&
                (placesQuery.data?.length ?? 0) === 0 ? (
                <p className="text-muted-foreground px-2 py-1 text-xs">
                  Searching…
                </p>
              ) : (placesQuery.data?.length ?? 0) === 0 ? (
                <p className="text-muted-foreground px-2 py-1 text-xs">
                  No matching places.
                </p>
              ) : (
                (placesQuery.data ?? []).map((p) => {
                  const primary = p.primaryName.trim();
                  const full = p.fullLabel.trim();
                  const subtitle = full && full !== primary ? full : undefined;
                  return (
                    <ResultRow
                      key={p.id}
                      icon={<MapIcon className="size-4" />}
                      title={primary || full || "Place"}
                      subtitle={subtitle}
                      onPick={() => onPickPlace(p)}
                    />
                  );
                })
              )}
            </>
          ) : null}
        </div>

        <div className="text-muted-foreground border-border/60 hidden border-t px-2 py-1.5 text-[10px] sm:block">
          <kbd className="rounded border px-1 py-px font-mono">Ctrl</kbd>{" "}
          <kbd className="rounded border px-1 py-px font-mono">K</kbd> to open ·
          Trace results prefer the active journal
        </div>
      </PopoverContent>
    </Popover>
  );
}
