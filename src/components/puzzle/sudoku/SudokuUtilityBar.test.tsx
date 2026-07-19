/** @jest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import SudokuUtilityBar from "./SudokuUtilityBar";

afterEach(cleanup);

const baseProps = {
  notesMode: false,
  canUndo: true,
  canHint: true,
  onNotes: jest.fn(),
  onUndo: jest.fn(),
  onErase: jest.fn(),
  onHint: jest.fn(),
};

describe("SudokuUtilityBar", () => {
  it("renders Notes, Undo, Erase, and Hint in order", () => {
    render(<SudokuUtilityBar {...baseProps} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(4);
    expect(buttons[0].textContent).toContain("Notes");
    expect(buttons[1].textContent).toContain("Undo");
    expect(buttons[2].textContent).toContain("Erase");
    expect(buttons[3].textContent).toContain("Hint");
  });

  it("exposes aria-pressed on Notes", () => {
    const { rerender } = render(<SudokuUtilityBar {...baseProps} notesMode={false} />);
    expect(screen.getByRole("button", { name: /Notes mode off/i }).getAttribute("aria-pressed")).toBe("false");
    rerender(<SudokuUtilityBar {...baseProps} notesMode />);
    expect(screen.getByRole("button", { name: /Notes mode on/i }).getAttribute("aria-pressed")).toBe("true");
  });

  it("reflects On and Off in the Notes accessible label", () => {
    const { rerender } = render(<SudokuUtilityBar {...baseProps} notesMode={false} />);
    expect(screen.getByRole("button", { name: "Notes mode off" })).toBeTruthy();
    rerender(<SudokuUtilityBar {...baseProps} notesMode />);
    expect(screen.getByRole("button", { name: "Notes mode on" })).toBeTruthy();
  });

  it("calls onNotes when Notes is clicked", () => {
    const onNotes = jest.fn();
    render(<SudokuUtilityBar {...baseProps} onNotes={onNotes} />);
    screen.getByRole("button", { name: /Notes mode off/i }).click();
    expect(onNotes).toHaveBeenCalledTimes(1);
  });

  it("calls onUndo when Undo is clicked", () => {
    const onUndo = jest.fn();
    render(<SudokuUtilityBar {...baseProps} onUndo={onUndo} />);
    screen.getByRole("button", { name: "Undo last move" }).click();
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("calls onErase when Erase is clicked", () => {
    const onErase = jest.fn();
    render(<SudokuUtilityBar {...baseProps} onErase={onErase} />);
    screen.getByRole("button", { name: "Erase selected cell" }).click();
    expect(onErase).toHaveBeenCalledTimes(1);
  });

  it("calls onHint when Hint is clicked", () => {
    const onHint = jest.fn();
    render(<SudokuUtilityBar {...baseProps} onHint={onHint} />);
    screen.getByRole("button", { name: "Reveal a Sudoku hint" }).click();
    expect(onHint).toHaveBeenCalledTimes(1);
  });

  it("disables Undo when canUndo is false", () => {
    render(<SudokuUtilityBar {...baseProps} canUndo={false} />);
    const button = screen.getByRole("button", { name: "Undo last move" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("enables Undo when canUndo is true", () => {
    render(<SudokuUtilityBar {...baseProps} canUndo />);
    const button = screen.getByRole("button", { name: "Undo last move" }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it("disables Hint when canHint is false", () => {
    render(<SudokuUtilityBar {...baseProps} canHint={false} />);
    const button = screen.getByRole("button", { name: "Reveal a Sudoku hint" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("hides Hint when showHint is false", () => {
    render(<SudokuUtilityBar {...baseProps} showHint={false} />);
    expect(screen.queryByRole("button", { name: "Reveal a Sudoku hint" })).toBeNull();
  });

  it("renders decorative SVGs (aria-hidden, not focusable)", () => {
    const { container } = render(<SudokuUtilityBar {...baseProps} />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
    }
  });

  it("contains no emoji", () => {
    const { container } = render(<SudokuUtilityBar {...baseProps} />);
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("Notes Off contains no gold or yellow styling", () => {
    const { container } = render(<SudokuUtilityBar {...baseProps} notesMode={false} />);
    const html = container.innerHTML.toLowerCase();
    for (const legacy of ["fde74c", "fed007", "ffe55c", "fdae03", "gold", "yellow"]) {
      expect(html).not.toContain(legacy);
    }
  });

  it("renders exactly four buttons when Hint is shown", () => {
    render(<SudokuUtilityBar {...baseProps} showHint />);
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });

  it("renders exactly three buttons when showHint is false", () => {
    render(<SudokuUtilityBar {...baseProps} showHint={false} />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });
});
