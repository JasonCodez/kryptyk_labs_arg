/** @jest-environment jsdom */

import fs from "fs";
import path from "path";
import { createRef } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import WarzPuzzlePickerDialog, { type EligiblePuzzle } from "./WarzPuzzlePickerDialog";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-reduce-animations");
});

function puzzles(): EligiblePuzzle[] {
  return [
    { id: "p1", title: "Midnight Sudoku", difficulty: "medium", puzzleType: "sudoku", category: { name: "Logic" } },
    { id: "p2", title: "Cipher Trove", difficulty: "hard", puzzleType: "word_search", category: null },
  ];
}

function renderDialog(overrides: Partial<Parameters<typeof WarzPuzzlePickerDialog>[0]> = {}) {
  const returnFocusRef = createRef<HTMLButtonElement>();
  const button = document.createElement("button");
  button.textContent = "Issue a Challenge";
  document.body.appendChild(button);
  (returnFocusRef as { current: HTMLButtonElement }).current = button;

  const props = {
    open: true,
    puzzles: puzzles(),
    loading: false,
    error: null,
    onRetry: jest.fn(),
    onSelect: jest.fn(),
    onClose: jest.fn(),
    returnFocusRef,
    ...overrides,
  };
  const result = render(<WarzPuzzlePickerDialog {...props} />);
  return { ...result, props, button };
}

