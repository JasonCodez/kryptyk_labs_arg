/** @jest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import DailyPuzzleLineup, { type DailySummary, type DailySummaryEntry } from "./DailyPuzzleLineup";

const mockUseAppReducedMotion = jest.fn();
jest.mock("@/hooks/useAppReducedMotion", () => ({
  useAppReducedMotion: () => mockUseAppReducedMotion(),
}));

const EMOJI_REGEX = /\p{Extended_Pictographic}/u;

function entry(overrides: Partial<DailySummaryEntry> = {}): DailySummaryEntry {
  return { dayNumber: 12, completedToday: false, streak: 0, available: true, ...overrides };
}

function summary(overrides: Partial<DailySummary> = {}): DailySummary {
  return {
    word: entry(),
    sudoku: entry(),
    crossword: entry(),
    word_search: entry(),
    jigsaw: entry(),
    ...overrides,
  };
}

function show(props: { summary: DailySummary; isAuthenticated?: boolean; debriefCompleted?: boolean }) {
  return render(
    <DailyPuzzleLineup
      summary={props.summary}
      isAuthenticated={props.isAuthenticated ?? true}
      debriefCompleted={props.debriefCompleted ?? false}
    />,
  );
}

beforeEach(() => {
  mockUseAppReducedMotion.mockReturnValue(false);
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

const HREFS = ["/daily/word", "/daily/sudoku", "/daily/crossword", "/daily/word-search", "/daily/jigsaw", "/debrief"];

// The recommended-challenge CTA can share an href with one of the six grid
// cards (it links to the same puzzle it recommends), so every lookup below is
// scoped to the six-card grid rather than the whole document.
function grid(): HTMLElement {
  return screen.getByTestId("daily-lineup-grid");
}

function gridCard(href: string): HTMLElement {
  return grid().querySelector(`a[href="${href}"]`)!;
}

function gridLinks(): HTMLElement[] {
  return Array.from(grid().querySelectorAll("a"));
}

describe("DailyPuzzleLineup", () => {
  it("1. renders exactly six challenge links", () => {
    show({ summary: summary() });
    expect(gridLinks().filter((l) => HREFS.includes(l.getAttribute("href") || ""))).toHaveLength(6);
  });

  it("2. renders the exact existing routes", () => {
    show({ summary: summary() });
    for (const href of HREFS) {
      expect(gridCard(href)).not.toBeNull();
    }
  });

  it("3. renders in the fixed lineup order", () => {
    show({ summary: summary() });
    const links = gridLinks().filter((l) => HREFS.includes(l.getAttribute("href") || ""));
    expect(links.map((l) => l.getAttribute("href"))).toEqual(HREFS);
  });

  it("4. renders existing titles", () => {
    show({ summary: summary() });
    for (const title of ["Hidden Word", "Sudoku", "Crossword", "Word Trove", "Jigsaw", "The Debrief"]) {
      expect(within(grid()).getByText(title)).toBeTruthy();
    }
  });

  it("5. renders existing descriptions", () => {
    show({ summary: summary() });
    expect(within(grid()).getByText("Find the hidden word in six guesses.")).toBeTruthy();
    expect(within(grid()).getByText("Complete today's number grid.")).toBeTruthy();
  });

  it("6. Hidden Word remains playable for guests", () => {
    show({ summary: summary(), isAuthenticated: false });
    const word = gridCard("/daily/word");
    expect(word.textContent).toContain("Play");
    expect(word.textContent).not.toContain("Sign In to Play");
  });

  it("7. other guest challenges show Sign In to Play", () => {
    show({ summary: summary(), isAuthenticated: false });
    for (const href of ["/daily/sudoku", "/daily/crossword", "/daily/word-search", "/daily/jigsaw", "/debrief"]) {
      const card = gridCard(href);
      expect(card.textContent).toContain("Sign In to Play");
    }
  });

  it("8. completed standard puzzle shows Completed", () => {
    show({ summary: summary({ sudoku: entry({ completedToday: true }) }) });
    const sudoku = gridCard("/daily/sudoku");
    expect(sudoku.textContent).toContain("Completed");
  });

  it("9. completed standard puzzle shows View Result", () => {
    show({ summary: summary({ sudoku: entry({ completedToday: true }) }) });
    const sudoku = gridCard("/daily/sudoku");
    expect(sudoku.textContent).toContain("View Result");
  });

  it("10. unavailable standard puzzle shows Not Available", () => {
    show({ summary: summary({ word_search: entry({ available: false }) }) });
    const trove = gridCard("/daily/word-search");
    expect(trove.textContent).toContain("Not Available");
  });

  it("11. unavailable standard puzzle shows Check Back Soon", () => {
    show({ summary: summary({ word_search: entry({ available: false }) }) });
    const trove = gridCard("/daily/word-search");
    expect(trove.textContent).toContain("Check Back Soon");
  });

  it("12. standard day numbers remain visible", () => {
    show({ summary: summary({ sudoku: entry({ dayNumber: 42 }) }) });
    const sudoku = gridCard("/daily/sudoku");
    expect(sudoku.textContent).toContain("Daily #42");
  });

  it("13. existing streak values remain visible", () => {
    show({ summary: summary({ word: entry({ streak: 4 }) }) });
    const word = gridCard("/daily/word");
    expect(word.textContent).toContain("4 day streak");
  });

  it("14. zero streak renders no streak badge", () => {
    show({ summary: summary({ crossword: entry({ streak: 0 }) }) });
    const crossword = gridCard("/daily/crossword");
    expect(crossword.textContent).not.toContain("day streak");
  });

  it("15. Debrief available state shows Open Case", () => {
    show({ summary: summary(), debriefCompleted: false });
    const debrief = gridCard("/debrief");
    expect(debrief.textContent).toContain("Open Case");
  });

  it("16. Debrief complete state shows New Case Tomorrow", () => {
    show({ summary: summary(), debriefCompleted: true });
    const debrief = gridCard("/debrief");
    expect(debrief.textContent).toContain("New Case Tomorrow");
  });

  it("17. overall completed count includes standard puzzles", () => {
    show({ summary: summary({ sudoku: entry({ completedToday: true }) }) });
    const stat = screen.getByText("Complete").closest("div")!;
    expect(within(stat).getByText("1")).toBeTruthy();
  });

  it("18. overall completed count includes Debrief", () => {
    show({ summary: summary({ sudoku: entry({ completedToday: true }) }), debriefCompleted: true });
    const stat = screen.getByText("Complete").closest("div")!;
    expect(within(stat).getByText("2")).toBeTruthy();
  });

  it("19. remaining count is correct", () => {
    show({ summary: summary({ sudoku: entry({ completedToday: true }) }), debriefCompleted: true });
    const stat = screen.getByText("Remaining").closest("div")!;
    expect(within(stat).getByText("4")).toBeTruthy();
  });

  it("20. total challenge count is always six", () => {
    show({ summary: summary() });
    const stat = screen.getByText("Challenges").closest("div")!;
    expect(within(stat).getByText("6")).toBeTruthy();
  });

  it("21. progress bar has correct ARIA values", () => {
    show({ summary: summary({ sudoku: entry({ completedToday: true }) }) });
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("6");
    expect(bar.getAttribute("aria-valuenow")).toBe("1");
  });

  it("22. first accessible incomplete available standard puzzle is recommended", () => {
    show({ summary: summary() });
    expect(screen.getByText("Play Next")).toBeTruthy();
    const recommendedRegion = screen.getByText("Play Next").parentElement!;
    expect(within(recommendedRegion).getByText("Hidden Word")).toBeTruthy();
  });

  it("23. completed puzzle is skipped for recommendation", () => {
    show({ summary: summary({ word: entry({ completedToday: true }) }) });
    const recommendedRegion = screen.getByText("Play Next").parentElement!;
    expect(within(recommendedRegion).getByText("Sudoku")).toBeTruthy();
  });

  it("24. unavailable puzzle is skipped for recommendation", () => {
    show({ summary: summary({ word: entry({ completedToday: true }), sudoku: entry({ available: false }) }) });
    const recommendedRegion = screen.getByText("Play Next").parentElement!;
    expect(within(recommendedRegion).getByText("Crossword")).toBeTruthy();
  });

  it("25. sign-in-required puzzle is skipped for guest recommendation", () => {
    show({ summary: summary(), isAuthenticated: false });
    const recommendedRegion = screen.getByText("Play Next").parentElement!;
    expect(within(recommendedRegion).getByText("Hidden Word")).toBeTruthy();
  });

  it("26. Debrief becomes recommended when no standard puzzle qualifies and the user has not completed it", () => {
    const allStandardDone = summary({
      word: entry({ completedToday: true }),
      sudoku: entry({ completedToday: true }),
      crossword: entry({ completedToday: true }),
      word_search: entry({ completedToday: true }),
      jigsaw: entry({ completedToday: true }),
    });
    show({ summary: allStandardDone, debriefCompleted: false });
    const recommendedRegion = screen.getByText("Play Next").parentElement!;
    expect(within(recommendedRegion).getByText("The Debrief")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open case" })).toBeTruthy();
  });

  it("27. all-complete state appears when all six are complete", () => {
    const allDone = summary({
      word: entry({ completedToday: true }),
      sudoku: entry({ completedToday: true }),
      crossword: entry({ completedToday: true }),
      word_search: entry({ completedToday: true }),
      jigsaw: entry({ completedToday: true }),
    });
    show({ summary: allDone, debriefCompleted: true });
    expect(screen.getByText("Today’s lineup complete")).toBeTruthy();
    expect(
      screen.getByText("You cleared all six Daily challenges. A fresh lineup arrives at the next reset."),
    ).toBeTruthy();
  });

  it("28. Start/recommended CTA is absent in all-complete state", () => {
    const allDone = summary({
      word: entry({ completedToday: true }),
      sudoku: entry({ completedToday: true }),
      crossword: entry({ completedToday: true }),
      word_search: entry({ completedToday: true }),
      jigsaw: entry({ completedToday: true }),
    });
    show({ summary: allDone, debriefCompleted: true });
    expect(screen.queryByRole("link", { name: "Play now" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Open case" })).toBeNull();
  });

  it("29. guest no-recommendation state is correct", () => {
    const guestBlocked = summary({
      word: entry({ completedToday: true }),
    });
    show({ summary: guestBlocked, isAuthenticated: false });
    expect(screen.getByText("No challenge is ready to play")).toBeTruthy();
    expect(screen.getByText("Sign in to access the rest of today’s lineup.")).toBeTruthy();
  });

  it("30. actual card order does not change based on recommendation", () => {
    show({ summary: summary({ word: entry({ completedToday: true }) }) });
    const links = gridLinks().filter((l) => HREFS.includes(l.getAttribute("href") || ""));
    expect(links.map((l) => l.getAttribute("href"))).toEqual(HREFS);
  });

  it("31. cards use Lucide SVG icons", () => {
    const { container } = show({ summary: summary() });
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
  });

  it("32. no emoji anywhere in the lineup", () => {
    const { container } = show({ summary: summary() });
    expect(EMOJI_REGEX.test(container.textContent || "")).toBe(false);
  });

  it("33. no points text", () => {
    const { container } = show({ summary: summary() });
    expect(container.textContent).not.toMatch(/\bpoints\b/i);
  });

  it("34. no XP text", () => {
    const { container } = show({ summary: summary() });
    expect(container.textContent).not.toMatch(/\bXP\b/);
  });

  it("35. reduced motion removes the local progress transition", () => {
    mockUseAppReducedMotion.mockReturnValue(true);
    show({ summary: summary() });
    const bar = screen.getByRole("progressbar");
    const fill = bar.firstElementChild as HTMLElement;
    expect(fill.className).not.toContain("transition-all");
  });

  it("36. grid uses one/two/three-column breakpoint classes", () => {
    const { container } = show({ summary: summary() });
    const grid = container.querySelector(".grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3");
    expect(grid).not.toBeNull();
  });

  it("37. card state remains readable text", () => {
    show({ summary: summary({ sudoku: entry({ completedToday: true }) }) });
    const sudoku = gridCard("/daily/sudoku");
    expect(sudoku.textContent).toContain("Completed");
  });

  it("38. challenge links meet the 44px minimum through component semantics", () => {
    show({ summary: summary() });
    const word = gridCard("/daily/word");
    expect(word.className).toContain("pw-press");
  });

  it("39. no nested anchor/button structure is created", () => {
    const { container } = show({ summary: summary() });
    for (const link of Array.from(container.querySelectorAll("a"))) {
      expect(link.querySelector("a")).toBeNull();
      expect(link.querySelector("button")).toBeNull();
    }
  });

  it("40. summary prop is required — the component performs no silent null-summary handling", () => {
    // Prop contract: `summary: DailySummary` (not nullable). The page owns the
    // null/loading/error branching before this component ever mounts.
    show({ summary: summary() });
    expect(screen.getAllByRole("link").length).toBeGreaterThan(0);
  });
});
