/** @jest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import DashboardPageShell from "./DashboardPageShell";
import DashboardLoadingState from "./DashboardLoadingState";

afterEach(cleanup);

describe("DashboardPageShell", () => {
  it("renders its children in a main landmark", () => {
    render(<DashboardPageShell>content</DashboardPageShell>);
    expect(screen.getByRole("main").textContent).toBe("content");
  });

  it("exposes busy state only when requested", () => {
    const { rerender } = render(<DashboardPageShell busy>content</DashboardPageShell>);
    expect(screen.getByRole("main").getAttribute("aria-busy")).toBe("true");
    rerender(<DashboardPageShell>content</DashboardPageShell>);
    expect(screen.getByRole("main").getAttribute("aria-busy")).not.toBe("true");
  });
});

describe("DashboardLoadingState", () => {
  it("has one loading announcement and a busy shell", () => {
    render(<DashboardLoadingState />);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toBe("Loading player hub");
    expect(screen.getByRole("main").getAttribute("aria-busy")).toBe("true");
  });

  it("preserves command, mission, four-stat, and two-navigation geometry", () => {
    render(<DashboardLoadingState />);
    expect(screen.getByTestId("skeleton-command-header").style.height).toBe("148px");
    expect(screen.getByTestId("skeleton-featured-mission").style.height).toBe("112px");
    expect(screen.getByTestId("skeleton-stats").children).toHaveLength(4);
    expect(screen.getByTestId("skeleton-navigation").children).toHaveLength(2);
  });

  it("uses the shared motion-safe skeleton for every visual shape", () => {
    const { container } = render(<DashboardLoadingState />);
    const shapes = container.querySelectorAll("[data-skeleton='true']");
    expect(shapes).toHaveLength(8);
    for (const shape of shapes) {
      expect(shape.getAttribute("aria-hidden")).toBe("true");
      expect([...shape.classList]).toEqual(expect.arrayContaining(["motion-safe:animate-pulse", "motion-reduce:animate-none"]));
    }
  });

  it("contains no fake content, raw colors, emoji, or requests", () => {
    const fetchMock = jest.fn();
    const originalFetch = global.fetch;
    global.fetch = fetchMock;
    const { container } = render(<DashboardLoadingState />);
    expect(container.textContent).toBe("Loading player hub");
    expect(container.innerHTML).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(/i);
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    expect(fetchMock).not.toHaveBeenCalled();
    global.fetch = originalFetch;
  });
});
