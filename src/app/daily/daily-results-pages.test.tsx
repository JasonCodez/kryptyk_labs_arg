/** @jest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import DailySudokuPage from "./sudoku/page";
import DailyCrosswordPage from "./crossword/page";
import DailyWordSearchPage from "./word-search/page";
import DailyJigsawPage from "./jigsaw/page";

const mockUseSession = jest.fn();
jest.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

const mockUseDailyPuzzle = jest.fn();
jest.mock("@/hooks/useDailyPuzzle", () => ({
  useDailyPuzzle: (...args: unknown[]) => mockUseDailyPuzzle(...args),
}));

const mockUseJigsawImageInfo = jest.fn();
jest.mock("@/hooks/useJigsawImageInfo", () => ({
  useJigsawImageInfo: (...args: unknown[]) => mockUseJigsawImageInfo(...args),
}));

jest.mock("@/components/daily/DailyPuzzleResult", () => ({
  __esModule: true,
  default: (props: {
    puzzleName: string;
    dayNumber: number;
    streak: number;
    streakDay: number;
    reward?: { points: number; xp: number } | null;
    nextReward?: { points: number; xp: number; streakDay: number } | null;
    children?: React.ReactNode;
  }) => (
    <div data-testid="daily-puzzle-result">
      <div data-testid="result-puzzleName">{props.puzzleName}</div>
      <div data-testid="result-dayNumber">{props.dayNumber}</div>
      <div data-testid="result-streak">{props.streak}</div>
      <div data-testid="result-streakDay">{props.streakDay}</div>
      <div data-testid="result-reward">{props.reward ? JSON.stringify(props.reward) : "null"}</div>
      <div data-testid="result-nextReward">{props.nextReward ? JSON.stringify(props.nextReward) : "null"}</div>
      {props.children}
    </div>
  ),
}));

jest.mock("@/components/onboarding/DailyCompletionHandoff", () => ({
  __esModule: true,
  default: () => <div data-testid="daily-completion-handoff" />,
}));

type SudokuMockProps = {
  onComplete?: () => Promise<{ success: boolean; error?: string }>;
  onCelebrationComplete?: () => void;
};
const sudokuOnComplete = jest.fn();
jest.mock("@/components/puzzle/SudokuPuzzle", () => ({
  __esModule: true,
  default: (props: SudokuMockProps) => {
    sudokuOnComplete.mockImplementation(() => props.onComplete?.());
    return (
      <div data-testid="sudoku-puzzle">
        <button type="button" data-testid="sudoku-complete" onClick={() => props.onComplete?.()}>
          complete
        </button>
        <button type="button" data-testid="sudoku-celebrate" onClick={() => props.onCelebrationComplete?.()}>
          celebrate
        </button>
      </div>
    );
  },
}));

type CrosswordMockProps = { onSolved?: () => Promise<void> };
jest.mock("@/components/puzzle/CrosswordPuzzle", () => ({
  __esModule: true,
  default: (props: CrosswordMockProps) => (
    <div data-testid="crossword-puzzle">
      <button type="button" data-testid="crossword-solve" onClick={() => props.onSolved?.()}>
        solve
      </button>
    </div>
  ),
}));

type WordSearchMockProps = {
  onComplete?: () => Promise<{ success: boolean; error?: string }>;
  onSolved?: () => void;
};
jest.mock("@/components/puzzle/WordSearchPuzzle", () => {
  const React = jest.requireActual("react");
  function WordSearchPuzzleMock(props: WordSearchMockProps) {
    const [outcome, setOutcome] = React.useState<{ success: boolean; error?: string } | null>(null);
    return (
      <div data-testid="word-search-puzzle">
        <button
          type="button"
          data-testid="word-search-complete"
          onClick={async () => setOutcome((await props.onComplete?.()) ?? null)}
        >
          complete
        </button>
        <button type="button" data-testid="word-search-solve" onClick={() => props.onSolved?.()}>
          solve
        </button>
        <div data-testid="word-search-outcome">{outcome ? JSON.stringify(outcome) : "null"}</div>
      </div>
    );
  }
  return { __esModule: true, default: WordSearchPuzzleMock };
});

type JigsawMockProps = {
  onComplete?: (elapsed: number) => Promise<{ success: boolean; pointsAwarded?: number; error?: string }>;
  onCelebrationComplete?: () => void;
  rotationEnabled?: boolean;
};
const jigsawRotationEnabled: boolean[] = [];
jest.mock("@/components/puzzle/JigsawPuzzle", () => ({
  __esModule: true,
  default: (props: JigsawMockProps) => {
    jigsawRotationEnabled.push(!!props.rotationEnabled);
    return (
      <div data-testid="jigsaw-puzzle">
        <button type="button" data-testid="jigsaw-complete" onClick={() => props.onComplete?.(87)}>
          complete
        </button>
        <button type="button" data-testid="jigsaw-celebrate" onClick={() => props.onCelebrationComplete?.()}>
          celebrate
        </button>
      </div>
    );
  },
}));

const NEXT_REWARD = { points: 125, xp: 60, streakDay: 5 };

function dailyPuzzleFixture(overrides: Record<string, unknown> = {}) {
  return {
    loading: false,
    available: true,
    dayNumber: 42,
    streak: 4,
    streakDay: 5,
    nextReward: NEXT_REWARD,
    completedToday: false,
    streakShields: 0,
    skipTokens: 0,
    content: {},
    error: null,
    submitCompletion: jest.fn().mockResolvedValue({ success: true, reward: { points: 10, xp: 5 } }),
    ...overrides,
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function mockPuzzlesFetch(data: Record<string, unknown> = {}) {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/hints")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ hintTokens: 0 }) } as Response);
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ data }) } as Response);
  }) as jest.Mock;
}

beforeEach(() => {
  mockUseSession.mockReturnValue({ status: "authenticated", data: { user: { id: "u1" } } });
  mockUseJigsawImageInfo.mockReturnValue({ ready: true });
  sudokuOnComplete.mockClear();
  jigsawRotationEnabled.length = 0;
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe("Daily results pages — already completed state", () => {
  it("Sudoku: revisit renders DailyPuzzleResult with correct props, no puzzle, no legacy markup", async () => {
    mockUseDailyPuzzle.mockReturnValue(
      dailyPuzzleFixture({
        completedToday: true,
        content: { available: true, dayNumber: 42, puzzleGrid: JSON.stringify([[1]]), solutionGrid: JSON.stringify([[1]]) },
      })
    );
    render(<DailySudokuPage />);
    await flush();

    expect(screen.getByTestId("daily-puzzle-result")).toBeTruthy();
    expect(screen.getByTestId("result-puzzleName").textContent).toBe("Sudoku");
    expect(screen.getByTestId("result-dayNumber").textContent).toBe("42");
    expect(screen.getByTestId("result-streak").textContent).toBe("4");
    expect(screen.getByTestId("result-streakDay").textContent).toBe("5");
    expect(screen.getByTestId("result-nextReward").textContent).toBe(JSON.stringify(NEXT_REWARD));
    expect(screen.getByTestId("result-reward").textContent).toBe("null");
    expect(screen.queryByTestId("sudoku-puzzle")).toBeNull();
    expect(screen.getByTestId("daily-completion-handoff")).toBeTruthy();
    expect(screen.queryByText("Solved for today!")).toBeNull();
    expect(screen.queryByText("✓")).toBeNull();
  });

  it("Crossword: revisit renders DailyPuzzleResult with correct props", async () => {
    mockUseDailyPuzzle.mockReturnValue(
      dailyPuzzleFixture({ completedToday: true, content: { available: true, dayNumber: 42, puzzleId: "cw-1" } })
    );
    mockPuzzlesFetch();
    render(<DailyCrosswordPage />);
    await flush();

    expect(screen.getByTestId("result-puzzleName").textContent).toBe("Crossword");
    expect(screen.getByTestId("result-dayNumber").textContent).toBe("42");
    expect(screen.getByTestId("result-streak").textContent).toBe("4");
    expect(screen.getByTestId("result-streakDay").textContent).toBe("5");
    expect(screen.getByTestId("result-nextReward").textContent).toBe(JSON.stringify(NEXT_REWARD));
    expect(screen.getByTestId("result-reward").textContent).toBe("null");
    expect(screen.queryByTestId("crossword-puzzle")).toBeNull();
    expect(screen.getByTestId("daily-completion-handoff")).toBeTruthy();
    expect(screen.queryByText("Solved for today!")).toBeNull();
    expect(screen.queryByText("✓")).toBeNull();
  });

  it("Word Trove: revisit renders DailyPuzzleResult with correct props", async () => {
    mockUseDailyPuzzle.mockReturnValue(
      dailyPuzzleFixture({
        completedToday: true,
        nextReward: null,
        content: { available: true, dayNumber: 42, puzzleId: "ws-1" },
      })
    );
    mockPuzzlesFetch();
    render(<DailyWordSearchPage />);
    await flush();

    expect(screen.getByTestId("result-puzzleName").textContent).toBe("Word Trove");
    expect(screen.getByTestId("result-dayNumber").textContent).toBe("42");
    expect(screen.getByTestId("result-streak").textContent).toBe("4");
    expect(screen.getByTestId("result-streakDay").textContent).toBe("5");
    expect(screen.getByTestId("result-nextReward").textContent).toBe("null");
    expect(screen.getByTestId("result-reward").textContent).toBe("null");
    expect(screen.queryByTestId("word-search-puzzle")).toBeNull();
    expect(screen.getByTestId("daily-completion-handoff")).toBeTruthy();
    expect(screen.queryByText("Solved for today!")).toBeNull();
    expect(screen.queryByText("✓")).toBeNull();
  });

  it("Jigsaw: revisit renders DailyPuzzleResult with correct props", async () => {
    mockUseDailyPuzzle.mockReturnValue(
      dailyPuzzleFixture({
        completedToday: true,
        content: { available: true, dayNumber: 42, puzzleId: "jg-1", imageUrl: "https://example.com/img.png", gridRows: 4, gridCols: 4 },
      })
    );
    render(<DailyJigsawPage />);
    await flush();

    expect(screen.getByTestId("result-puzzleName").textContent).toBe("Jigsaw");
    expect(screen.getByTestId("result-dayNumber").textContent).toBe("42");
    expect(screen.getByTestId("result-streak").textContent).toBe("4");
    expect(screen.getByTestId("result-streakDay").textContent).toBe("5");
    expect(screen.getByTestId("result-nextReward").textContent).toBe(JSON.stringify(NEXT_REWARD));
    expect(screen.getByTestId("result-reward").textContent).toBe("null");
    expect(screen.queryByTestId("jigsaw-puzzle")).toBeNull();
    expect(screen.getByTestId("daily-completion-handoff")).toBeTruthy();
    expect(screen.queryByText("Solved for today!")).toBeNull();
    expect(screen.queryByText("✓")).toBeNull();
  });
});

describe("Daily results pages — newly completed state", () => {
  it("Sudoku: onComplete calls submitCompletion once, onCelebrationComplete reveals the result with the returned reward", async () => {
    const submitCompletion = jest.fn().mockResolvedValue({ success: true, reward: { points: 20, xp: 8 } });
    mockUseDailyPuzzle.mockReturnValue(
      dailyPuzzleFixture({
        completedToday: false,
        submitCompletion,
        content: { available: true, dayNumber: 42, puzzleGrid: JSON.stringify([[1]]), solutionGrid: JSON.stringify([[1]]) },
      })
    );
    render(<DailySudokuPage />);
    await flush();

    expect(screen.getByTestId("sudoku-puzzle")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByTestId("sudoku-complete"));
      await Promise.resolve();
    });
    expect(submitCompletion).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("daily-puzzle-result")).toBeNull();

    fireEvent.click(screen.getByTestId("sudoku-celebrate"));
    expect(screen.getByTestId("daily-puzzle-result")).toBeTruthy();
    expect(screen.getByTestId("result-reward").textContent).toBe(JSON.stringify({ points: 20, xp: 8 }));
  });

  it("Word Trove: onComplete failure preserves the error contract and does not reveal the result", async () => {
    const submitCompletion = jest.fn().mockResolvedValue({ success: false, error: "boom" });
    mockUseDailyPuzzle.mockReturnValue(
      dailyPuzzleFixture({
        completedToday: false,
        submitCompletion,
        content: { available: true, dayNumber: 42, puzzleId: "ws-1" },
      })
    );
    mockPuzzlesFetch();
    render(<DailyWordSearchPage />);
    await flush();

    await act(async () => {
      fireEvent.click(screen.getByTestId("word-search-complete"));
      await Promise.resolve();
    });
    expect(submitCompletion).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("daily-puzzle-result")).toBeNull();
    expect(screen.getByTestId("word-search-puzzle")).toBeTruthy();
    expect(screen.getByTestId("word-search-outcome").textContent).toBe(
      JSON.stringify({ success: false, error: "boom" })
    );
  });

  it("Word Trove: keeps the 700ms solved-delay before the result appears", async () => {
    jest.useFakeTimers();
    mockUseDailyPuzzle.mockReturnValue(
      dailyPuzzleFixture({
        completedToday: false,
        content: { available: true, dayNumber: 42, puzzleId: "ws-1" },
      })
    );
    mockPuzzlesFetch();
    render(<DailyWordSearchPage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByTestId("word-search-solve"));
    expect(screen.queryByTestId("daily-puzzle-result")).toBeNull();

    act(() => {
      jest.advanceTimersByTime(699);
    });
    expect(screen.queryByTestId("daily-puzzle-result")).toBeNull();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("daily-puzzle-result")).toBeTruthy();
    jest.useRealTimers();
  });

  it("Jigsaw: onComplete forwards elapsedSeconds metadata and keeps rotationEnabled false", async () => {
    const submitCompletion = jest.fn().mockResolvedValue({ success: true, reward: { points: 15, xp: 9 } });
    mockUseDailyPuzzle.mockReturnValue(
      dailyPuzzleFixture({
        completedToday: false,
        submitCompletion,
        content: { available: true, dayNumber: 42, puzzleId: "jg-1", imageUrl: "https://example.com/img.png", gridRows: 4, gridCols: 4 },
      })
    );
    render(<DailyJigsawPage />);
    await flush();

    expect(jigsawRotationEnabled).toContain(false);

    await act(async () => {
      fireEvent.click(screen.getByTestId("jigsaw-complete"));
      await Promise.resolve();
    });
    expect(submitCompletion).toHaveBeenCalledWith({ elapsedSeconds: 87 });

    fireEvent.click(screen.getByTestId("jigsaw-celebrate"));
    expect(screen.getByTestId("daily-puzzle-result")).toBeTruthy();
    expect(screen.getByTestId("result-reward").textContent).toBe(JSON.stringify({ points: 15, xp: 9 }));
  });
});

describe("Crossword-specific completion ordering", () => {
  it("holds the result until submitCompletion resolves, then shows the returned reward", async () => {
    let resolveCompletion!: (value: { success: boolean; reward: { points: number; xp: number } }) => void;
    const submitCompletion = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveCompletion = resolve;
        })
    );
    mockUseDailyPuzzle.mockReturnValue(
      dailyPuzzleFixture({
        completedToday: false,
        submitCompletion,
        content: { available: true, dayNumber: 42, puzzleId: "cw-1" },
      })
    );
    mockPuzzlesFetch();
    render(<DailyCrosswordPage />);
    await flush();

    fireEvent.click(screen.getByTestId("crossword-solve"));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId("daily-puzzle-result")).toBeNull();

    await act(async () => {
      resolveCompletion({ success: true, reward: { points: 30, xp: 12 } });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("daily-puzzle-result")).toBeTruthy();
    expect(screen.getByTestId("result-reward").textContent).toBe(JSON.stringify({ points: 30, xp: 12 }));
    expect(submitCompletion).toHaveBeenCalledTimes(1);
  });
});

describe("Frozen behavior", () => {
  it("Hidden Word is not imported into the integration", () => {
    const source = [DailySudokuPage, DailyCrosswordPage, DailyWordSearchPage, DailyJigsawPage]
      .map((fn) => fn.toString())
      .join("\n");
    expect(source).not.toMatch(/HiddenWord/i);
  });

  it("no page performs a new result API request beyond existing daily/puzzle endpoints", async () => {
    mockUseDailyPuzzle.mockReturnValue(
      dailyPuzzleFixture({ completedToday: true, content: { available: true, dayNumber: 42, puzzleId: "cw-1" } })
    );
    const calls: string[] = [];
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      calls.push(String(input));
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: {} }) } as Response);
    }) as jest.Mock;
    render(<DailyCrosswordPage />);
    await flush();
    for (const call of calls) {
      expect(call).toMatch(/\/api\/puzzles\//);
    }
  });
});
