/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import LeaderboardStats from "./LeaderboardStats";
import type { LeaderboardDisplayEntry } from "./LeaderboardRow";

const NO_EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const RAW_HEX = /#[0-9a-fA-F]{3,8}\b/;
const RAW_RGB = /rgba?\(/i;

function entry(overrides: Partial<LeaderboardDisplayEntry>): LeaderboardDisplayEntry {
  return {
    userId: "u",
    userName: "Player",
    userImage: null,
    activeFlair: "none",
    isPremium: false,
    points: 100,
    puzzlesSolved: 5,
    rank: 1,
    isCurrentUser: false,
    ...overrides,
  };
}

describe("LeaderboardStats", () => {
  it("renders nothing for empty entries", () => {
    const { container } = render(<LeaderboardStats entries={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("Top Players equals entries length", () => {
    const entries = [entry({ userId: "u1" }), entry({ userId: "u2" }), entry({ userId: "u3" })];
    render(<LeaderboardStats entries={entries} />);
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("Total Points equals exact sum", () => {
    const entries = [entry({ userId: "u1", points: 500 }), entry({ userId: "u2", points: 300 })];
    render(<LeaderboardStats entries={entries} />);
    expect(screen.getByText("800")).toBeTruthy();
  });

  it("Puzzles Solved equals exact sum", () => {
    const entries = [entry({ userId: "u1", puzzlesSolved: 10 }), entry({ userId: "u2", puzzlesSolved: 7 })];
    render(<LeaderboardStats entries={entries} />);
    expect(screen.getByText("17")).toBeTruthy();
  });

  it("exact labels render", () => {
    render(<LeaderboardStats entries={[entry({ userId: "u1" })]} />);
    expect(screen.getByText("Top Players")).toBeTruthy();
    expect(screen.getByText("Total Points")).toBeTruthy();
    expect(screen.getByText("Puzzles Solved")).toBeTruthy();
  });

  it("large totals use locale formatting", () => {
    const entries = [entry({ userId: "u1", points: 1234567 })];
    render(<LeaderboardStats entries={entries} />);
    expect(screen.getByText("1,234,567")).toBeTruthy();
  });

  it("uses tabular numerals", () => {
    const { container } = render(<LeaderboardStats entries={[entry({ userId: "u1" })]} />);
    expect(container.querySelectorAll(".tabular-nums").length).toBeGreaterThan(0);
  });

  it("uses UsersRound (lucide-users-round)", () => {
    const { container } = render(<LeaderboardStats entries={[entry({ userId: "u1" })]} />);
    expect(container.querySelector("svg.lucide-users-round")).toBeTruthy();
  });

  it("uses Coins (lucide-coins)", () => {
    const { container } = render(<LeaderboardStats entries={[entry({ userId: "u1" })]} />);
    expect(container.querySelector("svg.lucide-coins")).toBeTruthy();
  });

  it("uses Puzzle (lucide-puzzle)", () => {
    const { container } = render(<LeaderboardStats entries={[entry({ userId: "u1" })]} />);
    expect(container.querySelector("svg.lucide-puzzle")).toBeTruthy();
  });

  it("decorative icons are hidden", () => {
    const { container } = render(<LeaderboardStats entries={[entry({ userId: "u1" })]} />);
    container.querySelectorAll("svg").forEach((icon) => expect(icon.getAttribute("aria-hidden")).toBe("true"));
  });

  it("no fake trend indicator", () => {
    const { container } = render(<LeaderboardStats entries={[entry({ userId: "u1" })]} />);
    expect(/[▲▼↑↓]/.test(container.textContent ?? "")).toBe(false);
  });

  it("no percentage shown", () => {
    const { container } = render(<LeaderboardStats entries={[entry({ userId: "u1" })]} />);
    expect((container.textContent ?? "").includes("%")).toBe(false);
  });

  it("no XP mentioned", () => {
    const { container } = render(<LeaderboardStats entries={[entry({ userId: "u1" })]} />);
    expect((container.textContent ?? "").includes("XP")).toBe(false);
  });

  it("contains no hard-coded emoji", () => {
    const { container } = render(<LeaderboardStats entries={[entry({ userId: "u1" })]} />);
    expect(NO_EMOJI.test(container.textContent ?? "")).toBe(false);
  });

  it("contains no raw hex", () => {
    const { container } = render(<LeaderboardStats entries={[entry({ userId: "u1" })]} />);
    expect(RAW_HEX.test(container.innerHTML)).toBe(false);
  });

  it("contains no raw RGBA", () => {
    const { container } = render(<LeaderboardStats entries={[entry({ userId: "u1" })]} />);
    expect(RAW_RGB.test(container.innerHTML)).toBe(false);
  });

  it("mobile grid is bounded (min-w-0)", () => {
    const { container } = render(<LeaderboardStats entries={[entry({ userId: "u1" })]} />);
    expect(container.firstElementChild?.className).toMatch(/min-w-0/);
  });

  it("desktop grid supports three cards (sm:grid-cols-3)", () => {
    const { container } = render(<LeaderboardStats entries={[entry({ userId: "u1" })]} />);
    expect(container.firstElementChild?.className).toMatch(/sm:grid-cols-3/);
  });

  it("performs no request", () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    render(<LeaderboardStats entries={[entry({ userId: "u1" })]} />);
    expect(fetchMock).not.toHaveBeenCalled();
    (global as any).fetch = originalFetch;
  });

  it("does not mutate entries", () => {
    const entries = [entry({ userId: "u1" }), entry({ userId: "u2" })];
    const snapshot = entries.map((e) => e.userId);
    render(<LeaderboardStats entries={entries} />);
    expect(entries.map((e) => e.userId)).toEqual(snapshot);
  });
});
