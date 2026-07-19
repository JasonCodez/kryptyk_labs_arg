/** @jest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import JigsawOrientationLock from "./JigsawOrientationLock";

afterEach(cleanup);

describe("JigsawOrientationLock", () => {
  it("renders the rotate-back instruction as an alert", () => {
    render(<JigsawOrientationLock />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Rotate your device back to portrait mode to continue this puzzle.")).toBeTruthy();
  });

  it("renders a decorative, non-focusable SVG", () => {
    const { container } = render(<JigsawOrientationLock />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
    }
  });

  it("contains no emoji", () => {
    const { container } = render(<JigsawOrientationLock />);
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("contains no purple, pink, or magenta styling", () => {
    const { container } = render(<JigsawOrientationLock />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/purple|pink|magenta/i);
  });
});
