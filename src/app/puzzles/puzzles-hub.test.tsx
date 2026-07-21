/** @jest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import PuzzlesHub from "./puzzles-hub";

const mockUseSession = jest.fn();
const mockPush = jest.fn();
// Stable router identity — a fresh object per render would re-trigger the
// [status, router] effect forever.
const stableRouter = { push: mockPush };
jest.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));
jest.mock("next/navigation", () => ({
  useRouter: () => stableRouter,
}));

const mockUseAppReducedMotion = jest.fn();
jest.mock("@/hooks/useAppReducedMotion", () => ({
  useAppReducedMotion: () => mockUseAppReducedMotion(),
}));

type HubPuzzle = { id: string; puzzleType?: string; isBossPuzzle?: boolean; userProgress?: Array<{ solved: boolean }> };

function mockFetchOk(puzzles: HubPuzzle[]) {
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(puzzles) } as Response)) as jest.Mock;
}

function mockFetchFail() {
  global.fetch = jest.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve(null) } as Response)) as jest.Mock;
}

/** Scoped to the campaign grid — the Continue spotlight (a separate,
 * filter-independent section) can link to the same route and would
 * otherwise be matched first by a document-wide query. */
function gridCard(href: string): Element | null {
  const grid = document.querySelector('[data-testid="campaign-grid"]');
  return grid ? grid.querySelector(`a[href="${href}"]`) : null;
}

