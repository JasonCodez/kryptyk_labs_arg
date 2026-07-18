/** @jest-environment jsdom */

import { act, cleanup, render, screen } from "@testing-library/react";
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

type HubPuzzle = { id: string; puzzleType?: string; isBossPuzzle?: boolean; userProgress?: Array<{ solved: boolean }> };

function mockFetch(puzzles: HubPuzzle[]) {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(puzzles) } as Response)
  ) as jest.Mock;
}

async function renderHub() {
  render(<PuzzlesHub />);
  await act(async () => {
    await Promise.resolve();
  });
}

describe("Campaign hub", () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({ status: "authenticated" });
    mockPush.mockClear();
  });
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it("redirects guests to sign in (behavior preserved)", async () => {
    mockUseSession.mockReturnValue({ status: "unauthenticated" });
    mockFetch([]);
    await renderHub();
    expect(mockPush).toHaveBeenCalledWith("/auth/signin");
  });

  it("summarizes solved counts, progress, and campaign routes", async () => {
    mockFetch([
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
    // Gated (boss-containing) campaign is labeled "Campaign", open sets "Open Set".
    const riddle = document.querySelector('a[href="/puzzles/type/riddle"]')!;
    expect(riddle.textContent).toContain("Campaign");
    expect(sudoku.textContent).toContain("Open Set");
  });

  it("marks fully solved campaigns complete with the success treatment", async () => {
    mockFetch([
      { id: "1", puzzleType: "jigsaw", userProgress: [{ solved: true }] },
      { id: "2", puzzleType: "jigsaw", userProgress: [{ solved: true }] },
    ]);
    await renderHub();
    const jigsaw = document.querySelector('a[href="/puzzles/type/jigsaw"]')!;
    expect(jigsaw.textContent).toContain("✓ Complete");
    expect(jigsaw.textContent).toContain("2 of 2 cleared");
  });

  it("renders an intentional empty state with a next action", async () => {
    mockFetch([]);
    await renderHub();
    expect(screen.getByText("No campaigns available yet")).toBeTruthy();
    expect(document.querySelector('a[href="/daily"]')).not.toBeNull();
  });
});
