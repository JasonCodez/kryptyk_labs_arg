/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import DashboardStatsStrip from "./DashboardStatsStrip";

const EMOJI_PATTERN = /\p{Extended_Pictographic}/u;

function show(overrides: Partial<React.ComponentProps<typeof DashboardStatsStrip>> = {}) {
  return render(
    <DashboardStatsStrip
      puzzlesSolved={42}
      totalPoints={12345}
      activeTeams={3}
      rank={7}
      {...overrides}
    />,
  );
}

describe("DashboardStatsStrip", () => {
  it("renders the Your Progress heading", () => {
    show();
    expect(screen.getByRole("heading", { level: 2, name: "Your Progress" })).toBeTruthy();
  });

  it("renders a labelled statistics section", () => {
    show();
    const section = screen.getByRole("region", { name: "Your Progress" });
    expect(section).toBeTruthy();
    expect(section.id).toBe("tour-stats");
  });

  it("renders exactly four statistic items", () => {
    show();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("shows formatted puzzles solved", () => {
    show({ puzzlesSolved: 1234 });
    expect(screen.getByText("1,234")).toBeTruthy();
    expect(screen.getByText("Puzzles Solved")).toBeTruthy();
  });

  it("shows formatted total points", () => {
    show({ totalPoints: 98765 });
    expect(screen.getByText("98,765")).toBeTruthy();
    expect(screen.getByText("Total Points")).toBeTruthy();
  });

  it("shows formatted active teams", () => {
    show({ activeTeams: 5 });
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("Active Teams")).toBeTruthy();
  });

  it("shows Rank #N when ranked", () => {
    show({ rank: 42 });
    expect(screen.getByText("Rank #42")).toBeTruthy();
  });

  it("shows Unranked when rank is null", () => {
    show({ rank: null });
    expect(screen.getByText("Unranked")).toBeTruthy();
  });

  it("shows zero values correctly", () => {
    show({ puzzlesSolved: 0, totalPoints: 0, activeTeams: 0 });
    expect(screen.getAllByText("0")).toHaveLength(3);
  });

  it("hides all four SVG icons from assistive technology", () => {
    const { container } = show();
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBe(4);
    svgs.forEach((svg) => {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
    });
  });

  it("contains no emoji glyphs", () => {
    const { container } = show();
    expect(EMOJI_PATTERN.test(container.textContent || "")).toBe(false);
  });

  it("contains no buttons or links", () => {
    show();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("renders without animation-related classes or inline animation styles", () => {
    const { container } = show();
    expect(container.innerHTML).not.toMatch(/animation:/);
    expect(container.innerHTML).not.toMatch(/\btransition\b/);
    expect(container.querySelector('[class*="animate-"]')).toBeNull();
  });
});
