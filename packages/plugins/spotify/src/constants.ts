/** Max tracks to attach as trace links (Spotify “top” by play count in the period). */
export const SPOTIFY_TOP_TRACKS_LIMIT = 3;

/** Spotify API allows up to 50 per request. */
export const SPOTIFY_RECENTLY_PLAYED_PAGE_LIMIT = 50;

/**
 * Hard cap on pagination requests for recently-played (long trace windows).
 * Total plays scanned ≤ PAGE_LIMIT × MAX_PAGES (e.g. 50 × 12 = 600).
 */
export const SPOTIFY_RECENTLY_PLAYED_MAX_PAGES = 12;
