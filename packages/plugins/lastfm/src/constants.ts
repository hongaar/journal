/** Client refetch guard: don’t sync more often than this when revisiting a trace. */
export const LASTFM_SYNC_STALE_TIME_MS = 60_000;

/** Max tracks persisted (top by play count in the period). */
export const LASTFM_TOP_TRACKS_LIMIT = 3;

/** Last.fm `user.getRecentTracks` allows up to 200 per request. */
export const LASTFM_PAGE_LIMIT = 200;

/**
 * Cap on paginated API calls (long windows with many scrobbles).
 * Scrobbles scanned ≤ PAGE_LIMIT × MAX_PAGES.
 */
export const LASTFM_MAX_PAGES = 50;
