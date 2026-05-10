/** Client refetch guard: don’t sync more often than this when revisiting a trace. */
export const SPOTIFY_SYNC_STALE_TIME_MS = 60_000;

/** Max tracks persisted (Spotify “top” by play count in the period). */
export const SPOTIFY_TOP_TRACKS_LIMIT = 3;

/** Spotify API allows up to 50 per request. */
export const SPOTIFY_RECENTLY_PLAYED_PAGE_LIMIT = 50;

/**
 * Hard cap on pagination requests for recently-played (long trace windows).
 * Total plays scanned ≤ PAGE_LIMIT × MAX_PAGES (e.g. 50 × 12 = 600).
 */
export const SPOTIFY_RECENTLY_PLAYED_MAX_PAGES = 12;
