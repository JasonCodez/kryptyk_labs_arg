// Central route classification for the app shell.
//
// The mode decides which global chrome the app renders around a page:
//   • browse — marketing/library/hub pages: top navbar + bottom nav + banners
//   • play   — an active puzzle: full-screen game shell, browse chrome cleared
//   • auth   — sign in / register / password flows
//   • admin  — admin tooling
//
// Keep this the single source of truth so AppChrome and any page can agree on
// how a route should behave without duplicating path checks.

export type AppMode = "browse" | "play" | "auth" | "admin";

// Both regexes are anchored to exactly one path segment after the prefix, so a
// route only counts as gameplay if it IS /puzzles/<id> or /daily/<puzzle> —
// deeper nested routes (e.g. /puzzles/type/<type> — a browse listing, or
// /puzzles/<id>/planning — a team-planning redirect stub, neither of which is
// the solve screen) fall through to "browse" instead of being swept in by a
// loose prefix match. Add new segments here explicitly if they're gameplay.

/** Playable individual-puzzle route: /puzzles/<id> only, not /puzzles/type/<type>. */
const PUZZLE_SOLVE_RE = /^\/puzzles\/(?!type$)[^/]+$/;

/** Playable daily route: /daily/<puzzle>, e.g. /daily/crossword. */
const DAILY_PLAY_RE = /^\/daily\/[^/]+$/;

export function getAppMode(pathname: string | null | undefined): AppMode {
  if (!pathname) return "browse";

  if (pathname === "/auth" || pathname.startsWith("/auth/")) return "auth";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";

  // The daily hub is browse; each individual daily puzzle under it is play
  // (/daily/crossword, /daily/sudoku, /daily/word, /daily/word-search,
  // /daily/jigsaw, and any future single-segment daily puzzle route).
  if (pathname === "/daily") return "browse";
  if (DAILY_PLAY_RE.test(pathname)) return "play";

  // Individual puzzle solve pages are play; the /puzzles library, and any
  // nested non-solve route under /puzzles/<id>/*, are browse.
  if (PUZZLE_SOLVE_RE.test(pathname)) return "play";

  return "browse";
}

export function isPlayMode(pathname: string | null | undefined): boolean {
  return getAppMode(pathname) === "play";
}
