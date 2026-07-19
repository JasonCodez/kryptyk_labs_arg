/** @jest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import JigsawQuickTip from "./JigsawQuickTip";

afterEach(cleanup);

const baseProps = {
  onFullscreen: jest.fn(),
  onDismiss: jest.fn(),
};

describe("JigsawQuickTip", () => {
  it("renders the eyebrow and instructional text", () => {
    render(<JigsawQuickTip {...baseProps} />);
    expect(screen.getByText("QUICK TIP")).toBeTruthy();
    expect(screen.getByText("Swipe the tray to browse, then drag a piece onto the board.")).toBeTruthy();
  });

  it("calls onFullscreen when Fullscreen is clicked", () => {
    const onFullscreen = jest.fn();
    render(<JigsawQuickTip {...baseProps} onFullscreen={onFullscreen} />);
    screen.getByRole("button", { name: "Fullscreen" }).click();
    expect(onFullscreen).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when the dismiss button is clicked", () => {
    const onDismiss = jest.fn();
    render(<JigsawQuickTip {...baseProps} onDismiss={onDismiss} />);
    screen.getByRole("button", { name: "Dismiss jigsaw tip" }).click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("gives the dismiss button the correct accessible name", () => {
    render(<JigsawQuickTip {...baseProps} />);
    const dismiss = screen.getByRole("button", { name: "Dismiss jigsaw tip" });
    expect(dismiss.tagName).toBe("BUTTON");
  });

  it("renders decorative, non-focusable SVGs", () => {
    const { container } = render(<JigsawQuickTip {...baseProps} />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
    }
  });

  it("contains no emoji", () => {
    const { container } = render(<JigsawQuickTip {...baseProps} />);
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("contains no purple, pink, or magenta styling", () => {
    const { container } = render(<JigsawQuickTip {...baseProps} />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/purple|pink|magenta/i);
  });

  it("gives Fullscreen and dismiss a minimum 44px target", () => {
    render(<JigsawQuickTip {...baseProps} />);
    const fullscreen = screen.getByRole("button", { name: "Fullscreen" }) as HTMLButtonElement;
    const dismiss = screen.getByRole("button", { name: "Dismiss jigsaw tip" }) as HTMLButtonElement;
    expect(parseInt(fullscreen.style.minWidth, 10)).toBeGreaterThanOrEqual(44);
    expect(parseInt(fullscreen.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
    expect(parseInt(dismiss.style.minWidth, 10)).toBeGreaterThanOrEqual(44);
    expect(parseInt(dismiss.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
  });

  it("uses fixed positioning and does not reserve layout space", () => {
    const { container } = render(<JigsawQuickTip {...baseProps} />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.position).toBe("fixed");
    // A fixed-position element is removed from normal document flow — it never behaves as a
    // spacer that pushes sibling content, regardless of its own size.
    expect(wrapper.style.pointerEvents).toBe("none");
  });
});
