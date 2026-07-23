/** @jest-environment jsdom */
import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import TeamLeaderboardList, {
  getTeamDisplayName,
  getTeamInitials,
  formatTeamMetric,
  getTeamBannerAccent,
  type TeamLeaderboardDisplayEntry,
} from "./TeamLeaderboardList";

const NO_EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const RAW_HEX = /#[0-9a-fA-F]{3,8}\b/;
const RAW_RGB = /rgba?\(/i;

const SOURCE = fs.readFileSync(path.join(__dirname, "TeamLeaderboardList.tsx"), "utf8");

function makeEntry(overrides: Partial<TeamLeaderboardDisplayEntry> = {}): TeamLeaderboardDisplayEntry {
  return {
    teamId: "t1",
    teamName: "Puzzle Masters",
    isPublic: true,
    bannerColor: "gold",
    totalPoints: 4250,
    totalPuzzlesSolved: 142,
    memberCount: 8,
    rank: 4,
    isUserTeam: false,
    ...overrides,
  };
}

describe("TeamLeaderboardList — helpers", () => {
  it("getTeamDisplayName trims a valid name", () => {
    expect(getTeamDisplayName("  Puzzle Masters  ")).toBe("Puzzle Masters");
  });

  it("null name becomes Unnamed Team", () => {
    expect(getTeamDisplayName(null)).toBe("Unnamed Team");
  });

  it("empty name becomes Unnamed Team", () => {
    expect(getTeamDisplayName("")).toBe("Unnamed Team");
  });

  it("whitespace name becomes Unnamed Team", () => {
    expect(getTeamDisplayName("   ")).toBe("Unnamed Team");
  });

  it("two-word initials", () => {
    expect(getTeamInitials("Puzzle Masters")).toBe("PM");
  });

  it("one-word initials", () => {
    expect(getTeamInitials("Solvers")).toBe("S");
  });

  it("collapses extra whitespace for initials", () => {
    expect(getTeamInitials("  Puzzle   Masters  ")).toBe("PM");
  });

  it("empty-name initials become T", () => {
    expect(getTeamInitials(null)).toBe("T");
    expect(getTeamInitials("")).toBe("T");
  });

  it("formats a valid metric with locale formatting", () => {
    expect(formatTeamMetric(0)).toBe("0");
    expect(formatTeamMetric(1200)).toBe("1,200");
  });

  it("invalid metrics become —", () => {
    expect(formatTeamMetric(-5)).toBe("—");
    expect(formatTeamMetric(Number.NaN)).toBe("—");
    expect(formatTeamMetric(Infinity)).toBe("—");
    expect(formatTeamMetric(-Infinity)).toBe("—");
  });

  it("gold banner maps to semantic warning", () => {
    expect(getTeamBannerAccent("gold")).toBe("var(--pw-warning)");
    expect(getTeamBannerAccent("Gold")).toBe("var(--pw-warning)");
  });

  it("crimson banner maps to semantic error", () => {
    expect(getTeamBannerAccent("crimson")).toBe("var(--pw-error-text)");
    expect(getTeamBannerAccent(" CRIMSON ")).toBe("var(--pw-error-text)");
  });

  it("neon banner maps to semantic brand", () => {
    expect(getTeamBannerAccent("neon")).toBe("var(--pw-brand-primary)");
  });

  it("none maps to semantic fallback", () => {
    expect(getTeamBannerAccent("none")).toBe("var(--pw-text-secondary)");
  });

  it("unknown banner maps to semantic fallback", () => {
    expect(getTeamBannerAccent("mystery")).toBe("var(--pw-text-secondary)");
  });

  it("object/null banner input does not throw and falls back", () => {
    expect(() => getTeamBannerAccent(null)).not.toThrow();
    expect(() => getTeamBannerAccent({})).not.toThrow();
    expect(() => getTeamBannerAccent(undefined)).not.toThrow();
    expect(getTeamBannerAccent(null)).toBe("var(--pw-text-secondary)");
    expect(getTeamBannerAccent({})).toBe("var(--pw-text-secondary)");
  });
});

describe("TeamLeaderboardList — partition behavior", () => {
  it("rank 1, 2, 3 all appear in Top teams", () => {
    const entries = [makeEntry({ teamId: "a", rank: 1 }), makeEntry({ teamId: "b", rank: 2 }), makeEntry({ teamId: "c", rank: 3 })];
    render(<TeamLeaderboardList entries={entries} />);
    expect(screen.getByText("Top teams")).toBeTruthy();
    expect(screen.getByText("1st Place")).toBeTruthy();
    expect(screen.getByText("2nd Place")).toBeTruthy();
    expect(screen.getByText("3rd Place")).toBeTruthy();
  });

  it("rank 4 appears in Rankings", () => {
    render(<TeamLeaderboardList entries={[makeEntry({ rank: 4 })]} />);
    expect(screen.getByText("Rankings")).toBeTruthy();
    expect(screen.getByText("#4")).toBeTruthy();
  });

  it("every supplied entry renders exactly once", () => {
    const entries = [
      makeEntry({ teamId: "a", rank: 1 }),
      makeEntry({ teamId: "b", rank: 2 }),
      makeEntry({ teamId: "c", rank: 4 }),
    ];
    const { container } = render(<TeamLeaderboardList entries={entries} />);
    expect(container.querySelectorAll("li").length).toBe(3);
  });

  it("rank 4 at index zero remains standard even when rank 1 follows", () => {
    const entries = [makeEntry({ teamId: "a", rank: 4, teamName: "Fourth" }), makeEntry({ teamId: "b", rank: 1, teamName: "First" })];
    render(<TeamLeaderboardList entries={entries} />);
    const rankingsSection = screen.getByText("Rankings").closest("section")!;
    expect(rankingsSection.textContent).toContain("Fourth");
    const featuredSection = screen.getByText("Top teams").closest("section")!;
    expect(featuredSection.textContent).toContain("First");
  });

  it("preserves featured relative order", () => {
    const entries = [makeEntry({ teamId: "b", rank: 2, teamName: "Second" }), makeEntry({ teamId: "a", rank: 1, teamName: "First" })];
    render(<TeamLeaderboardList entries={entries} />);
    const names = screen.getAllByText(/First|Second/).map((el) => el.textContent);
    expect(names).toEqual(["Second", "First"]);
  });

  it("preserves standard relative order", () => {
    const entries = [makeEntry({ teamId: "b", rank: 5, teamName: "Fifth" }), makeEntry({ teamId: "a", rank: 4, teamName: "Fourth" })];
    render(<TeamLeaderboardList entries={entries} />);
    const names = screen.getAllByText(/Fifth|Fourth/).map((el) => el.textContent);
    expect(names).toEqual(["Fifth", "Fourth"]);
  });

  it("does not mutate the input array", () => {
    const entries = [makeEntry({ teamId: "a", rank: 2 }), makeEntry({ teamId: "b", rank: 1 })];
    const snapshot = [...entries];
    render(<TeamLeaderboardList entries={entries} />);
    expect(entries).toEqual(snapshot);
  });

  it("does not call .sort() on the input array", () => {
    const entries = [makeEntry({ teamId: "a", rank: 2 }), makeEntry({ teamId: "b", rank: 1 })];
    const sortSpy = jest.spyOn(entries, "sort");
    render(<TeamLeaderboardList entries={entries} />);
    expect(sortSpy).not.toHaveBeenCalled();
  });

  it("invalid-rank entry renders once, in Rankings", () => {
    render(<TeamLeaderboardList entries={[makeEntry({ rank: 0 })]} />);
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("Rankings")).toBeTruthy();
  });

  it("one featured entry works with no fabricated placeholders", () => {
    const { container } = render(<TeamLeaderboardList entries={[makeEntry({ rank: 1 })]} />);
    expect(container.querySelectorAll('[id="team-leaderboard-featured-heading"] ~ ul li, section ul li').length).toBeGreaterThan(0);
    expect(screen.queryByText("2nd Place")).toBeNull();
    expect(screen.queryByText("3rd Place")).toBeNull();
  });

  it("two featured entries work with no fabricated third place", () => {
    render(<TeamLeaderboardList entries={[makeEntry({ teamId: "a", rank: 1 }), makeEntry({ teamId: "b", rank: 2 })]} />);
    expect(screen.getByText("1st Place")).toBeTruthy();
    expect(screen.getByText("2nd Place")).toBeTruthy();
    expect(screen.queryByText("3rd Place")).toBeNull();
  });

  it("featured section is omitted when none exist", () => {
    render(<TeamLeaderboardList entries={[makeEntry({ rank: 4 })]} />);
    expect(screen.queryByText("Top teams")).toBeNull();
  });

  it("standard section is omitted when none exist", () => {
    render(<TeamLeaderboardList entries={[makeEntry({ rank: 1 })]} />);
    expect(screen.queryByText("Rankings")).toBeNull();
  });
});

