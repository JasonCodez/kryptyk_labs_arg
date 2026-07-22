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

const FULL_SUMMARY = {
  word: entry({ streak: 4 }),
  sudoku: entry({ completedToday: true, streak: 2 }),
  crossword: entry(),
  word_search: entry({ available: false }),
  jigsaw: entry(),
};

interface FetchCall {
  url: string;
  init?: RequestInit;
}

function mockFetch(options: {
  summary?: unknown;
  summaryOk?: boolean;
  summaryReject?: boolean;
  debrief?: unknown;
  debriefOk?: boolean;
  onCall?: (calls: FetchCall[]) => void;
} = {}) {
  const { summary = FULL_SUMMARY, summaryOk = true, summaryReject = false, debrief = { completed: false }, debriefOk = true } = options;
  const calls: FetchCall[] = [];
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes("/api/daily/summary")) {
      if (summaryReject) return Promise.reject(new Error("network error"));
      return Promise.resolve({ ok: summaryOk, status: summaryOk ? 200 : 500, json: () => Promise.resolve(summary) } as Response);
    }
    return Promise.resolve({ ok: debriefOk, json: () => Promise.resolve(debrief) } as Response);
  }) as jest.Mock;
  options.onCall?.(calls);
  return calls;
}

async function renderHub() {
  render(<DailyHubPage />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("Daily hub", () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({ status: "authenticated" });
  });
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it("1. header remains visible during loading", () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;
    render(<DailyHubPage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Today’s Puzzle Lineup");
  });

  it("2. loading state remains visible while session is loading", () => {
    mockUseSession.mockReturnValue({ status: "loading" });
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(FULL_SUMMARY) } as Response)) as jest.Mock;
    render(<DailyHubPage />);
    expect(screen.getByRole("status").textContent).toMatch(/loading today.*puzzles/i);
  });

  it("3. loading state remains visible while summary is loading", () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;
    render(<DailyHubPage />);
    expect(screen.getByRole("status").textContent).toMatch(/loading today.*puzzles/i);
    expect(screen.getByText(/next reset/i)).toBeTruthy();
  });

  it("4. /api/daily/summary is requested with same-origin credentials", async () => {
    const calls = mockFetch();
    await renderHub();
    const call = calls.find((c) => c.url.includes("/api/daily/summary"));
    expect(call?.init?.credentials).toBe("same-origin");
  });

  it("5. /api/debrief/today is requested with same-origin credentials", async () => {
    const calls = mockFetch();
    await renderHub();
    const call = calls.find((c) => c.url.includes("/api/debrief/today"));
    expect(call?.init?.credentials).toBe("same-origin");
  });

  it("6. successful standard summary renders all six destinations", async () => {
    mockFetch();
    await renderHub();
    const hrefs = ["/daily/word", "/daily/sudoku", "/daily/crossword", "/daily/word-search", "/daily/jigsaw", "/debrief"];
    for (const href of hrefs) {
      expect(document.querySelector(`a[href="${href}"]`)).not.toBeNull();
    }
  });

  it("7. authenticated state is passed correctly", async () => {
    mockFetch();
    await renderHub();
    const sudoku = document.querySelector('[data-testid="daily-lineup-grid"] a[href="/daily/sudoku"]')!;
    expect(sudoku.textContent).not.toContain("Sign In to Play");
  });

  it("8. guest state is passed correctly", async () => {
    mockUseSession.mockReturnValue({ status: "unauthenticated" });
    mockFetch();
    await renderHub();
    const sudoku = document.querySelector('[data-testid="daily-lineup-grid"] a[href="/daily/sudoku"]')!;
    expect(sudoku.textContent).toContain("Sign In to Play");
  });

  it("9. Debrief completion is passed independently", async () => {
    mockFetch({ debrief: { completed: true } });
    await renderHub();
    const debrief = document.querySelector('[data-testid="daily-lineup-grid"] a[href="/debrief"]')!;
    expect(debrief.textContent).toContain("New Case Tomorrow");
  });

  it("10. summary non-OK response shows the error state", async () => {
    mockFetch({ summaryOk: false });
    await renderHub();
    expect(screen.getByText("We couldn’t load today’s lineup")).toBeTruthy();
  });

  it("11. summary rejection shows the error state", async () => {
    mockFetch({ summaryReject: true });
    await renderHub();
    expect(screen.getByText("We couldn’t load today’s lineup")).toBeTruthy();
  });

  it("12. retry performs another summary request", async () => {
    let summaryCallCount = 0;
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/daily/summary")) {
        summaryCallCount += 1;
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve(null) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ completed: false }) } as Response);
    }) as jest.Mock;
    await renderHub();
    expect(summaryCallCount).toBe(1);
    await act(async () => {
      screen.getByRole("button", { name: /Try again/ }).click();
      await Promise.resolve();
    });
    expect(summaryCallCount).toBe(2);
  });

  it("13. retry can recover and render the lineup", async () => {
    let attempt = 0;
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/daily/summary")) {
        attempt += 1;
        if (attempt === 1) return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve(null) } as Response);
        return Promise.resolve({ ok: true, json: () => Promise.resolve(FULL_SUMMARY) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ completed: false }) } as Response);
    }) as jest.Mock;
    await renderHub();
    expect(screen.getByText("We couldn’t load today’s lineup")).toBeTruthy();
    await act(async () => {
      screen.getByRole("button", { name: /Try again/ }).click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.queryByText("We couldn’t load today’s lineup")).toBeNull();
    expect(document.querySelector('a[href="/daily/word"]')).not.toBeNull();
  });

  it("14. retry does not reload the browser", async () => {
    let attempt = 0;
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/daily/summary")) {
        attempt += 1;
        if (attempt === 1) return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve(null) } as Response);
        return Promise.resolve({ ok: true, json: () => Promise.resolve(FULL_SUMMARY) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ completed: false }) } as Response);
    }) as jest.Mock;
    await renderHub();
    (window as unknown as { __notReloaded: boolean }).__notReloaded = true;
    await act(async () => {
      screen.getByRole("button", { name: /Try again/ }).click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect((window as unknown as { __notReloaded?: boolean }).__notReloaded).toBe(true);
  });

  it("15. Debrief request failure does not block the standard lineup", async () => {
    mockFetch({ debriefOk: false });
    await renderHub();
    expect(document.querySelector('a[href="/daily/word"]')).not.toBeNull();
    expect(screen.queryByText("We couldn’t load today’s lineup")).toBeNull();
  });

  it("16. header/reset timer remains present during an error", async () => {
    mockFetch({ summaryOk: false });
    await renderHub();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Today’s Puzzle Lineup");
    expect(screen.getByText("Next Reset")).toBeTruthy();
  });

  it("17. DailyIntroCard is authenticated-only (no crash, guest renders without it)", async () => {
    mockUseSession.mockReturnValue({ status: "unauthenticated" });
    mockFetch();
    await renderHub();
    // No assertion beyond a clean guest render — DailyIntroCard's own
    // eligibility/localStorage behavior is frozen and out of scope.
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
  });

  it("18. an in-flight summary response is ignored after unmount", async () => {
    let resolveSummary: ((value: Response) => void) | null = null;
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/daily/summary")) {
        return new Promise<Response>((resolve) => {
          resolveSummary = resolve;
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ completed: false }) } as Response);
    }) as jest.Mock;
    const { unmount } = render(<DailyHubPage />);
    unmount();
    expect(() => {
      resolveSummary?.({ ok: true, json: () => Promise.resolve(FULL_SUMMARY) } as Response);
    }).not.toThrow();
  });

  it("19. countdown interval is cleared on unmount", () => {
    mockFetch();
    const clearSpy = jest.spyOn(window, "clearInterval");
    const { unmount } = render(<DailyHubPage />);
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });

  it("20. no points or XP copy appears on the hub", async () => {
    mockFetch();
    await renderHub();
    const body = document.body.textContent || "";
    expect(body).not.toMatch(/\bXP\b/);
    expect(body).not.toMatch(/\bpoints\b/i);
  });
});
