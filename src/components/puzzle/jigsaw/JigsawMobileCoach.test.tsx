/** @jest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import JigsawMobileCoach from "./JigsawMobileCoach";

afterEach(cleanup);

const baseProps = {
  onFullscreen: jest.fn(),
  onDismiss: jest.fn(),
};

describe("JigsawMobileCoach", () => {
  it("renders the quick tip", () => {
    render(<JigsawMobileCoach {...baseProps} />);
    expect(screen.getByText("QUICK TIP")).toBeTruthy();
    expect(screen.getByText("Swipe the tray, then drag a piece onto the board.")).toBeTruthy();
  });

  it("calls onFullscreen when Fullscreen is clicked", () => {
    const onFullscreen = jest.fn();
    render(<JigsawMobileCoach {...baseProps} onFullscreen={onFullscreen} />);
    screen.getByRole("button", { name: "Fullscreen" }).click();
    expect(onFullscreen).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when the dismiss button is clicked", () => {
    const onDismiss = jest.fn();
    render(<JigsawMobileCoach {...baseProps} onDismiss={onDismiss} />);
    screen.getByRole("button", { name: "Dismiss jigsaw tip" }).click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("gives the dismiss button the correct accessible name", () => {
    render(<JigsawMobileCoach {...baseProps} />);
    const dismiss = screen.getByRole("button", { name: "Dismiss jigsaw tip" });
    expect(dismiss.tagName).toBe("BUTTON");
  });

  it("renders decorative, non-focusable SVGs", () => {
    const { container } = render(<JigsawMobileCoach {...baseProps} />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
    }
  });

  it("contains no emoji", () => {
    const { container } = render(<JigsawMobileCoach {...baseProps} />);
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("contains no purple, pink, or magenta styling", () => {
    const { container } = render(<JigsawMobileCoach {...baseProps} />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/purple|pink|magenta/i);
  });
});
