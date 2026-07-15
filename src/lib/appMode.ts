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

/** Playable individual-puzzle route: /puzzles/<id> (but not the /puzzles library). */
const PUZZLE_SOLVE_RE = /^\/puzzles\/[^/]+/;

export function getAppMode(pathname: string | null | undefined): AppMode {
  if (!pathname) return "browse";

  if (pathname === "/auth" || pathname.startsWith("/auth/")) return "auth";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";

  // The daily hub is browse; every individual daily puzzle under it is play
  // (/daily/crossword, /daily/sudoku, /daily/word, /daily/word-search,
  // /daily/jigsaw, and any future daily puzzle route).
  if (pathname === "/daily") return "browse";
  if (pathname.startsWith("/daily/")) return "play";

  // Individual puzzle solve pages are play; the /puzzles library is browse.
  if (PUZZLE_SOLVE_RE.test(pathname)) return "play";

  return "browse";
}

export function isPlayMode(pathname: string | null | undefined): boolean {
  return getAppMode(pathname) === "play";
}
