/** @jest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import DailyHubHeader from "./DailyHubHeader";

const COUNTDOWN = "07:41:09";
const COUNTDOWN_LABEL = "07 hours, 41 minutes, and 09 seconds";

function show(countdown = COUNTDOWN, countdownLabel = COUNTDOWN_LABEL) {
  return render(<DailyHubHeader countdown={countdown} countdownLabel={countdownLabel} />);
}

afterEach(() => {
  cleanup();
});

describe("DailyHubHeader", () => {
  it("1. renders the DAILY ARENA eyebrow", () => {
    show();
    expect(screen.getByText("DAILY ARENA")).toBeTruthy();
  });

  it("2. renders the exact h1", () => {
    show();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Today’s Puzzle Lineup");
  });

  it("3. renders the exact body copy", () => {
    show();
    expect(
      screen.getByText("Six fresh challenges reset every day. Choose one and keep your streak alive."),
    ).toBeTruthy();
  });

  it("4. displays the exact countdown prop", () => {
    show("23:59:01", "23 hours, 59 minutes, and 01 seconds");
    expect(screen.getByText("23:59:01")).toBeTruthy();
  });

  it("5. shows the visible Next Reset label", () => {
    show();
    expect(screen.getByText("Next Reset")).toBeTruthy();
  });

  it("6. contains exactly one h1", () => {
    show();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("7. countdown has a descriptive accessible label", () => {
    show();
    expect(screen.getByText("07:41:09").getAttribute("aria-label")).toBe(
      "Next daily reset in 07 hours, 41 minutes, and 09 seconds",
    );
  });

  it("8. countdown does not use a live region that announces every second", () => {
    show();
    const value = screen.getByText("07:41:09");
    expect(value.getAttribute("aria-live")).toBe("off");
  });

  it("9. renders a decorative Lucide SVG (aria-hidden, not focusable)", () => {
    const { container } = show();
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
    }
  });

  it("10. no custom inline icon component remains (icon carries the lucide class marker)", () => {
    const { container } = show();
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("class") || "").toMatch(/lucide/);
  });

  it("11. contains no emoji", () => {
    const { container } = show();
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("12. contains no legacy purple, magenta, or pink color strings", () => {
    const { container } = show();
    const html = container.innerHTML.toLowerCase();
    for (const legacy of ["8b3dff", "ff4fa3", "purple", "magenta", "pink", "139,61,255", "255,79,163"]) {
      expect(html).not.toContain(legacy);
    }
  });

  it("13. contains no buttons or links", () => {
    show();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("14. has no animation classes or inline animation styles", () => {
    const { container } = show();
    expect(container.innerHTML).not.toMatch(/animate-|@keyframes/);
    const animated = Array.from(container.querySelectorAll<HTMLElement>("*")).filter(
      (el) => el.style.animation || el.style.animationName,
    );
    expect(animated).toHaveLength(0);
  });

  it("15. long countdown values do not alter the semantic structure", () => {
    show("99:59:59", "99 hours, 59 minutes, and 59 seconds");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("99:59:59")).toBeTruthy();
  });

  it("contains no points or XP copy", () => {
    const { container } = show();
    expect(container.textContent).not.toMatch(/\bXP\b/);
    expect(container.textContent).not.toMatch(/\bpoints\b/i);
  });
});
