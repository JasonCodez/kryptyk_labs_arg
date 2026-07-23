/** @jest-environment jsdom */
import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import TeamLeaderboardRankSummary from "./TeamLeaderboardRankSummary";
import type { TeamLeaderboardDisplayEntry } from "./TeamLeaderboardList";

const RAW_HEX = /#[0-9a-fA-F]{3,8}\b/;
const RAW_RGB = /rgba?\(/i;
const NO_EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

const SOURCE = fs.readFileSync(path.join(__dirname, "TeamLeaderboardRankSummary.tsx"), "utf8");

function makeEntry(overrides: Partial<TeamLeaderboardDisplayEntry> = {}): TeamLeaderboardDisplayEntry {
  return {
    teamId: "team-1",
    teamName: "Puzzle Masters",
    isPublic: true,
    bannerColor: "gold",
    totalPoints: 4250,
    totalPuzzlesSolved: 142,
    memberCount: 8,
    rank: 4,
    isUserTeam: true,
    ...overrides,
  };
}

describe("TeamLeaderboardRankSummary — ranked state", () => {
  it("section is named 'Your Team Rank'", () => {
    render(<TeamLeaderboardRankSummary entry={makeEntry()} />);
    expect(screen.getByText("Your Team Rank")).toBeTruthy();
  });

  it("displays 'Your Team'", () => {
    render(<TeamLeaderboardRankSummary entry={makeEntry()} />);
    expect(screen.getByText("Your Team")).toBeTruthy();
  });

  it("displays the team name", () => {
    render(<TeamLeaderboardRankSummary entry={makeEntry({ teamName: "Puzzle Masters" })} />);
    expect(screen.getByText("Puzzle Masters")).toBeTruthy();
  });

  it("null name becomes Unnamed Team", () => {
    render(<TeamLeaderboardRankSummary entry={makeEntry({ teamName: null })} />);
    expect(screen.getByText("Unnamed Team")).toBeTruthy();
  });

  it("rank displays #4", () => {
    render(<TeamLeaderboardRankSummary entry={makeEntry({ rank: 4 })} />);
    expect(screen.getByText("#4")).toBeTruthy();
  });

  it("invalid rank displays —", () => {
    render(<TeamLeaderboardRankSummary entry={makeEntry({ rank: 0 })} />);
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("team points render exactly", () => {
    render(<TeamLeaderboardRankSummary entry={makeEntry({ totalPoints: 9876 })} />);
    expect(screen.getByText("9,876")).toBeTruthy();
  });

  it("members render exactly", () => {
    render(<TeamLeaderboardRankSummary entry={makeEntry({ memberCount: 8 })} />);
    expect(screen.getByText(/8 members/)).toBeTruthy();
  });

  it("puzzles solved render exactly", () => {
    render(<TeamLeaderboardRankSummary entry={makeEntry({ totalPuzzlesSolved: 142 })} />);
    expect(screen.getByText(/142 puzzles solved/)).toBeTruthy();
  });

  it("singular member grammar", () => {
    render(<TeamLeaderboardRankSummary entry={makeEntry({ memberCount: 1 })} />);
    expect(screen.getByText(/1 member\b/)).toBeTruthy();
  });

  it("plural member grammar", () => {
    render(<TeamLeaderboardRankSummary entry={makeEntry({ memberCount: 2 })} />);
    expect(screen.getByText(/2 members/)).toBeTruthy();
  });

  it("singular puzzle grammar", () => {
    render(<TeamLeaderboardRankSummary entry={makeEntry({ totalPuzzlesSolved: 1 })} />);
    expect(screen.getByText(/1 puzzle solved/)).toBeTruthy();
  });

  it("plural puzzle grammar", () => {
    render(<TeamLeaderboardRankSummary entry={makeEntry({ totalPuzzlesSolved: 2 })} />);
    expect(screen.getByText(/2 puzzles solved/)).toBeTruthy();
  });

  it("public badge renders", () => {
    render(<TeamLeaderboardRankSummary entry={makeEntry({ isPublic: true })} />);
    expect(screen.getByText("Public")).toBeTruthy();
  });

  it("private badge renders", () => {
    render(<TeamLeaderboardRankSummary entry={makeEntry({ isPublic: false })} />);
    expect(screen.getByText("Private")).toBeTruthy();
  });

  it("private badge uses Lock", () => {
    const { container } = render(<TeamLeaderboardRankSummary entry={makeEntry({ isPublic: false })} />);
    expect(container.querySelector("svg.lucide-lock")).toBeTruthy();
  });

  it("current-team name links to exact /teams/[teamId]", () => {
    render(<TeamLeaderboardRankSummary entry={makeEntry({ teamId: "abc123" })} />);
    expect(screen.getByRole("link", { name: /Puzzle Masters/ }).getAttribute("href")).toBe("/teams/abc123");
  });

  it("empty ID renders no team link", () => {
    render(<TeamLeaderboardRankSummary entry={makeEntry({ teamId: "" })} />);
    expect(screen.queryByRole("link", { name: /Puzzle Masters/ })).toBeNull();
    expect(screen.getByText("Puzzle Masters")).toBeTruthy();
  });

  it("empty ID summary still shows Private/Public, rank, and metrics with no /teams/ route", () => {
    const { container } = render(<TeamLeaderboardRankSummary entry={makeEntry({ teamId: "", isPublic: false, rank: 4, totalPoints: 4250 })} />);
    expect(screen.getByText("Private")).toBeTruthy();
    expect(screen.getByText("#4")).toBeTruthy();
    expect(screen.getByText("4,250")).toBeTruthy();
    expect(container.innerHTML).not.toMatch(/\/teams\//);
  });

  it("whitespace-only ID renders no team link", () => {
    render(<TeamLeaderboardRankSummary entry={makeEntry({ teamId: "   " })} />);
    expect(screen.queryByRole("link", { name: /Puzzle Masters/ })).toBeNull();
    expect(screen.getByText("Puzzle Masters")).toBeTruthy();
  });

  it("whitespace-only ID summary still shows badge, rank, and metrics with no /teams/ route", () => {
    const { container } = render(<TeamLeaderboardRankSummary entry={makeEntry({ teamId: "   ", isPublic: true, rank: 2, totalPoints: 900 })} />);
    expect(screen.getByText("Public")).toBeTruthy();
    expect(screen.getByText("#2")).toBeTruthy();
    expect(screen.getByText("900")).toBeTruthy();
    expect(container.innerHTML).not.toMatch(/\/teams\//);
  });

  it("link has at least a 44px target class", () => {
    render(<TeamLeaderboardRankSummary entry={makeEntry()} />);
    expect(screen.getByRole("link", { name: /Puzzle Masters/ }).className).toMatch(/min-h-11/);
  });

  it("long name uses bounded/wrapping classes", () => {
    const longName = "A".repeat(80);
    render(<TeamLeaderboardRankSummary entry={makeEntry({ teamName: longName })} />);
    expect(screen.getByText(longName).className).toMatch(/break-words/);
  });

  it("metrics use tabular numerals", () => {
    const { container } = render(<TeamLeaderboardRankSummary entry={makeEntry()} />);
    expect(container.querySelectorAll(".tabular-nums").length).toBeGreaterThan(0);
  });

  it("performs no fetch", () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    render(<TeamLeaderboardRankSummary entry={makeEntry()} />);
    expect(fetchMock).not.toHaveBeenCalled();
    (global as any).fetch = originalFetch;
  });
});

describe("TeamLeaderboardRankSummary — null (unranked) state", () => {
  it("displays Not ranked", () => {
    render(<TeamLeaderboardRankSummary entry={null} />);
    expect(screen.getByText("Not ranked")).toBeTruthy();
  });

  it("displays safe support copy", () => {
    render(<TeamLeaderboardRankSummary entry={null} />);
    expect(screen.getByText("Join or create a team to compete in the team rankings.")).toBeTruthy();
  });

  it("displays Explore Teams", () => {
    render(<TeamLeaderboardRankSummary entry={null} />);
    expect(screen.getByText("Explore Teams")).toBeTruthy();
  });

  it("Explore Teams links to /teams", () => {
    render(<TeamLeaderboardRankSummary entry={null} />);
    expect(screen.getByRole("link", { name: /Explore Teams/ }).getAttribute("href")).toBe("/teams");
  });

  it("Explore Teams target is at least 44px", () => {
    render(<TeamLeaderboardRankSummary entry={null} />);
    expect(screen.getByRole("link", { name: /Explore Teams/ }).className).toMatch(/min-h-11/);
  });

  it("does not render #0", () => {
    render(<TeamLeaderboardRankSummary entry={null} />);
    expect(screen.queryByText("#0")).toBeNull();
  });

  it("still shows the section title", () => {
    render(<TeamLeaderboardRankSummary entry={null} />);
    expect(screen.getByText("Your Team Rank")).toBeTruthy();
  });
});

describe("TeamLeaderboardRankSummary — no legacy decoration", () => {
  it("no hard-coded emoji", () => {
    const { container } = render(<TeamLeaderboardRankSummary entry={makeEntry()} />);
    expect(NO_EMOJI.test(container.textContent ?? "")).toBe(false);
  });

  it("no raw hex colors", () => {
    const { container } = render(<TeamLeaderboardRankSummary entry={makeEntry()} />);
    expect(RAW_HEX.test(container.innerHTML)).toBe(false);
  });

  it("no raw RGB/RGBA colors", () => {
    const { container } = render(<TeamLeaderboardRankSummary entry={makeEntry()} />);
    expect(RAW_RGB.test(container.innerHTML)).toBe(false);
  });

  it("source contains no hard-coded emoji literal", () => {
    expect(/🥇|🥈|🥉|🏆|📊|🧩/.test(SOURCE)).toBe(false);
  });
});
