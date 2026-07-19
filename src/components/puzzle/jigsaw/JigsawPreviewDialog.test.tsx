/** @jest-environment jsdom */

import { act, cleanup, render, screen } from "@testing-library/react";
import JigsawPreviewDialog from "./JigsawPreviewDialog";

afterEach(cleanup);

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", { writable: true, value: () => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }) });
});

const baseProps = {
  imageUrl: "/puzzle-image.jpg",
  puzzleTitle: "Sunset Over the Bay",
  onClose: jest.fn(),
};

describe("JigsawPreviewDialog", () => {
  it("renders the Completed Image briefing label", () => {
    render(<JigsawPreviewDialog {...baseProps} />);
    expect(screen.getByText("COMPLETED IMAGE")).toBeTruthy();
  });

  it("renders the full, undistorted image with an accessible alt text", () => {
    render(<JigsawPreviewDialog {...baseProps} />);
    const img = screen.getByRole("img", { name: "Completed image for Sunset Over the Bay" }) as HTMLImageElement;
    expect(img.src).toContain("/puzzle-image.jpg");
    expect(img.className).toContain("jigsaw-preview-image");
  });

  it("renders the puzzle title", () => {
    render(<JigsawPreviewDialog {...baseProps} />);
    expect(screen.getByText("Sunset Over the Bay")).toBeTruthy();
  });

  it("wraps the image in a framed surface", () => {
    const { container } = render(<JigsawPreviewDialog {...baseProps} />);
    const frame = container.querySelector(".jigsaw-preview-frame");
    expect(frame).toBeTruthy();
    expect(frame?.querySelector("img.jigsaw-preview-image")).toBeTruthy();
  });

  it("renders exactly one Back to Puzzle action at least 44px", () => {
    render(<JigsawPreviewDialog {...baseProps} />);
    const buttons = screen.getAllByRole("button", { name: "Back to Puzzle" });
    expect(buttons).toHaveLength(1);
    expect(buttons[0].className).toContain("jigsaw-preview-back");
  });

  it("calls onClose when Back to Puzzle is clicked", () => {
    const onClose = jest.fn();
    render(<JigsawPreviewDialog {...baseProps} onClose={onClose} />);
    screen.getByRole("button", { name: "Back to Puzzle" }).click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the dialog title on the frame", () => {
    render(<JigsawPreviewDialog {...baseProps} />);
    expect(screen.getByRole("dialog", { name: "Puzzle preview" })).toBeTruthy();
  });

  it("focuses the dialog container (top) after the animation frame, not Back to Puzzle", async () => {
    const { container } = render(<JigsawPreviewDialog {...baseProps} />);
    const backButton = screen.getByRole("button", { name: "Back to Puzzle" });
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });
    const dialog = container.closest("body")?.querySelector('[role="dialog"]');
    expect(document.activeElement).toBe(dialog);
    expect(document.activeElement).not.toBe(backButton);
  });

  it("does not rerun the initial-focus effect when onClose changes identity on rerender", async () => {
    const focusSpy = jest.spyOn(HTMLElement.prototype, "focus");
    const { rerender } = render(<JigsawPreviewDialog {...baseProps} onClose={jest.fn()} />);
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });
    const callsAfterInitialFocus = focusSpy.mock.calls.length;

    rerender(<JigsawPreviewDialog {...baseProps} onClose={jest.fn()} />);
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });
    expect(focusSpy.mock.calls.length).toBe(callsAfterInitialFocus);

    focusSpy.mockRestore();
  });

  it("calls only the latest onClose after rerendering with a different callback", () => {
    const firstOnClose = jest.fn();
    const secondOnClose = jest.fn();
    const { rerender } = render(<JigsawPreviewDialog {...baseProps} onClose={firstOnClose} />);
    rerender(<JigsawPreviewDialog {...baseProps} onClose={secondOnClose} />);
    screen.getByRole("button", { name: "Back to Puzzle" }).click();
    expect(secondOnClose).toHaveBeenCalledTimes(1);
    expect(firstOnClose).not.toHaveBeenCalled();
  });

  it("contains no emoji", () => {
    const { container } = render(<JigsawPreviewDialog {...baseProps} />);
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("contains no purple, pink, or magenta styling", () => {
    const { container } = render(<JigsawPreviewDialog {...baseProps} />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/purple|pink|magenta/i);
  });
});
