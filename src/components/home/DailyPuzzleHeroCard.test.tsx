/** @jest-environment jsdom */

import { act, cleanup, render, screen } from "@testing-library/react";
import DailyPuzzleHeroCard from "./DailyPuzzleHeroCard";

type Entry = { dayNumber: number; completedToday: boolean; streak: number; available: boolean };
type Key = "word" | "sudoku" | "crossword" | "word_search" | "jigsaw";

function entry(overrides: Partial<Entry> = {}): Entry {
  return { dayNumber: 200, completedToday: false, streak: 0, available: true, ...overrides };
}

function summaryFixture(overrides: Partial<Record<Key, Partial<Entry>>> = {}) {
  const base: Record<Key, Entry> = {
    word: entry(),
    sudoku: entry(),
    crossword: entry(),
    word_search: entry(),
    jigsaw: entry(),
  };
  for (const key of Object.keys(overrides) as Key[]) {
    base[key] = entry(overrides[key]);
  }
  return base;
}

function mockFetchOnce(body: unknown, ok = true) {
  global.fetch = jest.fn(() => Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response)) as jest.Mock;
}

async function renderCard() {
  const result = render(<DailyPuzzleHeroCard />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return result;
}

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  document.documentElement.removeAttribute("data-reduce-animations");
});

describe("DailyPuzzleHeroCard", () => {
  it("standard progress: two of five complete", async () => {
    mockFetchOnce(summaryFixture({ word: { completedToday: true }, sudoku: { completedToday: true } }));
    await renderCard();

    const link = document.querySelector('a[href="/daily"]');
    expect(link).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Your daily puzzle run starts here." })).toBeTruthy();

    const bar = screen.getByRole("progressbar", { name: "Daily puzzle completion" });
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("5");
    expect(bar.getAttribute("aria-valuenow")).toBe("2");
    expect(bar.getAttribute("aria-valuetext")).toContain("2 of 5");

    expect(screen.getByText("2 of 5 complete today")).toBeTruthy();
    expect(link!.textContent).toContain("Continue Daily Run");
  });

  it("no progress: CTA reads Start Daily Run", async () => {
    mockFetchOnce(summaryFixture());
    await renderCard();
    const link = document.querySelector('a[href="/daily"]')!;
    expect(link.textContent).toContain("Start Daily Run");
  });

  it("all complete: heading and CTA reflect completion", async () => {
    mockFetchOnce(
      summaryFixture({
        word: { completedToday: true },
        sudoku: { completedToday: true },
        crossword: { completedToday: true },
        word_search: { completedToday: true },
        jigsaw: { completedToday: true },
      })
    );
    await renderCard();
    expect(screen.getByRole("heading", { name: "Daily set complete." })).toBeTruthy();
    const link = document.querySelector('a[href="/daily"]')!;
    expect(link.textContent).toContain("View Results");
  });

  it("streak: visible text communicates the highest streak", async () => {
    mockFetchOnce(summaryFixture({ word: { streak: 7 } }));
    await renderCard();
    expect(screen.getByText(/7 day streak/)).toBeTruthy();
  });

  it("unavailable puzzle: excluded from the max, never shown as completed, no 0-of-0 status", async () => {
    mockFetchOnce(summaryFixture({ jigsaw: { available: false }, word: { completedToday: true } }));
    const { container } = await renderCard();

    const bar = screen.getByRole("progressbar", { name: "Daily puzzle completion" });
    expect(bar.getAttribute("aria-valuemax")).toBe("4");
    expect(bar.getAttribute("aria-valuenow")).toBe("1");
    expect(screen.queryByText(/0 of 0/)).toBeNull();

    const unavailableSegment = container.querySelector('[title="Jigsaw"]') as HTMLElement;
    expect(unavailableSegment).not.toBeNull();
    expect(unavailableSegment.style.background).not.toContain("--pw-success");
  });

  it("loading: shows the checking message, stays linked, and shows no false completion count", async () => {
    let resolveFetch!: (value: { ok: boolean; json: () => Promise<unknown> }) => void;
    global.fetch = jest.fn(() => new Promise((resolve) => { resolveFetch = resolve; })) as jest.Mock;

    render(<DailyPuzzleHeroCard />);

    expect(screen.getByText("Checking today’s progress…")).toBeTruthy();
    const link = document.querySelector('a[href="/daily"]');
    expect(link).not.toBeNull();
    expect(screen.queryByText(/complete today/)).toBeNull();

    await act(async () => {
      resolveFetch({ ok: true, json: () => Promise.resolve(summaryFixture()) });
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it("failed request: card still renders, links to /daily, shows fallback text, no unhandled error", async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error("network down"))) as jest.Mock;
    await renderCard();

    const link = document.querySelector('a[href="/daily"]');
    expect(link).not.toBeNull();
    expect(screen.getByText("Five daily puzzles are ready to play")).toBeTruthy();
  });

  it("reduced motion: no looping breathing class, no sparkle loop, content stays available", async () => {
    document.documentElement.setAttribute("data-reduce-animations", "true");
    mockFetchOnce(summaryFixture());
    await renderCard();

    const link = document.querySelector('a[href="/daily"]')!;
    const cta = link.querySelector(".game-btn--primary");
    expect(cta).not.toBeNull();
    expect(cta!.className).not.toContain("animate-candy-breathe");
    expect(link.querySelector(".animate-candy-spark")).toBeNull();
    expect(link.textContent).toContain("Start Daily Run");
  });
});
