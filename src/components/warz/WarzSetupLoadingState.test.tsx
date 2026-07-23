/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import WarzSetupLoadingState from "./WarzSetupLoadingState";

describe("WarzSetupLoadingState", () => {
  it("owns one stable, bounded loading status", () => {
    render(<WarzSetupLoadingState />);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    const root = screen.getByTestId("warz-setup-loading");
    expect(root.getAttribute("aria-label")).toBe("Loading challenge setup");
    expect([...root.classList]).toEqual(expect.arrayContaining(["w-full", "min-w-0", "max-w-xl"]));
  });

  it("preserves full setup geometry including three wager presets", () => {
    const { container } = render(<WarzSetupLoadingState />);
    expect(container.querySelectorAll("[data-skeleton='true']")).toHaveLength(10);
    expect(container.querySelectorAll(".h-11.flex-1")).toHaveLength(3);
    expect(container.querySelector(".h-24.w-full")).toBeTruthy();
    expect(container.querySelector(".h-32.w-full")).toBeTruthy();
    expect(container.querySelector(".h-14.w-full")).toBeTruthy();
  });

  it("uses hidden shared skeletons with safe motion", () => {
    const { container } = render(<WarzSetupLoadingState />);
    for (const shape of container.querySelectorAll("[data-skeleton='true']")) {
      expect(shape.getAttribute("aria-hidden")).toBe("true");
      expect([...shape.classList]).toEqual(expect.arrayContaining(["motion-safe:animate-pulse", "motion-reduce:animate-none"]));
    }
  });

  it("contains no fake wager, balance, opponent, raw color, emoji, or request", () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const { container } = render(<WarzSetupLoadingState />);
    expect(container.textContent).toBe("Loading challenge setup…");
    expect(container.innerHTML).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(/i);
    expect(container.textContent).not.toMatch(/\b\d+\b|[\u{1F000}-\u{1FAFF}]/u);
    expect(fetchMock).not.toHaveBeenCalled();
    global.fetch = originalFetch;
  });
});
