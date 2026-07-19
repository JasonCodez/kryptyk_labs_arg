import { getAppMode, isPlayMode } from "./appMode";

describe("getAppMode", () => {
  test("browse: marketing/library/hub pages", () => {
    expect(getAppMode("/")).toBe("browse");
    expect(getAppMode("/daily")).toBe("browse");
    expect(getAppMode("/puzzles")).toBe("browse");
    expect(getAppMode("/leaderboards")).toBe("browse");
    expect(getAppMode("/profile")).toBe("browse");
    expect(getAppMode("/dashboard")).toBe("browse");
  });

  test("play: single-segment daily puzzle routes", () => {
    expect(getAppMode("/daily/crossword")).toBe("play");
    expect(getAppMode("/daily/sudoku")).toBe("play");
    expect(getAppMode("/daily/word")).toBe("play");
    expect(getAppMode("/daily/word-search")).toBe("play");
    expect(getAppMode("/daily/jigsaw")).toBe("play");
    // Any future single-segment daily route is play by the same rule.
    expect(getAppMode("/daily/anagram")).toBe("play");
  });

  test("play: Rookie Run starter puzzle", () => {
    expect(getAppMode("/rookie-run")).toBe("play");
  });

  test("play: generic /puzzles/<id> solve route", () => {
    expect(getAppMode("/puzzles/abc123")).toBe("play");
    expect(getAppMode("/puzzles/cmrjm3acz0006pcu4va7e4iuh")).toBe("play");
  });

  test("auth: sign in / register / password flows", () => {
    expect(getAppMode("/auth")).toBe("auth");
    expect(getAppMode("/auth/signin")).toBe("auth");
    expect(getAppMode("/auth/register")).toBe("auth");
    expect(getAppMode("/auth/reset-password")).toBe("auth");
  });

  test("admin: admin tooling", () => {
    expect(getAppMode("/admin")).toBe("admin");
    expect(getAppMode("/admin/waitlist")).toBe("admin");
    expect(getAppMode("/admin/reports")).toBe("admin");
  });

  test("unrelated nested routes under /puzzles are not swept into play", () => {
    // Browse: filtered puzzle-type listing, not a solve screen.
    expect(getAppMode("/puzzles/type/riddle")).toBe("browse");
    // Browse: a team-planning redirect stub nested under /puzzles/<id>/, not the solve screen.
    expect(getAppMode("/puzzles/abc123/planning")).toBe("browse");
    // Defensive: even a bare /puzzles/type (no further segment) must not be treated as an id.
    expect(getAppMode("/puzzles/type")).toBe("browse");
  });

  test("unrelated nested routes under /daily are not swept into play", () => {
    expect(getAppMode("/daily/crossword/extra")).toBe("browse");
  });

  test("edge cases", () => {
    expect(getAppMode(null)).toBe("browse");
    expect(getAppMode(undefined)).toBe("browse");
    expect(getAppMode("")).toBe("browse");
    expect(getAppMode("/coming-soon")).toBe("browse");
  });
});

describe("isPlayMode", () => {
  test("mirrors getAppMode === 'play'", () => {
    expect(isPlayMode("/daily/crossword")).toBe(true);
    expect(isPlayMode("/puzzles/abc123")).toBe(true);
    expect(isPlayMode("/daily")).toBe(false);
    expect(isPlayMode("/puzzles")).toBe(false);
    expect(isPlayMode("/puzzles/type/riddle")).toBe(false);
    expect(isPlayMode("/")).toBe(false);
  });
});
