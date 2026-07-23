/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import LeaderboardList from "./LeaderboardList";
import type { LeaderboardDisplayEntry } from "./LeaderboardRow";

const NO_EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const RAW_HEX = /#[0-9a-fA-F]{3,8}\b/;
const RAW_RGB = /rgba?\(/i;

function entry(overrides: Partial<LeaderboardDisplayEntry>): LeaderboardDisplayEntry {
  return {
    userId: overrides.userId ?? "u",
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

describe("LeaderboardList — partition and rendering", () => {
  it("renders 'Top competitors' when rank 1 exists", () => {
    render(<LeaderboardList entries={[entry({ userId: "u1", rank: 1 })]} pointsLabel="Earned points" />);
    expect(screen.getByText("Top competitors")).toBeTruthy();
  });

  it("renders rank 1 as featured", () => {
    render(<LeaderboardList entries={[entry({ userId: "u1", rank: 1 })]} pointsLabel="Earned points" />);
    expect(screen.getByText("1st Place")).toBeTruthy();
  });

  it("renders rank 2 as featured", () => {
    render(<LeaderboardList entries={[entry({ userId: "u1", rank: 2 })]} pointsLabel="Earned points" />);
    expect(screen.getByText("2nd Place")).toBeTruthy();
  });

  it("renders rank 3 as featured", () => {
    render(<LeaderboardList entries={[entry({ userId: "u1", rank: 3 })]} pointsLabel="Earned points" />);
    expect(screen.getByText("3rd Place")).toBeTruthy();
  });

  it("renders rank 4 as standard", () => {
    render(<LeaderboardList entries={[entry({ userId: "u1", rank: 4 })]} pointsLabel="Earned points" />);
    expect(screen.getByText("#4")).toBeTruthy();
    expect(screen.queryByText("1st Place")).toBeNull();
  });

  it("does not duplicate rank 1 below the podium", () => {
    render(<LeaderboardList entries={[entry({ userId: "u1", userName: "Solo", rank: 1 })]} pointsLabel="Earned points" />);
    expect(screen.getAllByText("Solo").length).toBe(1);
  });

  it("does not duplicate rank 2 below the podium", () => {
    render(<LeaderboardList entries={[entry({ userId: "u1", userName: "Solo2", rank: 2 })]} pointsLabel="Earned points" />);
    expect(screen.getAllByText("Solo2").length).toBe(1);
  });

  it("does not duplicate rank 3 below the podium", () => {
    render(<LeaderboardList entries={[entry({ userId: "u1", userName: "Solo3", rank: 3 })]} pointsLabel="Earned points" />);
    expect(screen.getAllByText("Solo3").length).toBe(1);
  });

  it("every supplied entry renders exactly once", () => {
    const entries = [
      entry({ userId: "u1", userName: "P1", rank: 1 }),
      entry({ userId: "u2", userName: "P2", rank: 2 }),
      entry({ userId: "u3", userName: "P3", rank: 4 }),
    ];
    render(<LeaderboardList entries={entries} pointsLabel="Earned points" />);
    expect(screen.getAllByText("P1").length).toBe(1);
    expect(screen.getAllByText("P2").length).toBe(1);
    expect(screen.getAllByText("P3").length).toBe(1);
  });

  it("does not infer first place from array index — rank 4 at index zero remains standard", () => {
    render(<LeaderboardList entries={[entry({ userId: "u1", rank: 4 })]} pointsLabel="Earned points" />);
    expect(screen.queryByText("1st Place")).toBeNull();
    expect(screen.getByText("#4")).toBeTruthy();
  });

  it("rank 1 at a later array index remains featured", () => {
    const entries = [
      entry({ userId: "u1", userName: "Later4", rank: 4 }),
      entry({ userId: "u2", userName: "ActuallyFirst", rank: 1 }),
    ];
    render(<LeaderboardList entries={entries} pointsLabel="Earned points" />);
    expect(screen.getByText("1st Place")).toBeTruthy();
    expect(screen.getByText("ActuallyFirst")).toBeTruthy();
  });

  it("preserves relative server order within featured entries", () => {
    const entries = [
      entry({ userId: "u2", userName: "Second", rank: 2 }),
      entry({ userId: "u1", userName: "First", rank: 1 }),
      entry({ userId: "u3", userName: "Third", rank: 3 }),
    ];
    render(<LeaderboardList entries={entries} pointsLabel="Earned points" />);
    const names = screen.getAllByText(/^(Second|First|Third)$/).map((el) => el.textContent);
    expect(names).toEqual(["Second", "First", "Third"]);
  });

  it("preserves relative server order within standard entries", () => {
    const entries = [
      entry({ userId: "u5", userName: "Fifth", rank: 5 }),
      entry({ userId: "u4", userName: "Fourth", rank: 4 }),
    ];
    render(<LeaderboardList entries={entries} pointsLabel="Earned points" />);
    const names = screen.getAllByText(/^(Fifth|Fourth)$/).map((el) => el.textContent);
    expect(names).toEqual(["Fifth", "Fourth"]);
  });

  it("does not call .sort() on the input array", () => {
    const entries = [
      entry({ userId: "u2", rank: 2 }),
      entry({ userId: "u1", rank: 1 }),
    ];
    const sortSpy = jest.spyOn(entries, "sort");
    render(<LeaderboardList entries={entries} pointsLabel="Earned points" />);
    expect(sortSpy).not.toHaveBeenCalled();
  });

  it("one featured entry works", () => {
    render(<LeaderboardList entries={[entry({ userId: "u1", rank: 1 })]} pointsLabel="Earned points" />);
    expect(screen.getAllByText(/Place$/).length).toBe(1);
  });

  it("two featured entries work", () => {
    const entries = [entry({ userId: "u1", rank: 1 }), entry({ userId: "u2", rank: 2 })];
    render(<LeaderboardList entries={entries} pointsLabel="Earned points" />);
    expect(screen.getAllByText(/Place$/).length).toBe(2);
  });

  it("three featured entries work", () => {
    const entries = [entry({ userId: "u1", rank: 1 }), entry({ userId: "u2", rank: 2 }), entry({ userId: "u3", rank: 3 })];
    render(<LeaderboardList entries={entries} pointsLabel="Earned points" />);
    expect(screen.getAllByText(/Place$/).length).toBe(3);
  });

  it("no empty podium placeholder for a missing second/third place", () => {
    render(<LeaderboardList entries={[entry({ userId: "u1", rank: 1 })]} pointsLabel="Earned points" />);
    expect(screen.queryByText("2nd Place")).toBeNull();
    expect(screen.queryByText("3rd Place")).toBeNull();
  });

  it("omits the standard section when there are no standard entries", () => {
    render(<LeaderboardList entries={[entry({ userId: "u1", rank: 1 })]} pointsLabel="Earned points" />);
    expect(screen.queryByText("Rankings")).toBeNull();
  });

  it("omits the featured section when there are no rank 1-3 entries", () => {
    render(<LeaderboardList entries={[entry({ userId: "u1", rank: 4 })]} pointsLabel="Earned points" />);
    expect(screen.queryByText("Top competitors")).toBeNull();
    expect(screen.getByText("Rankings")).toBeTruthy();
  });

  it("passes the Earned points label through", () => {
    render(<LeaderboardList entries={[entry({ userId: "u1", rank: 4 })]} pointsLabel="Earned points" />);
    expect(screen.getByText("Earned points")).toBeTruthy();
  });

  it("passes the Period points label through", () => {
    render(<LeaderboardList entries={[entry({ userId: "u1", rank: 4 })]} pointsLabel="Period points" />);
    expect(screen.getByText("Period points")).toBeTruthy();
  });

  it("passes current-user state through", () => {
    render(<LeaderboardList entries={[entry({ userId: "u1", rank: 4, isCurrentUser: true })]} pointsLabel="Earned points" />);
    expect(screen.getByText("You")).toBeTruthy();
  });

  it("uses list semantics", () => {
    const entries = [entry({ userId: "u1", rank: 1 }), entry({ userId: "u2", rank: 4 })];
    const { container } = render(<LeaderboardList entries={entries} pointsLabel="Earned points" />);
    expect(container.querySelectorAll("ul").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("li").length).toBe(2);
  });

  it("has accessible section labeling", () => {
    const entries = [entry({ userId: "u1", rank: 1 }), entry({ userId: "u2", rank: 4 })];
    const { container } = render(<LeaderboardList entries={entries} pointsLabel="Earned points" />);
    expect(container.querySelectorAll("section[aria-labelledby]").length).toBe(2);
  });

  it("mobile featured grid stacks (grid without forced sm:grid-cols-3 for one entry)", () => {
    const { container } = render(<LeaderboardList entries={[entry({ userId: "u1", rank: 1 })]} pointsLabel="Earned points" />);
    const ul = container.querySelector("#leaderboard-featured-heading + ul");
    expect(ul?.className).toMatch(/grid/);
  });

  it("desktop featured grid supports columns for three entries", () => {
    const entries = [entry({ userId: "u1", rank: 1 }), entry({ userId: "u2", rank: 2 }), entry({ userId: "u3", rank: 3 })];
    const { container } = render(<LeaderboardList entries={entries} pointsLabel="Earned points" />);
    const ul = container.querySelector("#leaderboard-featured-heading + ul");
    expect(ul?.className).toMatch(/sm:grid-cols-3/);
  });

  it("contains no hard-coded emoji", () => {
    const entries = [entry({ userId: "u1", rank: 1 }), entry({ userId: "u2", rank: 4 })];
    const { container } = render(<LeaderboardList entries={entries} pointsLabel="Earned points" />);
    expect(NO_EMOJI.test(container.textContent ?? "")).toBe(false);
  });

  it("contains no raw colors", () => {
    const entries = [entry({ userId: "u1", rank: 1 }), entry({ userId: "u2", rank: 4 })];
    const { container } = render(<LeaderboardList entries={entries} pointsLabel="Earned points" />);
    expect(RAW_HEX.test(container.innerHTML)).toBe(false);
    expect(RAW_RGB.test(container.innerHTML)).toBe(false);
  });

  it("performs no fetch", () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    render(<LeaderboardList entries={[entry({ userId: "u1", rank: 1 })]} pointsLabel="Earned points" />);
    expect(fetchMock).not.toHaveBeenCalled();
    (global as any).fetch = originalFetch;
  });

  it("does not mutate the input array", () => {
    const entries = [entry({ userId: "u2", rank: 2 }), entry({ userId: "u1", rank: 1 })];
    const snapshot = entries.map((e) => e.userId);
    render(<LeaderboardList entries={entries} pointsLabel="Earned points" />);
    expect(entries.map((e) => e.userId)).toEqual(snapshot);
  });

  it("renders an invalid-rank entry exactly once", () => {
    render(<LeaderboardList entries={[entry({ userId: "u1", userName: "Weird", rank: 0 })]} pointsLabel="Earned points" />);
    expect(screen.getAllByText("Weird").length).toBe(1);
    expect(screen.getByText("—")).toBeTruthy();
  });
});
