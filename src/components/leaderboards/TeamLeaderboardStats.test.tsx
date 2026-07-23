/** @jest-environment jsdom */
import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import TeamLeaderboardStats from "./TeamLeaderboardStats";
import type { TeamLeaderboardDisplayEntry } from "./TeamLeaderboardList";

const NO_EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const RAW_HEX = /#[0-9a-fA-F]{3,8}\b/;
const RAW_RGB = /rgba?\(/i;

const SOURCE = fs.readFileSync(path.join(__dirname, "TeamLeaderboardStats.tsx"), "utf8");

function makeEntry(overrides: Partial<TeamLeaderboardDisplayEntry> = {}): TeamLeaderboardDisplayEntry {
  return {
    teamId: "t1",
    teamName: "Puzzle Masters",
    isPublic: true,
    bannerColor: "gold",
    totalPoints: 500,
    totalPuzzlesSolved: 10,
    memberCount: 5,
    rank: 1,
    isUserTeam: false,
    ...overrides,
  };
}

describe("TeamLeaderboardStats", () => {
  it("returns null for empty entries", () => {
    const { container } = render(<TeamLeaderboardStats entries={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("Ranked Teams equals entry count", () => {
    const entries = [makeEntry({ teamId: "a" }), makeEntry({ teamId: "b" }), makeEntry({ teamId: "c" })];
    render(<TeamLeaderboardStats entries={entries} />);
    expect(screen.getByText("Ranked Teams")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("Total Points equals exact sum", () => {
    const entries = [makeEntry({ totalPoints: 500 }), makeEntry({ totalPoints: 300 })];
    render(<TeamLeaderboardStats entries={entries} />);
    expect(screen.getByText("800")).toBeTruthy();
  });

  it("Puzzles Solved equals exact sum", () => {
    const entries = [makeEntry({ totalPuzzlesSolved: 10 }), makeEntry({ totalPuzzlesSolved: 15 })];
    render(<TeamLeaderboardStats entries={entries} />);
    expect(screen.getByText("25")).toBeTruthy();
  });

  it("renders correct labels", () => {
    render(<TeamLeaderboardStats entries={[makeEntry()]} />);
    expect(screen.getByText("Ranked Teams")).toBeTruthy();
    expect(screen.getByText("Total Points")).toBeTruthy();
    expect(screen.getByText("Puzzles Solved")).toBeTruthy();
  });

  it("large totals use locale formatting", () => {
    render(<TeamLeaderboardStats entries={[makeEntry({ totalPoints: 123456, totalPuzzlesSolved: 7890 })]} />);
    expect(screen.getByText("123,456")).toBeTruthy();
    expect(screen.getByText("7,890")).toBeTruthy();
  });

  it("values use tabular numerals", () => {
    const { container } = render(<TeamLeaderboardStats entries={[makeEntry()]} />);
    expect(container.querySelectorAll(".tabular-nums").length).toBe(3);
  });

  it("uses UsersRound", () => {
    const { container } = render(<TeamLeaderboardStats entries={[makeEntry()]} />);
    expect(container.querySelector("svg.lucide-users-round")).toBeTruthy();
  });

  it("uses Coins", () => {
    const { container } = render(<TeamLeaderboardStats entries={[makeEntry()]} />);
    expect(container.querySelector("svg.lucide-coins")).toBeTruthy();
  });

  it("uses Puzzle", () => {
    const { container } = render(<TeamLeaderboardStats entries={[makeEntry()]} />);
    expect(container.querySelector("svg.lucide-puzzle")).toBeTruthy();
  });

  it("decorative icons are hidden", () => {
    const { container } = render(<TeamLeaderboardStats entries={[makeEntry()]} />);
    container.querySelectorAll("svg").forEach((icon) => expect(icon.getAttribute("aria-hidden")).toBe("true"));
  });

  it("no fake trend, percentage, or XP", () => {
    render(<TeamLeaderboardStats entries={[makeEntry()]} />);
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.queryByText(/XP/)).toBeNull();
    expect(screen.queryByText(/trend/i)).toBeNull();
  });

  it("no emoji", () => {
    const { container } = render(<TeamLeaderboardStats entries={[makeEntry()]} />);
    expect(NO_EMOJI.test(container.textContent ?? "")).toBe(false);
  });

  it("no raw hex", () => {
    const { container } = render(<TeamLeaderboardStats entries={[makeEntry()]} />);
    expect(RAW_HEX.test(container.innerHTML)).toBe(false);
  });

  it("no raw RGB/RGBA", () => {
    const { container } = render(<TeamLeaderboardStats entries={[makeEntry()]} />);
    expect(RAW_RGB.test(container.innerHTML)).toBe(false);
  });

  it("mobile layout is bounded (grid-cols-1)", () => {
    const { container } = render(<TeamLeaderboardStats entries={[makeEntry()]} />);
    expect(container.firstElementChild?.className).toMatch(/grid-cols-1/);
  });

  it("desktop supports three cards (sm:grid-cols-3)", () => {
    const { container } = render(<TeamLeaderboardStats entries={[makeEntry()]} />);
    expect(container.firstElementChild?.className).toMatch(/sm:grid-cols-3/);
  });

  it("does not mutate entries", () => {
    const entries = [makeEntry({ teamId: "a" }), makeEntry({ teamId: "b" })];
    const snapshot = [...entries];
    render(<TeamLeaderboardStats entries={entries} />);
    expect(entries).toEqual(snapshot);
  });

  it("performs no request", () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    render(<TeamLeaderboardStats entries={[makeEntry()]} />);
    expect(fetchMock).not.toHaveBeenCalled();
    (global as any).fetch = originalFetch;
  });

  it("source contains no hard-coded emoji literal", () => {
    expect(/🥇|🥈|🥉|🏆|📊|🧩/.test(SOURCE)).toBe(false);
  });
});
