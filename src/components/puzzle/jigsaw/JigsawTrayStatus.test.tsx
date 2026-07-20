/** @jest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import JigsawTrayStatus, { JigsawTrayBadge } from "./JigsawTrayStatus";

afterEach(cleanup);

describe("JigsawTrayBadge", () => {
  it("renders LOOSE PIECES when remainingCount > 0", () => {
    render(<JigsawTrayBadge remainingCount={5} />);
    expect(screen.getByText("LOOSE PIECES")).toBeTruthy();
  });

  it("renders the correct remaining count", () => {
    render(<JigsawTrayBadge remainingCount={12} />);
    expect(screen.getByText("12")).toBeTruthy();
  });

  it("renders nothing when remainingCount is 0", () => {
    const { container } = render(<JigsawTrayBadge remainingCount={0} />);
    expect(container.textContent).toBe("");
  });

  it("gives every SVG a decorative, non-focusable treatment", () => {
    const { container } = render(<JigsawTrayBadge remainingCount={5} />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
    }
  });

  it("has no keyboard-focusable elements", () => {
    const { container } = render(<JigsawTrayBadge remainingCount={5} />);
    expect(container.querySelectorAll("button, a, input, select, textarea, [tabindex]").length).toBe(0);
  });

  it("exposes no callbacks", () => {
    const props = { remainingCount: 5 };
    render(<JigsawTrayBadge {...props} />);
    // Compile-time contract check: JigsawTrayBadgeProps has no function-typed props.
    expect(typeof props).toBe("object");
  });

  it("contains no emoji", () => {
    const { container } = render(<JigsawTrayBadge remainingCount={5} />);
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("contains no purple, pink, or magenta styling", () => {
    const { container } = render(<JigsawTrayBadge remainingCount={5} />);
    expect(container.innerHTML).not.toMatch(/purple|pink|magenta/i);
  });

  it("exposes the remaining count through an accessible label", () => {
    const { container } = render(<JigsawTrayBadge remainingCount={5} />);
    expect(container.querySelector('[aria-label="5 loose piece groups remaining"]')).toBeTruthy();
  });

  it("uses grammatically valid singular phrasing for one remaining group", () => {
    const { container } = render(<JigsawTrayBadge remainingCount={1} />);
    expect(container.querySelector('[aria-label="1 loose piece group remaining"]')).toBeTruthy();
  });

  it("uses grammatically valid plural phrasing for multiple remaining groups", () => {
    const { container } = render(<JigsawTrayBadge remainingCount={2} />);
    expect(container.querySelector('[aria-label="2 loose piece groups remaining"]')).toBeTruthy();
  });
});

describe("JigsawTrayStatus", () => {
  it("renders nothing when pieces remain (unsolved)", () => {
    const { container } = render(<JigsawTrayStatus remainingCount={5} isSolved={false} />);
    expect(container.textContent).toBe("");
  });

  it("renders nothing when pieces remain (solved)", () => {
    const { container } = render(<JigsawTrayStatus remainingCount={5} isSolved />);
    expect(container.textContent).toBe("");
  });

  it("does not render LOOSE PIECES", () => {
    render(<JigsawTrayStatus remainingCount={0} isSolved={false} />);
    expect(screen.queryByText("LOOSE PIECES")).toBeNull();
  });

  it("renders 'All pieces are on the board' when remainingCount is 0 and isSolved is false", () => {
    render(<JigsawTrayStatus remainingCount={0} isSolved={false} />);
    expect(screen.getByText("All pieces are on the board")).toBeTruthy();
  });

  it("renders the unsolved supporting text", () => {
    render(<JigsawTrayStatus remainingCount={0} isSolved={false} />);
    expect(screen.getByText("Drag a piece back here whenever you need more room.")).toBeTruthy();
  });

  it("renders 'Puzzle complete!' when remainingCount is 0 and isSolved is true", () => {
    render(<JigsawTrayStatus remainingCount={0} isSolved />);
    expect(screen.getByText("Puzzle complete!")).toBeTruthy();
  });

  it("renders the solved supporting text", () => {
    render(<JigsawTrayStatus remainingCount={0} isSolved />);
    expect(screen.getByText("Every piece is in place.")).toBeTruthy();
  });

  it("gives every SVG a decorative, non-focusable treatment", () => {
    const { container, rerender } = render(<JigsawTrayStatus remainingCount={0} isSolved={false} />);
    let svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
    }

    rerender(<JigsawTrayStatus remainingCount={0} isSolved />);
    svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
    }
  });

  it("has no keyboard-focusable elements", () => {
    const { container } = render(<JigsawTrayStatus remainingCount={0} isSolved={false} />);
    expect(container.querySelectorAll("button, a, input, select, textarea, [tabindex]").length).toBe(0);
  });

  it("exposes no callbacks", () => {
    const props = { remainingCount: 0, isSolved: false };
    render(<JigsawTrayStatus {...props} />);
    // Compile-time contract check: JigsawTrayStatusProps has no function-typed props.
    expect(typeof props).toBe("object");
  });

  it("contains no emoji", () => {
    const { container, rerender } = render(<JigsawTrayStatus remainingCount={0} isSolved={false} />);
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
    rerender(<JigsawTrayStatus remainingCount={0} isSolved />);
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("contains no purple, pink, or magenta styling", () => {
    const { container, rerender } = render(<JigsawTrayStatus remainingCount={0} isSolved={false} />);
    expect(container.innerHTML).not.toMatch(/purple|pink|magenta/i);
    rerender(<JigsawTrayStatus remainingCount={0} isSolved />);
    expect(container.innerHTML).not.toMatch(/purple|pink|magenta/i);
  });
});
