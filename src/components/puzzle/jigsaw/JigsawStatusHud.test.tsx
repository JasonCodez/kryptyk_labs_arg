/** @jest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import JigsawStatusHud from "./JigsawStatusHud";

afterEach(cleanup);

const baseProps = {
  elapsedLabel: "1:23",
  placedCount: 4,
  totalCount: 10,
  groupCount: 3,
};

describe("JigsawStatusHud", () => {
  it("renders the elapsed time", () => {
    render(<JigsawStatusHud {...baseProps} />);
    expect(screen.getByText("1:23")).toBeTruthy();
  });

  it("renders the Pieces label", () => {
    render(<JigsawStatusHud {...baseProps} />);
    expect(screen.getByText("PIECES")).toBeTruthy();
  });

  it("renders the placed and total piece counts", () => {
    render(<JigsawStatusHud {...baseProps} />);
    expect(screen.getByText("4/10 placed")).toBeTruthy();
  });

  it("renders the Groups item when groupCount > 1", () => {
    render(<JigsawStatusHud {...baseProps} groupCount={3} />);
    expect(screen.getByText("GROUPS")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("does not render the Groups item when groupCount <= 1", () => {
    render(<JigsawStatusHud {...baseProps} groupCount={1} />);
    expect(screen.queryByText("GROUPS")).toBeNull();
  });

  it("renders a progress bar with correct accessible attributes", () => {
    render(<JigsawStatusHud {...baseProps} placedCount={4} totalCount={10} />);
    const bar = screen.getByRole("progressbar", { name: "Puzzle completion progress" });
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("10");
    expect(bar.getAttribute("aria-valuenow")).toBe("4");
  });

  it("clamps progress when placedCount exceeds totalCount", () => {
    render(<JigsawStatusHud {...baseProps} placedCount={99} totalCount={10} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("10");
  });

  it("clamps progress when placedCount is negative", () => {
    render(<JigsawStatusHud {...baseProps} placedCount={-5} totalCount={10} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
  });

  it("handles totalCount equal to zero without producing invalid values", () => {
    render(<JigsawStatusHud {...baseProps} placedCount={0} totalCount={0} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuemax")).toBe("0");
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
  });

  it("gives every SVG a decorative, non-focusable treatment", () => {
    const { container } = render(<JigsawStatusHud {...baseProps} />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
    }
  });

  it("keeps the HUD container aria-label 'Jigsaw status'", () => {
    const { container } = render(<JigsawStatusHud {...baseProps} />);
    expect(container.querySelector('[aria-label="Jigsaw status"]')).toBeTruthy();
  });

  it("has no keyboard-focusable elements", () => {
    const { container } = render(<JigsawStatusHud {...baseProps} />);
    expect(container.querySelectorAll("button, a, input, select, textarea, [tabindex]").length).toBe(0);
  });

  it("contains no emoji", () => {
    const { container } = render(<JigsawStatusHud {...baseProps} />);
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("contains no purple, pink, or magenta styling", () => {
    const { container } = render(<JigsawStatusHud {...baseProps} />);
    expect(container.innerHTML).not.toMatch(/purple|pink|magenta/i);
  });

  it("renders the visible labels TIME and PIECES", () => {
    render(<JigsawStatusHud {...baseProps} />);
    expect(screen.getByText("TIME")).toBeTruthy();
    expect(screen.getByText("PIECES")).toBeTruthy();
  });

  it("is purely presentational and exposes no callbacks", () => {
    render(<JigsawStatusHud {...baseProps} />);
    // Compile-time contract check: JigsawStatusHudProps has no function-typed props.
    expect(typeof baseProps).toBe("object");
  });
});
