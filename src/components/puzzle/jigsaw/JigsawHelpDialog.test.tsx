/** @jest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import JigsawHelpDialog from "./JigsawHelpDialog";

const requestAnimationFrameMock = jest.fn((callback: FrameRequestCallback) => {
  callback(0);
  return 1;
});

const cancelAnimationFrameMock = jest.fn();

beforeEach(() => {
  requestAnimationFrameMock.mockClear();
  cancelAnimationFrameMock.mockClear();
  Object.defineProperty(window, "requestAnimationFrame", { configurable: true, value: requestAnimationFrameMock });
  Object.defineProperty(window, "cancelAnimationFrame", { configurable: true, value: cancelAnimationFrameMock });
});

afterEach(cleanup);

describe("JigsawHelpDialog", () => {
  it("renders the briefing intro", () => {
    render(<JigsawHelpDialog onClose={jest.fn()} />);
    expect(screen.getByText("JIGSAW // BRIEFING")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Rebuild the image" })).toBeTruthy();
    expect(screen.getByText("Browse the tray, place matching pieces, and assemble the complete picture.")).toBeTruthy();
  });

  it("renders all three ordered instruction steps", () => {
    render(<JigsawHelpDialog onClose={jest.fn()} />);
    const steps = screen.getByRole("list", { name: "Jigsaw building steps" });
    expect(steps.tagName).toBe("OL");
    expect(within(steps).getAllByRole("listitem")).toHaveLength(3);

    expect(screen.getByText("Find a piece")).toBeTruthy();
    expect(screen.getByText("Swipe sideways across the tray to browse the remaining pieces.")).toBeTruthy();
    expect(screen.getByText("Drag it onto the board")).toBeTruthy();
    expect(screen.getByText("Drag a piece upward from the tray, then move it into position on the board.")).toBeTruthy();
    expect(screen.getByText("Build matching groups")).toBeTruthy();
    expect(screen.getByText("Neighboring pieces connect automatically. Connected pieces move together as one group.")).toBeTruthy();
  });

  it("renders all four puzzle tools", () => {
    render(<JigsawHelpDialog onClose={jest.fn()} />);
    for (const tool of ["Fullscreen", "Preview Image", "Return Loose Pieces", "Reset Puzzle"]) {
      expect(screen.getByText(tool)).toBeTruthy();
    }
  });

  it("renders every keyboard instruction", () => {
    render(<JigsawHelpDialog onClose={jest.fn()} />);
    expect(screen.getByText("selects a tray group.")).toBeTruthy();
    expect(screen.getByText("move it.")).toBeTruthy();
    expect(screen.getByText("tries a snap.")).toBeTruthy();
    expect(screen.getByText("returns it to the tray.")).toBeTruthy();
    expect(screen.getByText("opens Preview.")).toBeTruthy();
  });

  it("calls onClose from Start Building", () => {
    const onClose = jest.fn();
    render(<JigsawHelpDialog onClose={onClose} />);
    screen.getByRole("button", { name: "Start Building" }).click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("focuses Start Building after the frame animation frame", () => {
    render(<JigsawHelpDialog onClose={jest.fn()} />);
    const startButton = screen.getByRole("button", { name: "Start Building" });
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(startButton);
  });

  it("renders decorative, non-focusable SVGs", () => {
    const { container } = render(<JigsawHelpDialog onClose={jest.fn()} />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
    }
  });

  it("contains no emoji", () => {
    const { container } = render(<JigsawHelpDialog onClose={jest.fn()} />);
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("contains no purple, pink, or magenta styling", () => {
    const { container } = render(<JigsawHelpDialog onClose={jest.fn()} />);
    expect(container.innerHTML).not.toMatch(/purple|pink|magenta/i);
  });

  it("contains exactly one action button inside the help content", () => {
    const { container } = render(<JigsawHelpDialog onClose={jest.fn()} />);
    const helpContent = container.querySelector(".jigsaw-help-content");
    expect(helpContent).not.toBeNull();
    expect(helpContent?.querySelectorAll("button")).toHaveLength(1);
  });
});
