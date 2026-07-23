/** @jest-environment jsdom */

import { act, cleanup, render, screen } from "@testing-library/react";
import JigsawHelpDialog from "./JigsawHelpDialog";

afterEach(cleanup);

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", { writable: true, value: () => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }) });
  Object.defineProperty(window, "scrollTo", { writable: true, value: jest.fn() });
});

describe("JigsawHelpDialog", () => {
  it("renders the briefing eyebrow", () => {
    render(<JigsawHelpDialog onClose={jest.fn()} />);
    expect(screen.getByText("JIGSAW // BRIEFING")).toBeTruthy();
  });

  it("renders all three instruction titles and descriptions", () => {
    render(<JigsawHelpDialog onClose={jest.fn()} />);
    expect(screen.getByText("Find a piece")).toBeTruthy();
    expect(screen.getByText("Swipe sideways across the tray to browse the remaining pieces.")).toBeTruthy();
    expect(screen.getByText("Drag it onto the board")).toBeTruthy();
    expect(screen.getByText("Drag a piece upward from the tray, then move it into position on the board.")).toBeTruthy();
    expect(screen.getByText("Build matching groups")).toBeTruthy();
    expect(screen.getByText("Neighboring pieces connect automatically. Connected pieces move together as one group.")).toBeTruthy();
  });

  it("uses an ordered list for the three steps", () => {
    const { container } = render(<JigsawHelpDialog onClose={jest.fn()} />);
    const list = container.querySelector("ol.jigsaw-help-steps");
    expect(list).toBeTruthy();
    expect(list?.querySelectorAll("li").length).toBe(3);
  });

  it("renders all four puzzle tools", () => {
    render(<JigsawHelpDialog onClose={jest.fn()} />);
    expect(screen.getByText("PUZZLE TOOLS")).toBeTruthy();
    expect(screen.getByText("Fullscreen")).toBeTruthy();
    expect(screen.getByText("Gives you more room while keeping the full board visible.")).toBeTruthy();
    expect(screen.getByText("Preview Image")).toBeTruthy();
    expect(screen.getByText("Shows the completed picture for reference.")).toBeTruthy();
    expect(screen.getByText("Return Loose Pieces")).toBeTruthy();
    expect(screen.getByText("Sends unconnected pieces back to the tray.")).toBeTruthy();
    expect(screen.getByText("Reset Puzzle")).toBeTruthy();
    expect(screen.getByText("Starts the puzzle over.")).toBeTruthy();
  });

  it("uses semantic list markup for the tools", () => {
    const { container } = render(<JigsawHelpDialog onClose={jest.fn()} />);
    const list = container.querySelector("ul.jigsaw-help-tools");
    expect(list).toBeTruthy();
    expect(list?.querySelectorAll("li").length).toBe(4);
  });

  it("renders the keyboard instructions", () => {
    render(<JigsawHelpDialog onClose={jest.fn()} />);
    expect(screen.getByText("KEYBOARD")).toBeTruthy();
    expect(screen.getByText("Enter selects a tray group. Arrow keys move it. Enter tries a snap. T returns it to the tray. P opens Preview.")).toBeTruthy();
  });

  it("calls onClose when Start Building is clicked", () => {
    const onClose = jest.fn();
    render(<JigsawHelpDialog onClose={onClose} />);
    screen.getByRole("button", { name: "Start Building" }).click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("focuses the dialog container (not Start Building) after the animation frame", async () => {
    const { container } = render(<JigsawHelpDialog onClose={jest.fn()} />);
    const startBuilding = screen.getByRole("button", { name: "Start Building" });
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });
    const dialog = container.querySelector('[role="dialog"]');
    expect(document.activeElement).toBe(dialog);
    expect(document.activeElement).not.toBe(startBuilding);
  });

  it("does not rerun the initial-focus effect when onClose changes identity on rerender", async () => {
    const focusSpy = jest.spyOn(HTMLElement.prototype, "focus");
    const { rerender } = render(<JigsawHelpDialog onClose={jest.fn()} />);
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });
    const callsAfterInitialFocus = focusSpy.mock.calls.length;

    rerender(<JigsawHelpDialog onClose={jest.fn()} />);
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });
    expect(focusSpy.mock.calls.length).toBe(callsAfterInitialFocus);

    focusSpy.mockRestore();
  });

  it("calls only the latest onClose after rerendering with a different callback", async () => {
    const firstOnClose = jest.fn();
    const secondOnClose = jest.fn();
    const { rerender } = render(<JigsawHelpDialog onClose={firstOnClose} />);
    rerender(<JigsawHelpDialog onClose={secondOnClose} />);
    screen.getByRole("button", { name: "Start Building" }).click();
    expect(secondOnClose).toHaveBeenCalledTimes(1);
    expect(firstOnClose).not.toHaveBeenCalled();
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
    const html = container.innerHTML;
    expect(html).not.toMatch(/purple|pink|magenta/i);
  });

  it("renders exactly one action button inside the help content", () => {
    const { container } = render(<JigsawHelpDialog onClose={jest.fn()} />);
    const helpContent = container.querySelector(".jigsaw-help");
    expect(helpContent).toBeTruthy();
    expect(helpContent?.querySelectorAll("button").length).toBe(1);
  });

  it("keeps the dialog title on the frame, not a duplicate h2 in the content", () => {
    const { container } = render(<JigsawHelpDialog onClose={jest.fn()} />);
    expect(screen.getByRole("dialog", { name: "How to play Jigsaw" })).toBeTruthy();
    expect(container.querySelector(".jigsaw-help h2")).toBeNull();
    expect(container.querySelector(".jigsaw-help h3")?.textContent).toBe("Rebuild the image");
  });
});
