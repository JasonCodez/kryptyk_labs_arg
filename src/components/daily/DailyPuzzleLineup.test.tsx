/** @jest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import DailyPuzzleLineup, { type DailySummary } from "./DailyPuzzleLineup";

const mockSummary: DailySummary = {
  word: { dayNumber: 1, completedToday: false, streak: 3, available: true },
  sudoku: { dayNumber: 1, completedToday: true, streak: 5, available: true },
  crossword: { dayNumber: 1, completedToday: false, streak: 0, available: false },
  word_search: { dayNumber: 1, completedToday: false, streak: 0, available: true },
  jigsaw: { dayNumber: 1, completedToday: false, streak: 1, available: true },
};

const EXPECTED_LINKS = [
  ["Hidden Word", "/daily/word"],
  ["Sudoku", "/daily/sudoku"],
  ["Crossword", "/daily/crossword"],
  ["Word Trove", "/daily/word-search"],
  ["Jigsaw", "/daily/jigsaw"],
  ["The Debrief", "/debrief"],
];

function show(
  summary = mockSummary,
  isAuthenticated = true,
  debriefCompleted = false,
) {
  return render(
    <DailyPuzzleLineup
      summary={summary}
      isAuthenticated={isAuthenticated}
      debriefCompleted={debriefCompleted}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe("DailyPuzzleLineup", () => {
  it("renders exactly six links with correct routes", () => {
    show();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(6);
    for (const [title, href] of EXPECTED_LINKS) {
      const link = screen.getByRole("link", { name: new RegExp(title) });
      expect(link.getAttribute("href")).toBe(href);
    }
  });

  it("renders all six titles and descriptions", () => {
    show();
    expect(screen.getByText("Hidden Word")).toBeTruthy();
    expect(screen.getByText("Sudoku")).toBeTruthy();
    expect(screen.getByText("Crossword")).toBeTruthy();
    expect(screen.getByText("Word Trove")).toBeTruthy();
    expect(screen.getByText("Jigsaw")).toBeTruthy();
    expect(screen.getByText("The Debrief")).toBeTruthy();
    expect(screen.getByText("Find the hidden word in six guesses.")).toBeTruthy();
    expect(screen.getByText("Complete today's number grid.")).toBeTruthy();
    expect(screen.getByText("Solve today's clue set.")).toBeTruthy();
    expect(screen.getByText("Find every hidden word.")).toBeTruthy();
    expect(screen.getByText("Rebuild today's image.")).toBeTruthy();
    expect(screen.getByText("Memorize the report and answer from memory.")).toBeTruthy();
  });

  it("Hidden Word is playable while signed out", () => {
    show(mockSummary, false);
    const wordLink = document.querySelector('a[href="/daily/word"]')!;
    expect(wordLink).toBeTruthy();
    expect(wordLink.textContent).toContain("Play");
    expect(wordLink.textContent).not.toContain("Sign In to Play");
  });

  it("other signed-out puzzles show Sign In to Play", () => {
    show(mockSummary, false);
    const sudokuLink = screen.getByRole("link", { name: /sudoku/i });
    expect(sudokuLink.textContent).toContain("Sign In to Play");
  });

  it("completed puzzle shows View Result", () => {
    show();
    const sudokuLink = screen.getByRole("link", { name: /sudoku/i });
    expect(sudokuLink.textContent).toContain("View Result");
  });

  it("unavailable puzzle shows Check Back Soon", () => {
    show();
    const crosswordLink = screen.getByRole("link", { name: /crossword/i });
    expect(crosswordLink.textContent).toContain("Check Back Soon");
  });

  it("renders day number as readable text", () => {
    show();
    expect(screen.getAllByText(/Daily #/)).toHaveLength(5);
  });

  it("renders streak as readable text", () => {
    show();
    expect(screen.getByText("3 day streak")).toBeTruthy();
    expect(screen.getByText("5 day streak")).toBeTruthy();
    expect(screen.getByText("1 day streak")).toBeTruthy();
  });

  it("debrief available state shows Open Case", () => {
    show(mockSummary, true, false);
    const debriefLink = screen.getByRole("link", { name: /debrief/i });
    expect(debriefLink.textContent).toContain("Open Case");
  });

  it("debrief completed state shows New Case Tomorrow", () => {
    show(mockSummary, true, true);
    const debriefLink = screen.getByRole("link", { name: /debrief/i });
    expect(debriefLink.textContent).toContain("New Case Tomorrow");
  });

  it("renders decorative inline SVGs (aria-hidden, not focusable)", () => {
    const { container } = show();
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
    }
  });

  it("contains no emoji", () => {
    const { container } = show();
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("contains no legacy purple, magenta, or pink color strings", () => {
    const { container } = show();
    const html = container.innerHTML.toLowerCase();
    for (const legacy of ["8b3dff", "ff4fa3", "purple", "magenta", "pink", "139,61,255", "255,79,163"]) {
      expect(html).not.toContain(legacy);
    }
  });

  it("has no animation classes or inline animation styles", () => {
    const { container } = show();
    expect(container.innerHTML).not.toMatch(/animate-|@keyframes|gloss-overlay/);
    const animated = Array.from(container.querySelectorAll<HTMLElement>("*")).filter(
      (el) => el.style.animation || el.style.animationName,
    );
    expect(animated).toHaveLength(0);
  });

  it("contains no buttons", () => {
    show();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("grid uses correct responsive breakpoints", () => {
    const { container } = show();
    const gridContainer = container.querySelector(".grid");
    const classNames = gridContainer?.className || "";
    expect(classNames).toContain("min-[430px]:grid-cols-2");
    expect(classNames).toContain("min-[981px]:grid-cols-3");
    expect(classNames).not.toContain("md:grid-cols-3");
  });
});
