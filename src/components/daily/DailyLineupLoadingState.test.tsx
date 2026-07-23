/** @jest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import DailyLineupLoadingState from "./DailyLineupLoadingState";

afterEach(cleanup);

describe("DailyLineupLoadingState", () => {
  it("has exactly one loading announcement", () => {
    render(<DailyLineupLoadingState />);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toBe("Loading today’s puzzles…");
  });

  it("keeps the real heading readable and static", () => {
    render(<DailyLineupLoadingState />);
    const heading = screen.getByRole("heading", { name: "Today’s Challenges" });
    expect(heading.classList.contains("motion-safe:animate-pulse")).toBe(false);
    expect(heading.hasAttribute("data-skeleton")).toBe(false);
  });

  it("preserves progress, recommendation, and six-card geometry", () => {
    const { container } = render(<DailyLineupLoadingState />);
    expect(screen.getByTestId("daily-lineup-loading-grid").children).toHaveLength(6);
    expect(container.querySelectorAll("[data-skeleton='true']")).toHaveLength(37);
    expect([...screen.getByTestId("daily-lineup-loading-grid").classList]).toEqual(
      expect.arrayContaining(["md:grid-cols-2", "lg:grid-cols-3"]),
    );
  });

  it("uses shared motion-safe skeleton shapes", () => {
    const { container } = render(<DailyLineupLoadingState />);
    for (const shape of container.querySelectorAll("[data-skeleton='true']")) {
      expect([...shape.classList]).toEqual(expect.arrayContaining(["motion-safe:animate-pulse", "motion-reduce:animate-none"]));
      expect(shape.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("contains no fake data, raw colors, emoji, buttons, links, or requests", () => {
    const fetchMock = jest.fn();
    const originalFetch = global.fetch;
    global.fetch = fetchMock;
    const { container } = render(<DailyLineupLoadingState />);
    expect(container.innerHTML).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(/i);
    expect(container.textContent).not.toMatch(/\b\d+\b|[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    global.fetch = originalFetch;
  });
});
