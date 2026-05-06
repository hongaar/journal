import type { Journal } from "@/types/database";
import { MAP_VIEW_PARAM } from "@/lib/map-view-params";

export type JournalViewSegment = "map" | "blog";

export function journalViewHref(
  view: JournalViewSegment,
  journalSlug: string,
): string {
  return `/${view}/${journalSlug}`;
}

/** Map uses the fullscreen / overlay sidebar chrome. */
export function isMapFullscreenPathname(pathname: string): boolean {
  return pathname === "/" || /^\/map\/[^/]+\/?$/.test(pathname);
}

export function journalViewSegmentFromPathname(
  pathname: string,
): JournalViewSegment {
  return pathname.startsWith("/blog/") ? "blog" : "map";
}

export function journalSwitchHref(
  nextJournal: Journal,
  currentPathname: string,
  currentSearch: string,
): string {
  const segment = journalViewSegmentFromPathname(currentPathname);
  const slug = nextJournal.slug.trim();
  const p = new URLSearchParams(
    currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch,
  );
  p.delete("filter");
  p.delete("tags");
  p.delete(MAP_VIEW_PARAM.trace);
  const q = p.toString();
  const base = journalViewHref(segment, slug);
  return q ? `${base}?${q}` : base;
}

export function mapHrefWithSearch(
  journalSlug: string,
  searchParamsStr: string,
): string {
  const p = new URLSearchParams(
    searchParamsStr.startsWith("?")
      ? searchParamsStr.slice(1)
      : searchParamsStr,
  );
  const q = p.toString();
  const base = journalViewHref("map", journalSlug);
  return q ? `${base}?${q}` : base;
}
