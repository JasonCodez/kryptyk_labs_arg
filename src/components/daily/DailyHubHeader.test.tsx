/** @jest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import DailyHubHeader from "./DailyHubHeader";

const COUNTDOWN = "07:41:09";

function show(countdown = COUNTDOWN) {
  return render(<DailyHubHeader countdown={countdown} />);
}

afterEach(() => {
  cleanup();
});

describe("DailyHubHeader", () => {
  it("renders the Daily Arena eyebrow", () => {
    show();
    expect(screen.getByText("Daily Arena")).toBeTruthy();
  });

  it("renders the h1", () => {
    show();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Today’s Puzzle Lineup");
  });

  it("renders the body copy", () => {
    show();
    expect(
      screen.getByText("Six fresh challenges reset every day. Choose one and keep your streak alive."),
    ).toBeTruthy();
  });

  it("displays the exact countdown prop", () => {
    show("23:59:01");
    expect(screen.getByText("23:59:01")).toBeTruthy();
  });

  it("shows the Next Reset label", () => {
    show();
    expect(screen.getByText("Next Reset")).toBeTruthy();
  });

  it("contains exactly one h1", () => {
    show();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("renders a decorative SVG (aria-hidden, not focusable)", () => {
    const { container } = show();
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
    }
  });

  it("contains no emoji", () => {
    const { container } = show();
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("contains no legacy purple, magenta, or pink color strings", () => {
    const { container } = show();
    const html = container.innerHTML.toLowerCase();
    for (const legacy of ["8b3dff", "ff4fa3", "purple", "magenta", "pink", "139,61,255", "255,79,163"]) {
      expect(html).not.toContain(legacy);
    }
  });

  it("has no animation classes or inline animation styles", () => {
    const { container } = show();
    expect(container.innerHTML).not.toMatch(/animate-|@keyframes/);
    const animated = Array.from(container.querySelectorAll<HTMLElement>("*")).filter(
      (el) => el.style.animation || el.style.animationName,
    );
    expect(animated).toHaveLength(0);
  });

  it("contains no buttons or links", () => {
    show();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
