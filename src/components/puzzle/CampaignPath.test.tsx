/** @jest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import CampaignPath, { type CampaignPuzzle } from "./CampaignPath";

const mockUseAppReducedMotion = jest.fn();
jest.mock("@/hooks/useAppReducedMotion", () => ({
  useAppReducedMotion: () => mockUseAppReducedMotion(),
}));

jest.mock("@/components/puzzle/SolvedIconOverlay", () => ({
  __esModule: true,
  default: ({ animateIn }: { animateIn?: boolean }) => (
    <div data-testid="solved-overlay" data-animate-in={animateIn ? "true" : "false"} />
  ),
}));

const EMOJI_REGEX = /\p{Extended_Pictographic}/u;

function puzzle(overrides: Partial<CampaignPuzzle> & { id: string; title: string; order: number }): CampaignPuzzle {
  return {
    description: undefined,
    difficulty: "medium",
    createdAt: undefined,
    pointsReward: undefined,
    xpReward: undefined,
    puzzleType: "sudoku",
    locked: false,
    unlocksAfterTitle: null,
    isBossPuzzle: false,
    isTeamPuzzle: false,
    failed: false,
    failedReason: null,
    userProgress: [{ solved: false }],
    ...overrides,
  };
}

const onActivatePuzzle = jest.fn();

function renderPath(puzzles: CampaignPuzzle[], overrides: { puzzleType?: string; justCompletedId?: string | null } = {}) {
  onActivatePuzzle.mockClear();
  return render(
    <CampaignPath
      puzzleType={overrides.puzzleType ?? "sudoku"}
      puzzles={puzzles}
      justCompletedId={overrides.justCompletedId ?? null}
      onActivatePuzzle={onActivatePuzzle}
    />
  );
}

// The standard fixture used by most tests: p1 solved, p2 playable (the
// recommended next), p3 locked behind p2, p4 a locked boss finale.
const STANDARD_FIXTURE: CampaignPuzzle[] = [
  puzzle({ id: "p1", title: "First Steps", order: 1, userProgress: [{ solved: true }] }),
  puzzle({ id: "p2", title: "The Next Grid", order: 2, userProgress: [{ solved: false }] }),
  puzzle({ id: "p3", title: "Hidden Pattern", order: 3, locked: true, unlocksAfterTitle: "The Next Grid" }),
  puzzle({ id: "p4", title: "Master Grid", order: 4, locked: true, isBossPuzzle: true }),
];

beforeEach(() => {
  mockUseAppReducedMotion.mockReturnValue(false);
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe("CampaignPath", () => {
  it("1. renders the Puzzle Library back link", () => {
    renderPath(STANDARD_FIXTURE);
    const link = screen.getByRole("link", { name: /Puzzle Library/ });
    expect(link).toHaveProperty("href", expect.stringContaining("/puzzles"));
  });

  it("2. renders the campaign label from getPuzzleTypeLabel", () => {
    renderPath(STANDARD_FIXTURE, { puzzleType: "sudoku" });
    expect(screen.getByRole("heading", { level: 1, name: "Sudoku" })).toBeTruthy();
  });

  it("3. renders for a campaign without a boss puzzle", () => {
    const openCollection = [
      puzzle({ id: "a", title: "Alpha", order: 1 }),
      puzzle({ id: "b", title: "Beta", order: 2 }),
    ];
    renderPath(openCollection);
    expect(screen.getByRole("heading", { level: 2, name: "Campaign Path" })).toBeTruthy();
  });

  it("4. shows Open collection when no boss exists", () => {
    renderPath([puzzle({ id: "a", title: "Alpha", order: 1 })]);
    expect(screen.getByText("Open collection")).toBeTruthy();
    expect(screen.queryByText("Boss finale")).toBeNull();
  });

  it("5. shows Boss finale when a boss exists", () => {
    renderPath(STANDARD_FIXTURE);
    expect(screen.getByText("Boss finale")).toBeTruthy();
  });

  it("6. sorts challenges by order ascending", () => {
    const shuffled = [STANDARD_FIXTURE[2], STANDARD_FIXTURE[0], STANDARD_FIXTURE[3], STANDARD_FIXTURE[1]];
    renderPath(shuffled);
    const path = screen.getByTestId("campaign-challenge-path");
    const headings = within(path).getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(["First Steps", "The Next Grid", "Hidden Pattern", "Master Grid"]);
  });

  it("7. uses createdAt as the secondary ordering fallback", () => {
    const tied = [
      puzzle({ id: "later", title: "Later Created", order: 1, createdAt: "2024-02-01T00:00:00.000Z" }),
      puzzle({ id: "earlier", title: "Earlier Created", order: 1, createdAt: "2024-01-01T00:00:00.000Z" }),
    ];
    renderPath(tied);
    const path = screen.getByTestId("campaign-challenge-path");
    const headings = within(path).getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(["Earlier Created", "Later Created"]);
  });

  it("8. does not mutate the incoming puzzle array", () => {
    const original = [
      puzzle({ id: "z", title: "Zed", order: 2 }),
      puzzle({ id: "a", title: "Ay", order: 1 }),
    ];
    const snapshot = original.map((p) => p.id);
    renderPath(original);
    expect(original.map((p) => p.id)).toEqual(snapshot);
  });

  it("9. computes total challenge count correctly", () => {
    renderPath(STANDARD_FIXTURE);
    const stat = screen.getByText("Challenges").closest("div")!;
    expect(within(stat).getByText("4")).toBeTruthy();
  });

  it("10. computes solved count correctly", () => {
    renderPath(STANDARD_FIXTURE);
    const stat = screen.getByText("Cleared").closest("div")!;
    expect(within(stat).getByText("1")).toBeTruthy();
  });

  it("11. computes percentage correctly", () => {
    renderPath(STANDARD_FIXTURE);
    const stat = screen.getByText("Complete").closest("div")!;
    expect(within(stat).getByText("25%")).toBeTruthy();
  });

  it("12. provides correct progress-bar ARIA values", () => {
    renderPath(STANDARD_FIXTURE);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("4");
    expect(bar.getAttribute("aria-valuenow")).toBe("1");
    expect(bar.getAttribute("aria-label")).toBe("Sudoku campaign progress");
  });

  it("13. selects the first ordered playable puzzle as Up next", () => {
    renderPath(STANDARD_FIXTURE);
    const upNextLabels = screen.getAllByText("Up next");
    // One instance in the overview "Up next" eyebrow, one on the challenge card.
    expect(upNextLabels.length).toBeGreaterThanOrEqual(1);
    const card = screen.getByRole("button", { name: /The Next Grid — Up next/ });
    expect(card).toBeTruthy();
  });

  it("14. labels other playable puzzles Available", () => {
    const withTwoPlayable = [
      puzzle({ id: "p1", title: "First", order: 1 }),
      puzzle({ id: "p2", title: "Second", order: 2 }),
    ];
    renderPath(withTwoPlayable);
    expect(screen.getByRole("button", { name: /First — Up next/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Second — Available/ })).toBeTruthy();
  });

  it("15. labels solved puzzles Completed", () => {
    renderPath(STANDARD_FIXTURE);
    expect(screen.getByRole("button", { name: /First Steps — Completed/ })).toBeTruthy();
  });

  it("16. labels locked puzzles Locked", () => {
    renderPath(STANDARD_FIXTURE);
    const lockedCard = screen.getByText("Hidden Pattern").closest("div[aria-disabled='true']");
    expect(lockedCard).not.toBeNull();
    expect(within(lockedCard as HTMLElement).getByText("Locked")).toBeTruthy();
  });

  it("17. labels failed puzzles Failed", () => {
    const withFailed = [
      ...STANDARD_FIXTURE.slice(0, 2),
      puzzle({ id: "fail1", title: "Broken Case", order: 5, failed: true, failedReason: "given_up" }),
    ];
    renderPath(withFailed);
    const failedCard = screen.getByText("Broken Case").closest("div[aria-disabled='true']");
    expect(failedCard).not.toBeNull();
    expect(within(failedCard as HTMLElement).getByText("Failed")).toBeTruthy();
  });

  it("18. uses solved -> locked -> failed -> playable precedence", () => {
    const contradictory = [
      puzzle({ id: "x", title: "Everything At Once", order: 1, locked: true, failed: true, userProgress: [{ solved: true }] }),
    ];
    renderPath(contradictory);
    expect(screen.getByRole("button", { name: /Everything At Once — Completed/ })).toBeTruthy();
  });

  it("19. shows Start campaign with zero solved challenges", () => {
    const zeroSolved = [puzzle({ id: "a", title: "Alpha", order: 1 })];
    renderPath(zeroSolved);
    expect(screen.getByRole("button", { name: "Start campaign" })).toBeTruthy();
  });

  it("20. shows Continue campaign with partial progress", () => {
    renderPath(STANDARD_FIXTURE);
    expect(screen.getByRole("button", { name: "Continue campaign" })).toBeTruthy();
  });

  it("21. shows Campaign complete when all challenges are solved", () => {
    const complete = [
      puzzle({ id: "a", title: "Alpha", order: 1, userProgress: [{ solved: true }] }),
      puzzle({ id: "b", title: "Beta", order: 2, userProgress: [{ solved: true }] }),
    ];
    renderPath(complete);
    expect(screen.getByText("Campaign complete")).toBeTruthy();
    expect(screen.getByText("Every challenge in this campaign has been cleared.")).toBeTruthy();
  });

  it("22. hides Start/Continue when complete", () => {
    const complete = [puzzle({ id: "a", title: "Alpha", order: 1, userProgress: [{ solved: true }] })];
    renderPath(complete);
    expect(screen.queryByRole("button", { name: "Start campaign" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Continue campaign" })).toBeNull();
  });

  it("23. shows the blocked state when incomplete with no playable challenge", () => {
    const blocked = [
      puzzle({ id: "a", title: "Alpha", order: 1, userProgress: [{ solved: true }] }),
      puzzle({ id: "b", title: "Beta", order: 2, locked: true, unlocksAfterTitle: "Alpha" }),
    ];
    // Both puzzles resolved/locked — nothing playable — but not complete.
    const notComplete = [blocked[0], blocked[1], puzzle({ id: "c", title: "Gamma", order: 3, locked: true })];
    renderPath(notComplete);
    expect(screen.getByText("No challenge is currently available")).toBeTruthy();
    expect(screen.getByText("Complete the required challenge or review the lock details below.")).toBeTruthy();
  });

  it("24. Start/Continue activates the expected puzzle ID", () => {
    renderPath(STANDARD_FIXTURE);
    screen.getByRole("button", { name: "Continue campaign" }).click();
    expect(onActivatePuzzle).toHaveBeenCalledWith("p2");
  });

  it("25. Up-next card activates the expected puzzle ID", () => {
    renderPath(STANDARD_FIXTURE);
    screen.getByRole("button", { name: /The Next Grid — Up next/ }).click();
    expect(onActivatePuzzle).toHaveBeenCalledWith("p2");
  });

  it("26. Available card activates its puzzle ID", () => {
    const withTwoPlayable = [
      puzzle({ id: "p1", title: "First", order: 1 }),
      puzzle({ id: "p2", title: "Second", order: 2 }),
    ];
    renderPath(withTwoPlayable);
    screen.getByRole("button", { name: /Second — Available/ }).click();
    expect(onActivatePuzzle).toHaveBeenCalledWith("p2");
  });

  it("27. Completed card activates its puzzle ID", () => {
    renderPath(STANDARD_FIXTURE);
    screen.getByRole("button", { name: /First Steps — Completed/ }).click();
    expect(onActivatePuzzle).toHaveBeenCalledWith("p1");
  });

  it("28. locked cards are not buttons", () => {
    renderPath(STANDARD_FIXTURE);
    expect(screen.queryByRole("button", { name: /Hidden Pattern/ })).toBeNull();
    const lockedCard = screen.getByText("Hidden Pattern").closest("div[aria-disabled='true']");
    expect(lockedCard?.tagName).toBe("DIV");
  });

  it("29. failed cards are not buttons", () => {
    const withFailed = [...STANDARD_FIXTURE.slice(0, 2), puzzle({ id: "fail1", title: "Broken Case", order: 5, failed: true })];
    renderPath(withFailed);
    expect(screen.queryByRole("button", { name: /Broken Case/ })).toBeNull();
  });

  it("30. locked card shows unlocksAfterTitle", () => {
    renderPath(STANDARD_FIXTURE);
    expect(screen.getByText('Complete "The Next Grid" first')).toBeTruthy();
  });

  it("31. locked fallback copy is correct when unlocksAfterTitle is absent", () => {
    const noFallbackTitle = [
      puzzle({ id: "a", title: "Alpha", order: 1 }),
      puzzle({ id: "b", title: "Beta", order: 2, locked: true, unlocksAfterTitle: null }),
    ];
    renderPath(noFallbackTitle);
    expect(screen.getByText("Complete the previous challenge first")).toBeTruthy();
  });

  it("32. failure reason formatting remains correct", () => {
    const reasons: Array<[string, string]> = [
      ["time_limit", "Time limit reached"],
      ["time_expired", "Time expired"],
      ["max_attempts", "Maximum submissions reached"],
      ["given_up", "Gave up"],
      ["incorrect_submission", "Wrong answer (case locked)"],
      ["something_else", "Failed"],
    ];
    for (const [reason, expected] of reasons) {
      cleanup();
      renderPath([puzzle({ id: "f", title: "Failure Case", order: 1, failed: true, failedReason: reason })]);
      expect(screen.getByText(expected)).toBeTruthy();
    }
  });

  it("33. interactive challenge controls meet the 44px minimum through classes or style", () => {
    renderPath(STANDARD_FIXTURE);
    const card = screen.getByRole("button", { name: /The Next Grid — Up next/ }) as HTMLElement;
    const meetsMinimum = card.className.includes("min-h-[44px]") || card.style.minHeight === "44px";
    expect(meetsMinimum).toBe(true);
  });

  it("34. every challenge retains id=\"puzzle-[id]\"", () => {
    renderPath(STANDARD_FIXTURE);
    for (const p of STANDARD_FIXTURE) {
      expect(document.getElementById(`puzzle-${p.id}`)).not.toBeNull();
    }
  });

  it("35. the just-completed challenge renders the existing solved overlay", () => {
    renderPath(STANDARD_FIXTURE, { justCompletedId: "p1" });
    const overlay = screen.getByTestId("solved-overlay");
    expect(overlay.getAttribute("data-animate-in")).toBe("true");
  });

  it("does not animate the solved overlay for a challenge that was not just completed", () => {
    const twoSolved = [
      puzzle({ id: "p1", title: "First Steps", order: 1, userProgress: [{ solved: true }] }),
      puzzle({ id: "p2", title: "Second Solve", order: 2, userProgress: [{ solved: true }] }),
    ];
    renderPath(twoSolved, { justCompletedId: "p2" });
    const overlays = screen.getAllByTestId("solved-overlay");
    expect(overlays.map((o) => o.getAttribute("data-animate-in")).sort()).toEqual(["false", "true"]);
  });

  it("36. reward chips render only when values exist", () => {
    const rewarded = [puzzle({ id: "a", title: "Rewarded", order: 1, xpReward: 50, pointsReward: 10 })];
    renderPath(rewarded);
    const rewardedPath = within(screen.getByTestId("campaign-challenge-path"));
    expect(rewardedPath.getByText("50 XP")).toBeTruthy();
    expect(rewardedPath.getByText("10 points")).toBeTruthy();

    cleanup();
    const unrewarded = [puzzle({ id: "b", title: "Unrewarded", order: 1 })];
    renderPath(unrewarded);
    const unrewardedPath = within(screen.getByTestId("campaign-challenge-path"));
    expect(unrewardedPath.queryByText(/XP/)).toBeNull();
    expect(unrewardedPath.queryByText(/points/)).toBeNull();
  });

  it("37. campaign identity and states use SVG/Lucide icons rather than raw emoji", () => {
    const { container } = renderPath(STANDARD_FIXTURE);
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
    expect(EMOJI_REGEX.test(container.textContent || "")).toBe(false);
  });

  it("38. reduced motion removes the local progress transition", () => {
    mockUseAppReducedMotion.mockReturnValue(true);
    renderPath(STANDARD_FIXTURE);
    const bar = screen.getByRole("progressbar");
    const fill = bar.firstElementChild as HTMLElement;
    expect(fill.className).not.toContain("transition-all");
  });

  it("39. empty campaign state links back to /puzzles", () => {
    renderPath([]);
    expect(screen.getByText("No challenges available")).toBeTruthy();
    expect(screen.getByText("This campaign does not have any playable challenges yet.")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Back to Puzzle Library" });
    expect(link).toHaveProperty("href", expect.stringContaining("/puzzles"));
  });

  it("40. no horizontal-scroller class is present in the campaign path", () => {
    const { container } = renderPath(STANDARD_FIXTURE);
    expect(container.querySelector(".overflow-x-auto")).toBeNull();
    expect(container.querySelector(".no-scrollbar")).toBeNull();
  });
});
