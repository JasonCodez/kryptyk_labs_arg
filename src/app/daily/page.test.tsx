/** @jest-environment jsdom */

import { act, cleanup, render, screen } from "@testing-library/react";
import DailyHubPage from "./page";

const mockUseSession = jest.fn();
jest.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

type SummaryEntry = { dayNumber: number; completedToday: boolean; streak: number; available: boolean };

function entry(overrides: Partial<SummaryEntry> = {}): SummaryEntry {
  return { dayNumber: 12, completedToday: false, streak: 0, available: true, ...overrides };
}

function mockFetch(summary: unknown, debrief: unknown = { completed: false }) {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes("/api/debrief/today") ? debrief : summary;
    return Promise.resolve({ ok: body !== null, json: () => Promise.resolve(body) } as Response);
  }) as jest.Mock;
}

async function renderHub() {
  render(<DailyHubPage />);
  // Let the summary/debrief fetches resolve.
  await act(async () => {
    await Promise.resolve();
  });
}

const FULL_SUMMARY = {
  word: entry({ streak: 4 }),
  sudoku: entry({ completedToday: true, streak: 2 }),
  crossword: entry(),
  word_search: entry({ available: false }),
  jigsaw: entry(),
};

describe("Daily hub", () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({ status: "authenticated" });
  });
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it("shows a loading status before the summary resolves", () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;
    render(<DailyHubPage />);
    expect(screen.getByRole("status").textContent).toMatch(/loading today's puzzles/i);
    expect(screen.getByText(/resets in/i)).toBeTruthy();
  });

  it("renders all six cards with their routes", async () => {
    mockFetch(FULL_SUMMARY);
    await renderHub();
    const hrefs = ["/daily/word", "/daily/sudoku", "/daily/crossword", "/daily/word-search", "/daily/jigsaw", "/debrief"];
    for (const href of hrefs) {
      expect(document.querySelector(`a[href="${href}"]`)).not.toBeNull();
    }
  });

  it("marks completed puzzles with a Done label and 'View result' affordance", async () => {
    mockFetch(FULL_SUMMARY);
    await renderHub();
    const sudoku = document.querySelector('a[href="/daily/sudoku"]')!;
    expect(sudoku.textContent).toContain("✓ Done");
    expect(sudoku.textContent).toContain("View result");
    expect(sudoku.textContent).not.toContain("Play now");
  });

  it("shows a play affordance and gold streak chip on available cards", async () => {
    mockFetch(FULL_SUMMARY);
    await renderHub();
    const word = document.querySelector('a[href="/daily/word"]')!;
    expect(word.textContent).toContain("Play now");
    expect(screen.getByLabelText("4 day streak")).toBeTruthy();
    // Zero-streak available cards show no streak chip.
    const crossword = document.querySelector('a[href="/daily/crossword"]')!;
    expect(crossword.textContent).not.toContain("🔥");
  });

  it("shows a not-ready message without a play affordance", async () => {
    mockFetch(FULL_SUMMARY);
    await renderHub();
    const trove = document.querySelector('a[href="/daily/word-search"]')!;
    expect(trove.textContent).toContain("Not ready yet");
    expect(trove.textContent).not.toContain("Play now");
  });

  it("locks sign-in-required cards for guests with an explicit label and lock icon", async () => {
    mockUseSession.mockReturnValue({ status: "unauthenticated" });
    mockFetch(FULL_SUMMARY);
    await renderHub();
    const sudoku = document.querySelector('a[href="/daily/sudoku"]')!;
    expect(sudoku.textContent).toContain("Sign in to play");
    expect(sudoku.textContent).toContain("🔒");
    // Hidden Word never requires sign-in.
    const word = document.querySelector('a[href="/daily/word"]')!;
    expect(word.textContent).not.toContain("Sign in to play");
  });

  it("renders the Debrief special card states", async () => {
    mockFetch(FULL_SUMMARY, { completed: true });
    await renderHub();
    const debrief = document.querySelector('a[href="/debrief"]')!;
    expect(debrief.textContent).toContain("The Debrief");
    expect(debrief.textContent).toContain("✓ Done");
    expect(debrief.textContent).toContain("Come back tomorrow");
  });
});
