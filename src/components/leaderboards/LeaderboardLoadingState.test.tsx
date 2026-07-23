/** @jest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import LeaderboardLoadingState from "./LeaderboardLoadingState";

afterEach(cleanup);

describe("LeaderboardLoadingState", () => {
  it("has exactly one static loading announcement", () => {
    render(<LeaderboardLoadingState activeTab="global" />);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    const message = screen.getByText("Loading leaderboard");
    expect(message.classList.contains("motion-safe:animate-pulse")).toBe(false);
  });

  it.each(["weekly", "monthly"] as const)("%s preserves period context", (activeTab) => {
    const { container } = render(<LeaderboardLoadingState activeTab={activeTab} />);
    expect(container.querySelector(".sm\\:grid-cols-\\[220px_1fr\\]")).toBeTruthy();
    expect(container.querySelectorAll("[data-skeleton='true']")).toHaveLength(18);
  });

  it.each(["global", "following"] as const)("%s omits period context", (activeTab) => {
    const { container } = render(<LeaderboardLoadingState activeTab={activeTab} />);
    expect(container.querySelector(".sm\\:grid-cols-\\[220px_1fr\\]")).toBeNull();
    expect(container.querySelectorAll("[data-skeleton='true']")).toHaveLength(16);
  });

  it("preserves five rows and animates only shared visual shapes", () => {
    const { container } = render(<LeaderboardLoadingState activeTab="global" />);
    expect(container.querySelectorAll(".border-b")).toHaveLength(5);
    for (const shape of container.querySelectorAll("[data-skeleton='true']")) {
      expect([...shape.classList]).toEqual(expect.arrayContaining(["motion-safe:animate-pulse", "motion-reduce:animate-none"]));
      expect(shape.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("contains no fake names, values, raw colors, emoji, or requests", () => {
    const fetchMock = jest.fn();
    const originalFetch = global.fetch;
    global.fetch = fetchMock;
    const { container } = render(<LeaderboardLoadingState activeTab="global" />);
    expect(container.textContent).toBe("Loading leaderboard");
    expect(container.innerHTML).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(/i);
    expect(container.textContent).not.toMatch(/Anonymous|Player \d|\b\d+\b|[\u{1F000}-\u{1FAFF}]/u);
    expect(fetchMock).not.toHaveBeenCalled();
    global.fetch = originalFetch;
  });
});
