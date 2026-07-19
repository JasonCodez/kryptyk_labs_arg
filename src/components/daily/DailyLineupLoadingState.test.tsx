/** @jest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import DailyLineupLoadingState from "./DailyLineupLoadingState";

afterEach(() => {
  cleanup();
});

describe("DailyLineupLoadingState", () => {
  it("renders Today's Challenges heading", () => {
    render(<DailyLineupLoadingState />);
    expect(screen.getByText(/today.*challenges/i)).toBeTruthy();
  });

  it("exposes role=status with Loading today's puzzles… text", () => {
    render(<DailyLineupLoadingState />);
    const status = screen.getByRole("status");
    expect(status.textContent).toMatch(/loading today.*puzzles/i);
  });

  it("renders exactly six placeholders", () => {
    const { container } = render(<DailyLineupLoadingState />);
    const gridContainer = container.querySelector('[aria-hidden="true"]');
    expect(gridContainer?.children).toHaveLength(6);
  });

  it("placeholder group is aria-hidden", () => {
    const { container } = render(<DailyLineupLoadingState />);
    const gridContainer = container.querySelector(".grid");
    expect(gridContainer?.getAttribute("aria-hidden")).toBe("true");
  });

  it("contains no buttons or links", () => {
    render(<DailyLineupLoadingState />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("contains no emoji", () => {
    const { container } = render(<DailyLineupLoadingState />);
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("contains no legacy purple, magenta, or pink color strings", () => {
    const { container } = render(<DailyLineupLoadingState />);
    const html = container.innerHTML.toLowerCase();
    for (const legacy of ["8b3dff", "ff4fa3", "purple", "magenta", "pink", "139,61,255", "255,79,163"]) {
      expect(html).not.toContain(legacy);
    }
  });

  it("has no spinner, animation classes, keyframes, or inline animation styles", () => {
    const { container } = render(<DailyLineupLoadingState />);
    expect(container.innerHTML).not.toMatch(/animate-spin|@keyframes|pulse|shimmer/);
    const animated = Array.from(container.querySelectorAll<HTMLElement>("*")).filter(
      (el) => el.style.animation || el.style.animationName,
    );
    expect(animated).toHaveLength(0);
  });

  it("grid uses correct responsive breakpoints", () => {
    const { container } = render(<DailyLineupLoadingState />);
    const gridContainer = container.querySelector(".grid");
    const classNames = gridContainer?.className || "";
    expect(classNames).toContain("min-[430px]:grid-cols-2");
    expect(classNames).toContain("min-[981px]:grid-cols-3");
    expect(classNames).not.toContain("md:grid-cols-3");
  });
});