async function renderHub() {
  render(<PuzzlesHub />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

const EMOJI_REGEX = /\p{Extended_Pictographic}/u;

/** Flushes a requestAnimationFrame-scheduled callback (mocked below as a
 * real setTimeout(0)) — a Promise microtask flush alone isn't enough since
 * rAF callbacks run as a macrotask. */
async function flushScheduledFocus() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("Puzzle Library hub", () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({ status: "authenticated" });
    mockUseAppReducedMotion.mockReturnValue(false);
    mockPush.mockClear();
    // jsdom has no real requestAnimationFrame — back it with a macrotask so
    // scheduleSearchFocus's timing behaves the same as a real browser.
    window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 0) as unknown as number) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as typeof window.cancelAnimationFrame;
  });
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it("redirects guests to sign in (behavior preserved)", async () => {
    mockUseSession.mockReturnValue({ status: "unauthenticated" });
    mockFetchOk([]);
    await renderHub();
    expect(mockPush).toHaveBeenCalledWith("/auth/signin");
  });

  it("authenticated users fetch /api/puzzles?limit=500", async () => {
    mockFetchOk([{ id: "1", puzzleType: "sudoku", userProgress: [{ solved: true }] }]);
    await renderHub();
    expect(global.fetch).toHaveBeenCalledWith("/api/puzzles?limit=500");
  });

  it("summarizes totals, solved counts, accessible progress values, and campaign routes", async () => {
    mockFetchOk([
      { id: "1", puzzleType: "sudoku", userProgress: [{ solved: true }] },
      { id: "2", puzzleType: "sudoku", userProgress: [{ solved: false }] },
      { id: "3", puzzleType: "sudoku" },
      { id: "4", puzzleType: "riddle", isBossPuzzle: true },
    ]);
    await renderHub();

    const sudoku = document.querySelector('a[href="/puzzles/type/sudoku"]')!;
    expect(sudoku).not.toBeNull();
    expect(sudoku.textContent).toContain("1 of 3 cleared");
    const bar = sudoku.querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute("aria-valuenow")).toBe("1");
    expect(bar.getAttribute("aria-valuemax")).toBe("3");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
  });

  it("shows Boss finale on a campaign containing a boss puzzle", async () => {
    mockFetchOk([{ id: "1", puzzleType: "riddle", isBossPuzzle: true }]);
    await renderHub();
    const riddle = document.querySelector('a[href="/puzzles/type/riddle"]')!;
    expect(riddle.textContent).toContain("Boss finale");
  });

  it("labels a fully solved campaign Completed", async () => {
    mockFetchOk([
      { id: "1", puzzleType: "jigsaw", userProgress: [{ solved: true }] },
      { id: "2", puzzleType: "jigsaw", userProgress: [{ solved: true }] },
    ]);
    await renderHub();
    const jigsaw = document.querySelector('a[href="/puzzles/type/jigsaw"]')!;
    expect(jigsaw.textContent).toContain("Completed");
    expect(jigsaw.textContent).toContain("2 of 2 cleared");
  });

  it("labels a partially solved campaign In Progress", async () => {
    mockFetchOk([
      { id: "1", puzzleType: "sudoku", userProgress: [{ solved: true }] },
      { id: "2", puzzleType: "sudoku", userProgress: [{ solved: false }] },
    ]);
    await renderHub();
    const sudoku = gridCard("/puzzles/type/sudoku")!;
    expect(sudoku.textContent).toContain("In Progress");
  });

  it("labels an unstarted campaign Ready", async () => {
    mockFetchOk([{ id: "1", puzzleType: "riddle" }]);
    await renderHub();
    const riddle = document.querySelector('a[href="/puzzles/type/riddle"]')!;
    expect(riddle.textContent).toContain("Ready");
  });

  it("selects the highest-progress incomplete campaign as the Continue spotlight", async () => {
    mockFetchOk([
      { id: "1", puzzleType: "sudoku", userProgress: [{ solved: true }] },
      { id: "2", puzzleType: "sudoku", userProgress: [{ solved: true }] },
      { id: "3", puzzleType: "sudoku" },
      { id: "4", puzzleType: "sudoku" },
      { id: "5", puzzleType: "riddle", userProgress: [{ solved: true }] },
      { id: "6", puzzleType: "riddle" },
      { id: "7", puzzleType: "riddle" },
      { id: "8", puzzleType: "riddle" },
    ]);
    await renderHub();
    const spotlight = screen.getByTestId("continue-campaign");
    // sudoku: 2/4 = 50%, riddle: 1/4 = 25% — sudoku must win.
    expect(spotlight.textContent).toContain("Sudoku");
    expect(document.querySelectorAll('[data-testid="continue-campaign"]')).toHaveLength(1);
  });

  it("breaks a completion-percentage tie by solved count, then alphabetically", async () => {
    mockFetchOk([
      // math: 3/6 = 50%
      { id: "1", puzzleType: "math", userProgress: [{ solved: true }] },
      { id: "2", puzzleType: "math", userProgress: [{ solved: true }] },
      { id: "3", puzzleType: "math", userProgress: [{ solved: true }] },
      { id: "4", puzzleType: "math" },
      { id: "5", puzzleType: "math" },
      { id: "6", puzzleType: "math" },
      // anagram_blitz: 2/4 = 50%, fewer solved than math
      { id: "7", puzzleType: "anagram_blitz", userProgress: [{ solved: true }] },
      { id: "8", puzzleType: "anagram_blitz", userProgress: [{ solved: true }] },
      { id: "9", puzzleType: "anagram_blitz" },
      { id: "10", puzzleType: "anagram_blitz" },
    ]);
    await renderHub();
    expect(screen.getByTestId("continue-campaign").textContent).toContain("Math");
  });

  it("breaks an exact percentage-and-solved-count tie alphabetically", async () => {
    mockFetchOk([
      // code_master: 1/2 = 50%
      { id: "1", puzzleType: "code_master", userProgress: [{ solved: true }] },
      { id: "2", puzzleType: "code_master" },
      // arg: 1/2 = 50%, same solved count — "ARG" sorts before "Code Master"
      { id: "3", puzzleType: "arg", userProgress: [{ solved: true }] },
      { id: "4", puzzleType: "arg" },
    ]);
    await renderHub();
    expect(screen.getByTestId("continue-campaign").textContent).toContain("ARG");
  });

  it("does not show a Continue spotlight when nothing is in progress", async () => {
    mockFetchOk([{ id: "1", puzzleType: "jigsaw", userProgress: [{ solved: true }] }, { id: "2", puzzleType: "riddle" }]);
    await renderHub();
    expect(screen.queryByTestId("continue-campaign")).toBeNull();
  });

  it("computes correct progress-summary totals", async () => {
    // 2 campaigns, 5 puzzles total, 3 cleared — deliberately distinct values
    // so each summary stat can be located unambiguously.
    mockFetchOk([
      { id: "1", puzzleType: "sudoku", userProgress: [{ solved: true }] },
      { id: "2", puzzleType: "sudoku", userProgress: [{ solved: true }] },
      { id: "3", puzzleType: "sudoku" },
      { id: "4", puzzleType: "riddle", userProgress: [{ solved: true }] },
      { id: "5", puzzleType: "riddle" },
    ]);
    await renderHub();
    expect(screen.getByText("Campaigns")).toBeTruthy();
    expect(screen.getByText("Puzzles")).toBeTruthy();
    expect(screen.getByText("Cleared")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy(); // Campaigns
    expect(screen.getByText("5")).toBeTruthy(); // Puzzles
    expect(screen.getByText("3")).toBeTruthy(); // Cleared
  });

  describe("search and filtering", () => {
    async function renderThreeCampaigns() {
      mockFetchOk([
        { id: "1", puzzleType: "jigsaw", userProgress: [{ solved: true }] },
        { id: "2", puzzleType: "jigsaw", userProgress: [{ solved: true }] },
        { id: "3", puzzleType: "sudoku", userProgress: [{ solved: true }] },
        { id: "4", puzzleType: "sudoku" },
        { id: "5", puzzleType: "riddle", isBossPuzzle: true },
      ]);
      await renderHub();
    }

    it("filters campaigns by search case-insensitively", async () => {
      await renderThreeCampaigns();
      const input = screen.getByLabelText("Search campaigns");
      fireEvent.change(input, { target: { value: "JIG" } });

      expect(gridCard("/puzzles/type/jigsaw")).not.toBeNull();
      expect(gridCard("/puzzles/type/sudoku")).toBeNull();
      expect(gridCard("/puzzles/type/riddle")).toBeNull();
    });

    it("clears the search on Escape, keeps focus in the input, and does not reset the status filter", async () => {
      await renderThreeCampaigns();
      // In Progress first, so Escape's "restore all campaigns allowed by the
      // current status filter" is actually exercised (not just "all").
      fireEvent.click(screen.getByRole("button", { name: "In Progress" }));

      const input = screen.getByLabelText("Search campaigns") as HTMLInputElement;
      input.focus();
      fireEvent.change(input, { target: { value: "sud" } });
      expect(input.value).toBe("sud");
      fireEvent.keyDown(input, { key: "Escape" });

      expect(input.value).toBe("");
      expect(document.activeElement).toBe(input);
      expect(screen.getByRole("button", { name: "In Progress" }).getAttribute("aria-pressed")).toBe("true");
      expect(gridCard("/puzzles/type/sudoku")).not.toBeNull();
      expect(gridCard("/puzzles/type/jigsaw")).toBeNull();
    });

    it("the In Progress filter shows only in-progress campaigns", async () => {
      await renderThreeCampaigns();
      fireEvent.click(screen.getByRole("button", { name: "In Progress" }));
      expect(gridCard("/puzzles/type/sudoku")).not.toBeNull();
      expect(gridCard("/puzzles/type/jigsaw")).toBeNull();
      expect(gridCard("/puzzles/type/riddle")).toBeNull();
    });

    it("the Not Started filter shows only unstarted campaigns", async () => {
      await renderThreeCampaigns();
      fireEvent.click(screen.getByRole("button", { name: "Not Started" }));
      expect(gridCard("/puzzles/type/riddle")).not.toBeNull();
      expect(gridCard("/puzzles/type/sudoku")).toBeNull();
      expect(gridCard("/puzzles/type/jigsaw")).toBeNull();
    });

    it("the Completed filter shows only completed campaigns", async () => {
      await renderThreeCampaigns();
      fireEvent.click(screen.getByRole("button", { name: "Completed" }));
      expect(gridCard("/puzzles/type/jigsaw")).not.toBeNull();
      expect(gridCard("/puzzles/type/sudoku")).toBeNull();
      expect(gridCard("/puzzles/type/riddle")).toBeNull();
    });

    it("search and status filtering combine", async () => {
      await renderThreeCampaigns();
      fireEvent.click(screen.getByRole("button", { name: "Completed" }));
      const input = screen.getByLabelText("Search campaigns");
      fireEvent.change(input, { target: { value: "sudoku" } });
      // Completed + "sudoku" search matches nothing (sudoku is in-progress).
      expect(screen.getByText("No campaigns found")).toBeTruthy();
    });

    it("updates the visible result count as filters change", async () => {
      await renderThreeCampaigns();
      expect(screen.getByText("3 campaigns")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Completed" }));
      expect(screen.getByText("1 campaign")).toBeTruthy();
    });

    it("shows the filtered-empty state when search/filter yields no matches", async () => {
      await renderThreeCampaigns();
      const input = screen.getByLabelText("Search campaigns");
      fireEvent.change(input, { target: { value: "nonexistent puzzle type" } });
      expect(screen.getByText("No campaigns found")).toBeTruthy();
      expect(screen.getByText("Try a different search or clear your filters.")).toBeTruthy();
    });

    it("Clear filters restores all campaigns", async () => {
      await renderThreeCampaigns();
      const input = screen.getByLabelText("Search campaigns") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "nonexistent puzzle type" } });
      fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
      expect(input.value).toBe("");
      expect(document.querySelector('a[href="/puzzles/type/jigsaw"]')).not.toBeNull();
      expect(document.querySelector('a[href="/puzzles/type/sudoku"]')).not.toBeNull();
      expect(document.querySelector('a[href="/puzzles/type/riddle"]')).not.toBeNull();
    });

    it("the clear-search control meets the 44x44 minimum touch target", async () => {
      await renderThreeCampaigns();
      const input = screen.getByLabelText("Search campaigns");
      fireEvent.change(input, { target: { value: "jig" } });

      const clearButton = screen.getByLabelText("Clear search") as HTMLElement;
      // Explicit inline dimensions, not just an assumption the button exists.
      expect(clearButton.style.width).toBe("44px");
      expect(clearButton.style.height).toBe("44px");
      expect(clearButton.className).toContain("min-w-[44px]");
      expect(clearButton.className).toContain("min-h-[44px]");
    });

    it("Clear search restores focus to the search input after the button disappears", async () => {
      await renderThreeCampaigns();
      const input = screen.getByLabelText("Search campaigns") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "jig" } });

      const clearButton = screen.getByLabelText("Clear search");
      clearButton.focus();
      fireEvent.click(clearButton);

      // The button is removed the instant the query becomes empty.
      expect(screen.queryByLabelText("Clear search")).toBeNull();
      expect(input.value).toBe("");

      await flushScheduledFocus();

      expect(document.activeElement).toBe(input);
      expect(document.querySelector('a[href="/puzzles/type/jigsaw"]')).not.toBeNull();
      expect(document.querySelector('a[href="/puzzles/type/sudoku"]')).not.toBeNull();
      expect(document.querySelector('a[href="/puzzles/type/riddle"]')).not.toBeNull();
    });

    it("Clear filters restores focus to the search input after the filtered-empty controls disappear", async () => {
      await renderThreeCampaigns();
      fireEvent.click(screen.getByRole("button", { name: "Completed" }));
      const input = screen.getByLabelText("Search campaigns") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "sudoku" } });
      expect(screen.getByText("No campaigns found")).toBeTruthy();

      const clearFiltersButton = screen.getByRole("button", { name: "Clear filters" });
      clearFiltersButton.focus();
      fireEvent.click(clearFiltersButton);

      expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
      expect(input.value).toBe("");
      expect(screen.getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("true");

      await flushScheduledFocus();

      expect(document.activeElement).toBe(input);
      expect(document.querySelector('a[href="/puzzles/type/jigsaw"]')).not.toBeNull();
      expect(document.querySelector('a[href="/puzzles/type/sudoku"]')).not.toBeNull();
      expect(document.querySelector('a[href="/puzzles/type/riddle"]')).not.toBeNull();
    });
  });

  it("renders an intentional empty state with a Daily action when the API returns no campaigns", async () => {
    mockFetchOk([]);
    await renderHub();
    expect(screen.getByText("No campaigns available yet")).toBeTruthy();
    expect(document.querySelector('a[href="/daily"]')).not.toBeNull();
  });

  it("shows the error/retry state on a failed response", async () => {
    mockFetchFail();
    await renderHub();
    expect(screen.getByText("We couldn't load the puzzle library")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Try again/ })).toBeTruthy();
  });

  it("retry performs another request and can recover", async () => {
    mockFetchFail();
    await renderHub();
    expect(screen.getByText("We couldn't load the puzzle library")).toBeTruthy();

    mockFetchOk([{ id: "1", puzzleType: "sudoku", userProgress: [{ solved: true }] }]);
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByText("We couldn't load the puzzle library")).toBeNull();
    expect(document.querySelector('a[href="/puzzles/type/sudoku"]')).not.toBeNull();
  });

  it("the loading view has an accessible loading label", () => {
    mockUseSession.mockReturnValue({ status: "loading" });
    render(<PuzzlesHub />);
    expect(screen.getByRole("status", { name: "Loading puzzle library" })).toBeTruthy();
  });

  it("renders campaign identity through Lucide icons, not raw emoji", async () => {
    mockFetchOk([{ id: "1", puzzleType: "sudoku", userProgress: [{ solved: true }] }]);
    await renderHub();
    const sudoku = document.querySelector('a[href="/puzzles/type/sudoku"]')!;
    expect(sudoku.querySelector("svg")).not.toBeNull();
    expect(EMOJI_REGEX.test(sudoku.textContent || "")).toBe(false);
  });

  it("removes the local progress-bar transition under reduced motion", async () => {
    mockUseAppReducedMotion.mockReturnValue(true);
    mockFetchOk([{ id: "1", puzzleType: "sudoku", userProgress: [{ solved: true }] }]);
    await renderHub();
    const sudoku = document.querySelector('a[href="/puzzles/type/sudoku"]')!;
    const fill = sudoku.querySelector('[role="progressbar"] > div')!;
    expect(fill.className).not.toContain("transition-all");
  });

  it('"Browse individual puzzles" links to /puzzles?category=all', async () => {
    mockFetchOk([{ id: "1", puzzleType: "sudoku", userProgress: [{ solved: true }] }]);
    await renderHub();
    const link = screen.getByRole("link", { name: /Browse individual puzzles/ });
    expect(link.getAttribute("href")).toBe("/puzzles?category=all");
  });
});