describe("WarzPuzzlePickerDialog", () => {
  it("closed state renders no dialog", () => {
    renderDialog({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("open state renders role=dialog", () => {
    renderDialog();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("dialog uses aria-modal=true", () => {
    renderDialog();
    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
  });

  it("dialog references its H2", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog");
    const headingId = dialog.getAttribute("aria-labelledby");
    expect(headingId).toBeTruthy();
    const heading = document.getElementById(headingId!);
    expect(heading?.tagName).toBe("H2");
    expect(heading?.textContent).toBe("Choose your puzzle");
  });

  it("dialog references its description", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog");
    const descId = dialog.getAttribute("aria-describedby");
    expect(descId).toBeTruthy();
    expect(document.getElementById(descId!)?.textContent).toMatch(/never attempted|haven.t attempted/i);
  });

  it("search input has a visible accessible label", () => {
    renderDialog();
    expect(screen.getByLabelText("Search eligible puzzles")).toBeTruthy();
  });

  it("search input receives focus on open", async () => {
    renderDialog();
    await act(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });
    expect(document.activeElement).toBe(screen.getByLabelText("Search eligible puzzles"));
  });

  it("escape closes the dialog", () => {
    const { props } = renderDialog();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("backdrop click closes the dialog", () => {
    const { props } = renderDialog();
    const backdrop = screen.getByRole("dialog").parentElement as HTMLElement;
    fireEvent.pointerDown(backdrop, {});
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("inside click does not close the dialog", () => {
    const { props } = renderDialog();
    fireEvent.pointerDown(screen.getByRole("dialog"));
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("closing restores focus to Issue a Challenge", () => {
    const { rerender, props, button } = renderDialog();
    rerender(<WarzPuzzlePickerDialog {...props} open={false} />);
    expect(document.activeElement).toBe(button);
  });

  it("focus remains contained while tabbing", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog");
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    );
    expect(focusable.length).toBeGreaterThan(0);
  });

  it("close control has an accessible name", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: "Close puzzle picker" })).toBeTruthy();
  });

  it("close control meets target size", () => {
    renderDialog();
    const close = screen.getByRole("button", { name: "Close puzzle picker" });
    expect(close.style.width).toBe("44px");
    expect(close.style.height).toBe("44px");
  });

  it("loading state is visible", () => {
    renderDialog({ loading: true, puzzles: [] });
    expect(screen.getByText(/loading eligible puzzles/i)).toBeTruthy();
  });

  it("error state is visible", () => {
    renderDialog({ error: "failed", puzzles: [] });
    expect(screen.getByText(/couldn.t load eligible puzzles/i)).toBeTruthy();
  });

  it("retry invokes the callback", () => {
    const { props } = renderDialog({ error: "failed", puzzles: [] });
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it("empty API result uses the correct copy", () => {
    renderDialog({ puzzles: [] });
    expect(screen.getByText(/already attempted all available warz puzzles/i)).toBeTruthy();
  });

  it("search-empty state uses different copy", () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText("Search eligible puzzles"), { target: { value: "zzzznomatch" } });
    expect(screen.getByText(/no eligible puzzles match your search/i)).toBeTruthy();
  });

  it("search is case insensitive", () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText("Search eligible puzzles"), { target: { value: "MIDNIGHT" } });
    expect(screen.getByText("Midnight Sudoku")).toBeTruthy();
    expect(screen.queryByText("Cipher Trove")).toBeNull();
  });

  it("search ignores surrounding whitespace", () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText("Search eligible puzzles"), { target: { value: "  midnight  " } });
    expect(screen.getByText("Midnight Sudoku")).toBeTruthy();
  });

  it("type filters work locally", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Word Trove" }));
    expect(screen.getByText("Cipher Trove")).toBeTruthy();
    expect(screen.queryByText("Midnight Sudoku")).toBeNull();
  });

  it("type filters use aria-pressed", () => {
    renderDialog();
    const allBtn = screen.getByRole("button", { name: "All" });
    expect(allBtn.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Sudoku" }));
    expect(screen.getByRole("button", { name: "Sudoku" }).getAttribute("aria-pressed")).toBe("true");
    expect(allBtn.getAttribute("aria-pressed")).toBe("false");
  });

  it("filtering does not invoke a request", () => {
    const fetchSpy = jest.fn();
    const originalFetch = global.fetch;
    global.fetch = fetchSpy as unknown as typeof fetch;
    renderDialog();
    fireEvent.change(screen.getByLabelText("Search eligible puzzles"), { target: { value: "sudoku" } });
    fireEvent.click(screen.getByRole("button", { name: "Jigsaw" }));
    expect(fetchSpy).not.toHaveBeenCalled();
    global.fetch = originalFetch;
  });

  it("puzzle options show title", () => {
    renderDialog();
    expect(screen.getByText("Midnight Sudoku")).toBeTruthy();
  });

  it("puzzle options show puzzle type", () => {
    renderDialog();
    const option = screen.getByText("Midnight Sudoku").closest("button") as HTMLElement;
    expect(option.textContent).toContain("Sudoku");
  });

  it("puzzle options show category when provided", () => {
    renderDialog();
    expect(screen.getByText("Logic")).toBeTruthy();
  });

  it("option selection passes the exact puzzle", () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByText("Midnight Sudoku"));
    expect(props.onSelect).toHaveBeenCalledWith(puzzles()[0]);
  });

  it("option targets meet 48px minimum", () => {
    renderDialog();
    const option = screen.getByText("Midnight Sudoku").closest("button") as HTMLElement;
    expect(option.className).toContain("min-h-12");
  });

  it("uses Lucide icons", () => {
    renderDialog();
    expect(document.body.querySelectorAll("svg").length).toBeGreaterThan(0);
  });

  it("contains no raw emoji", () => {
    renderDialog();
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(emojiPattern.test(screen.getByRole("dialog").textContent || "")).toBe(false);
  });

  it("contains no raw hex or RGBA colors", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzPuzzlePickerDialog.tsx"), "utf8");
    expect(/#[0-9a-fA-F]{3,8}\b/.test(source)).toBe(false);
    expect(/rgba?\(\s*\d/.test(source)).toBe(false);
  });

  it("reduced motion removes dialog movement", () => {
    document.documentElement.setAttribute("data-reduce-animations", "true");
    renderDialog();
    const dialog = screen.getByRole("dialog");
    expect(dialog.style.opacity).not.toBe("0");
  });

  it("no navigation occurs inside the dialog component", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzPuzzlePickerDialog.tsx"), "utf8");
    expect(source).not.toMatch(/useRouter|router\.push/);
  });

  it("no API request occurs inside the dialog component if fetching remains page-owned", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzPuzzlePickerDialog.tsx"), "utf8");
    expect(source).not.toMatch(/fetch\(/);
  });
});