describe("TeamLeaderboardList — team presentation", () => {
  it("rank 1 uses Crown", () => {
    const { container } = render(<TeamLeaderboardList entries={[makeEntry({ rank: 1 })]} />);
    expect(container.querySelector("svg.lucide-crown")).toBeTruthy();
  });

  it("rank 2 uses Medal", () => {
    const { container } = render(<TeamLeaderboardList entries={[makeEntry({ rank: 2 })]} />);
    expect(container.querySelector("svg.lucide-medal")).toBeTruthy();
  });

  it("rank 3 uses Award", () => {
    const { container } = render(<TeamLeaderboardList entries={[makeEntry({ rank: 3 })]} />);
    expect(container.querySelector("svg.lucide-award")).toBeTruthy();
  });

  it("placement icons are decorative", () => {
    const { container } = render(<TeamLeaderboardList entries={[makeEntry({ rank: 1 })]} />);
    container.querySelectorAll("svg").forEach((icon) => expect(icon.getAttribute("aria-hidden")).toBe("true"));
  });

  it("public team links to the exact team route", () => {
    render(<TeamLeaderboardList entries={[makeEntry({ teamId: "abc123", isPublic: true, rank: 4 })]} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/teams/abc123");
  });

  it("private non-user team has no team link", () => {
    render(<TeamLeaderboardList entries={[makeEntry({ isPublic: false, isUserTeam: false, rank: 4 })]} />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("private current-user team may link", () => {
    render(<TeamLeaderboardList entries={[makeEntry({ teamId: "mine", isPublic: false, isUserTeam: true, rank: 4 })]} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/teams/mine");
  });

  it("Private text is visible", () => {
    render(<TeamLeaderboardList entries={[makeEntry({ isPublic: false, rank: 4 })]} />);
    expect(screen.getByText("Private")).toBeTruthy();
  });

  it("Public text is visible", () => {
    render(<TeamLeaderboardList entries={[makeEntry({ isPublic: true, rank: 4 })]} />);
    expect(screen.getByText("Public")).toBeTruthy();
  });

  it("Your team text is visible for the current team", () => {
    render(<TeamLeaderboardList entries={[makeEntry({ isUserTeam: true, rank: 4 })]} />);
    expect(screen.getByText("Your team")).toBeTruthy();
  });

  it("non-current team omits Your team", () => {
    render(<TeamLeaderboardList entries={[makeEntry({ isUserTeam: false, rank: 4 })]} />);
    expect(screen.queryByText("Your team")).toBeNull();
  });

  it("team points render exactly", () => {
    render(<TeamLeaderboardList entries={[makeEntry({ totalPoints: 9876, rank: 4 })]} />);
    expect(screen.getByText("9,876")).toBeTruthy();
  });

  it("member total renders", () => {
    render(<TeamLeaderboardList entries={[makeEntry({ memberCount: 8, rank: 4 })]} />);
    expect(screen.getAllByText(/8 members/).length).toBeGreaterThan(0);
  });

  it("puzzle total renders", () => {
    render(<TeamLeaderboardList entries={[makeEntry({ totalPuzzlesSolved: 142, rank: 4 })]} />);
    expect(screen.getAllByText(/142 puzzles solved/).length).toBeGreaterThan(0);
  });

  it("singular member grammar", () => {
    render(<TeamLeaderboardList entries={[makeEntry({ memberCount: 1, rank: 4 })]} />);
    expect(screen.getAllByText(/1 member\b/).length).toBeGreaterThan(0);
  });

  it("singular puzzle grammar", () => {
    render(<TeamLeaderboardList entries={[makeEntry({ totalPuzzlesSolved: 1, rank: 4 })]} />);
    expect(screen.getAllByText(/1 puzzle solved/).length).toBeGreaterThan(0);
  });

  it("initial emblem renders", () => {
    render(<TeamLeaderboardList entries={[makeEntry({ teamName: "Puzzle Masters", rank: 4 })]} />);
    expect(screen.getByText("PM")).toBeTruthy();
  });

  it("long name remains bounded", () => {
    const longName = "A".repeat(80);
    render(<TeamLeaderboardList entries={[makeEntry({ teamName: longName, rank: 4 })]} />);
    expect(screen.getByText(longName).className).toMatch(/break-words/);
  });

  it("empty team ID creates no broken route", () => {
    render(<TeamLeaderboardList entries={[makeEntry({ teamId: "", isPublic: true, rank: 4 })]} />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("uses list semantics", () => {
    const { container } = render(<TeamLeaderboardList entries={[makeEntry({ rank: 4 })]} />);
    expect(container.querySelector("ul")).toBeTruthy();
    expect(container.querySelector("li")).toBeTruthy();
  });

  it("identity target is at least 44px (min-h-11)", () => {
    render(<TeamLeaderboardList entries={[makeEntry({ isPublic: true, rank: 4 })]} />);
    expect(screen.getByRole("link").className).toMatch(/min-h-11/);
  });

  it("no nested interactive controls", () => {
    render(<TeamLeaderboardList entries={[makeEntry({ isPublic: true, rank: 4 })]} />);
    const link = screen.getByRole("link");
    expect(link.querySelectorAll("a,button").length).toBe(0);
  });

  it("performs no fetch", () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    render(<TeamLeaderboardList entries={[makeEntry({ rank: 4 })]} />);
    expect(fetchMock).not.toHaveBeenCalled();
    (global as any).fetch = originalFetch;
  });

  it("performs no programmatic navigation", () => {
    const pushSpy = jest.spyOn(window.history, "pushState");
    render(<TeamLeaderboardList entries={[makeEntry({ rank: 4 })]} />);
    expect(pushSpy).not.toHaveBeenCalled();
    pushSpy.mockRestore();
  });

  it("contains no hard-coded medal emoji", () => {
    render(<TeamLeaderboardList entries={[makeEntry({ rank: 1 })]} />);
    expect(/🥇|🥈|🥉/.test(document.body.textContent ?? "")).toBe(false);
  });

  it("contains no trophy emoji", () => {
    render(<TeamLeaderboardList entries={[makeEntry({ rank: 1 })]} />);
    expect((document.body.textContent ?? "").includes("🏆")).toBe(false);
  });

  it("contains no emoji at all outside server data", () => {
    const { container } = render(<TeamLeaderboardList entries={[makeEntry({ rank: 1 })]} />);
    expect(NO_EMOJI.test(container.textContent ?? "")).toBe(false);
  });

  it("contains no raw hex colors", () => {
    const { container } = render(<TeamLeaderboardList entries={[makeEntry({ rank: 1 })]} />);
    expect(RAW_HEX.test(container.innerHTML)).toBe(false);
  });

  it("contains no raw RGB/RGBA colors", () => {
    const { container } = render(<TeamLeaderboardList entries={[makeEntry({ rank: 1 })]} />);
    expect(RAW_RGB.test(container.innerHTML)).toBe(false);
  });

  it("source contains no hard-coded emoji literal", () => {
    expect(/🥇|🥈|🥉|🏆|📊|🧩/.test(SOURCE)).toBe(false);
  });
});
