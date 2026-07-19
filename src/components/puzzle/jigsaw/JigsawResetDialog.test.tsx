/** @jest-environment jsdom */

import { act, cleanup, render, screen } from "@testing-library/react";
import JigsawResetDialog from "./JigsawResetDialog";

afterEach(cleanup);

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", { writable: true, value: () => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }) });
});

const baseProps = {
  onClose: jest.fn(),
  onReset: jest.fn(),
};

async function flushRaf() {
  await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });
}

describe("JigsawResetDialog", () => {
  it("renders the reset label and both warning sentences", () => {
    render(<JigsawResetDialog {...baseProps} />);
    expect(screen.getByText("RESET ARRANGEMENT")).toBeTruthy();
    expect(screen.getByText("Every piece will return to its initial tray position.")).toBeTruthy();
    expect(screen.getByText("Your current arrangement will be cleared. This cannot be undone.")).toBeTruthy();
  });

  it("renders a decorative, non-focusable warning SVG", () => {
    const { container } = render(<JigsawResetDialog {...baseProps} />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
    }
  });

  it("focuses Keep Progress after the animation frame", async () => {
    render(<JigsawResetDialog {...baseProps} />);
    const keepProgress = screen.getByRole("button", { name: "Keep Progress" });
    await flushRaf();
    expect(document.activeElement).toBe(keepProgress);
  });

  it("does not focus Reset Puzzle initially", async () => {
    render(<JigsawResetDialog {...baseProps} />);
    const resetButton = screen.getByRole("button", { name: "Reset Puzzle" });
    await flushRaf();
    expect(document.activeElement).not.toBe(resetButton);
  });

  it("calls onClose when Keep Progress is clicked", () => {
    const onClose = jest.fn();
    render(<JigsawResetDialog {...baseProps} onClose={onClose} />);
    screen.getByRole("button", { name: "Keep Progress" }).click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onReset then onClose when Reset Puzzle is clicked", () => {
    const calls: string[] = [];
    const onReset = jest.fn(() => calls.push("reset"));
    const onClose = jest.fn(() => calls.push("close"));
    render(<JigsawResetDialog onReset={onReset} onClose={onClose} />);
    screen.getByRole("button", { name: "Reset Puzzle" }).click();
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["reset", "close"]);
  });

  it("calls reset only once under rapid repeated activation", () => {
    const onReset = jest.fn();
    const onClose = jest.fn();
    render(<JigsawResetDialog onReset={onReset} onClose={onClose} />);
    const resetButton = screen.getByRole("button", { name: "Reset Puzzle" });
    resetButton.click();
    resetButton.click();
    resetButton.click();
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables Reset Puzzle and shows Resetting… after activation", async () => {
    render(<JigsawResetDialog {...baseProps} onReset={jest.fn()} onClose={jest.fn()} />);
    const resetButton = screen.getByRole("button", { name: "Reset Puzzle" }) as HTMLButtonElement;
    await act(async () => { resetButton.click(); });
    const resettingButton = screen.getByRole("button", { name: "Resetting…" }) as HTMLButtonElement;
    expect(resettingButton).toBe(resetButton);
    expect(resettingButton.disabled).toBe(true);
  });

  it("does not rerun the initial-focus effect when onClose changes identity on rerender", async () => {
    const focusSpy = jest.spyOn(HTMLElement.prototype, "focus");
    try {
      const { rerender } = render(<JigsawResetDialog onClose={jest.fn()} onReset={jest.fn()} />);
      await flushRaf();
      const callsAfterInitialFocus = focusSpy.mock.calls.length;

      rerender(<JigsawResetDialog onClose={jest.fn()} onReset={jest.fn()} />);
      await flushRaf();
      expect(focusSpy.mock.calls.length).toBe(callsAfterInitialFocus);
    } finally {
      focusSpy.mockRestore();
    }
  });

  it("calls only the latest onClose after rerendering with a different callback", () => {
    const firstOnClose = jest.fn();
    const secondOnClose = jest.fn();
    const { rerender } = render(<JigsawResetDialog onClose={firstOnClose} onReset={jest.fn()} />);
    rerender(<JigsawResetDialog onClose={secondOnClose} onReset={jest.fn()} />);
    screen.getByRole("button", { name: "Keep Progress" }).click();
    expect(secondOnClose).toHaveBeenCalledTimes(1);
    expect(firstOnClose).not.toHaveBeenCalled();
  });

  it("calls only the latest onReset and onClose after rerendering with different callbacks", () => {
    const firstOnReset = jest.fn();
    const firstOnClose = jest.fn();
    const secondOnReset = jest.fn();
    const secondOnClose = jest.fn();
    const { rerender } = render(<JigsawResetDialog onReset={firstOnReset} onClose={firstOnClose} />);
    rerender(<JigsawResetDialog onReset={secondOnReset} onClose={secondOnClose} />);
    screen.getByRole("button", { name: "Reset Puzzle" }).click();
    expect(secondOnReset).toHaveBeenCalledTimes(1);
    expect(secondOnClose).toHaveBeenCalledTimes(1);
    expect(firstOnReset).not.toHaveBeenCalled();
    expect(firstOnClose).not.toHaveBeenCalled();
  });

  it("renders exactly two action buttons inside the Reset content", () => {
    const { container } = render(<JigsawResetDialog {...baseProps} />);
    const content = container.querySelector(".jigsaw-reset");
    expect(content).toBeTruthy();
    expect(content?.querySelectorAll("button").length).toBe(2);
  });

  it("contains no emoji", () => {
    const { container } = render(<JigsawResetDialog {...baseProps} />);
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("contains no purple, pink, or magenta styling", () => {
    const { container } = render(<JigsawResetDialog {...baseProps} />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/purple|pink|magenta/i);
  });

  it("keeps the dialog title on the frame as 'Reset this puzzle?'", () => {
    render(<JigsawResetDialog {...baseProps} />);
    expect(screen.getByRole("dialog", { name: "Reset this puzzle?" })).toBeTruthy();
  });
});
