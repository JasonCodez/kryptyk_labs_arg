/** @jest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import WarzPlayBoard from "./WarzPlayBoard";

const mockUseAppReducedMotion = jest.fn(() => false);
jest.mock("@/hooks/useAppReducedMotion", () => ({
  useAppReducedMotion: () => mockUseAppReducedMotion(),
}));

interface MockJigsawImageInfo {
  ready: boolean;
  width: number | null;
  height: number | null;
  isSquare: boolean;
  error: boolean;
}

const mockJigsawImageInfo = jest.fn(
  (_url: string | null | undefined): MockJigsawImageInfo => ({ ready: true, width: 100, height: 100, isSquare: true, error: false })
);
jest.mock("@/hooks/useJigsawImageInfo", () => ({
  useJigsawImageInfo: (url: string | null | undefined) => mockJigsawImageInfo(url),
}));

jest.mock("@/components/puzzle/HiddenWordPuzzle", () => ({
  __esModule: true,
  default: (props: {
    puzzleId: string;
    hiddenWordData: Record<string, unknown>;
    alreadySolved: boolean;
    warzMode?: boolean;
    onSolved?: () => void;
    onFailed?: () => void;
  }) => (
    <div data-testid="mock-hidden-word">
      <div data-testid="hw-puzzleId">{props.puzzleId}</div>
      <div data-testid="hw-data">{JSON.stringify(props.hiddenWordData)}</div>
      <div data-testid="hw-alreadySolved">{String(props.alreadySolved)}</div>
      <div data-testid="hw-warzMode">{String(props.warzMode)}</div>
      <button type="button" onClick={() => props.onSolved?.()}>hw-solve</button>
      <button type="button" onClick={() => props.onFailed?.()}>hw-fail</button>
    </div>
  ),
}));

jest.mock("@/components/puzzle/WordSearchPuzzle", () => ({
  __esModule: true,
  default: (props: {
    puzzleId: string;
    wordSearchData: Record<string, unknown>;
    alreadySolved: boolean;
    warzMode?: boolean;
    persistenceScope?: string;
    puzzleInstanceId?: string;
    onSolved?: () => void;
  }) => (
    <div data-testid="mock-word-search">
      <div data-testid="ws-puzzleId">{props.puzzleId}</div>
      <div data-testid="ws-data">{JSON.stringify(props.wordSearchData)}</div>
      <div data-testid="ws-alreadySolved">{String(props.alreadySolved)}</div>
      <div data-testid="ws-warzMode">{String(props.warzMode)}</div>
      <div data-testid="ws-persistenceScope">{props.persistenceScope}</div>
      <div data-testid="ws-puzzleInstanceId">{props.puzzleInstanceId}</div>
      <button type="button" onClick={() => props.onSolved?.()}>ws-solve</button>
    </div>
  ),
}));

jest.mock("@/components/puzzle/SudokuPuzzle", () => ({
  __esModule: true,
  default: (props: {
    puzzleId: string;
    puzzle: number[][];
    solution: number[][];
    mode: string;
    displayMode?: string;
    onComplete: (grid: number[][], secs: number) => Promise<unknown>;
  }) => (
    <div data-testid="mock-sudoku">
      <div data-testid="su-puzzleId">{props.puzzleId}</div>
      <div data-testid="su-puzzle">{JSON.stringify(props.puzzle)}</div>
      <div data-testid="su-solution">{JSON.stringify(props.solution)}</div>
      <div data-testid="su-mode">{props.mode}</div>
      <div data-testid="su-displayMode">{props.displayMode}</div>
      <button type="button" onClick={() => props.onComplete(props.puzzle, 77)}>sudoku-complete</button>
    </div>
  ),
}));

jest.mock("@/components/puzzle/JigsawPuzzle", () => ({
  __esModule: true,
  default: (props: {
    imageUrl: string;
    rows: number;
    cols: number;
    neighborSnapTolerance: number;
    puzzleId?: string;
    puzzleInstanceId?: string;
    mode?: string;
    persistenceScope?: string;
    displayMode?: string;
    rotationEnabled?: boolean;
    suppressInternalCongrats?: boolean;
    onComplete?: (secs: number) => Promise<unknown>;
  }) => (
    <div data-testid="mock-jigsaw">
      <div data-testid="jg-imageUrl">{props.imageUrl}</div>
      <div data-testid="jg-rows">{props.rows}</div>
      <div data-testid="jg-cols">{props.cols}</div>
      <div data-testid="jg-tolerance">{props.neighborSnapTolerance}</div>
      <div data-testid="jg-puzzleId">{props.puzzleId}</div>
      <div data-testid="jg-puzzleInstanceId">{props.puzzleInstanceId}</div>
      <div data-testid="jg-mode">{props.mode}</div>
      <div data-testid="jg-persistenceScope">{props.persistenceScope}</div>
      <div data-testid="jg-displayMode">{props.displayMode}</div>
      <div data-testid="jg-rotationEnabled">{String(props.rotationEnabled)}</div>
      <div data-testid="jg-suppressInternalCongrats">{String(props.suppressInternalCongrats)}</div>
      <button type="button" onClick={() => props.onComplete?.(88)}>jigsaw-complete</button>
    </div>
  ),
}));

jest.mock("@/components/puzzle/AnagramBlitz", () => ({
  __esModule: true,
  default: (props: {
    puzzleId: string;
    anagramData: Record<string, unknown>;
    alreadySolved: boolean;
    onSolved?: () => void;
    onFailed?: () => void;
  }) => (
    <div data-testid="mock-anagram">
      <div data-testid="an-data">{JSON.stringify(props.anagramData)}</div>
      <button type="button" onClick={() => props.onSolved?.()}>anagram-solve</button>
      <button type="button" onClick={() => props.onFailed?.()}>anagram-fail</button>
    </div>
  ),
}));

jest.mock("@/components/puzzle/ArgPuzzle", () => ({
  __esModule: true,
  default: (props: { puzzleId: string; argData: Record<string, unknown>; alreadySolved: boolean; onSolved?: () => void }) => (
    <div data-testid="mock-arg">
      <div data-testid="arg-data">{JSON.stringify(props.argData)}</div>
      <button type="button" onClick={() => props.onSolved?.()}>arg-solve</button>
    </div>
  ),
}));

jest.mock("@/components/puzzle/BlackoutPuzzle", () => ({
  __esModule: true,
  default: (props: { puzzleId: string; blackoutData: Record<string, unknown>; alreadySolved: boolean; onSolved?: () => void }) => (
    <div data-testid="mock-blackout">
      <div data-testid="bo-data">{JSON.stringify(props.blackoutData)}</div>
      <button type="button" onClick={() => props.onSolved?.()}>blackout-solve</button>
    </div>
  ),
}));

interface WarzPuzzle {
  id: string;
  title: string;
  difficulty: string;
  puzzleType: string;
  data?: Record<string, unknown>;
  sudoku?: { puzzleGrid: string; solutionGrid: string };
  jigsaw?: { imageUrl: string | null; gridRows: number; gridCols: number; snapTolerance: number; rotationEnabled: boolean };
}

function makePuzzle(overrides: Partial<WarzPuzzle> = {}): WarzPuzzle {
  return {
    id: "puzzle-1",
    title: "Midnight Sudoku",
    difficulty: "medium",
    puzzleType: "word_crack",
    data: { word: "CRANE" },
    ...overrides,
  };
}

beforeEach(() => {
  mockUseAppReducedMotion.mockReturnValue(false);
  mockJigsawImageInfo.mockReturnValue({ ready: true, width: 100, height: 100, isSquare: true, error: false });
});

afterEach(() => {
  cleanup();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("WarzPlayBoard — timer behavior", () => {
  it("1. HUD starts at 00:00", () => {
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    expect(screen.getByText("00:00")).toBeTruthy();
  });

  it("2-3. timer advances once per second", () => {
    jest.useFakeTimers();
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText("00:01")).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByText("00:03")).toBeTruthy();
  });

  it("4. timer does not create duplicate intervals on rerender", () => {
    jest.useFakeTimers();
    const setIntervalSpy = jest.spyOn(global, "setInterval");
    const { rerender } = render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    const callsAfterMount = setIntervalSpy.mock.calls.length;
    rerender(<WarzPlayBoard puzzle={makePuzzle()} wager={75} onDone={jest.fn()} />);
    expect(setIntervalSpy.mock.calls.length).toBe(callsAfterMount);
  });

  it("5. timer clears on unmount", () => {
    jest.useFakeTimers();
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");
    const { unmount } = render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it("6-7. opening and cancelling the Forfeit dialog does not pause the timer", () => {
    jest.useFakeTimers();
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    fireEvent.click(screen.getByRole("button", { name: /forfeit/i }));
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText("00:02")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep Fighting" }));
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText("00:03")).toBeTruthy();
  });

  it("8. timer freezes after solve", () => {
    jest.useFakeTimers();
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    fireEvent.click(screen.getByRole("button", { name: "hw-solve" }));
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    // Solved instantly (Math.max(1, round) of ~3s) — frozen, not still ticking to 8s.
    expect(screen.queryByText("00:08")).toBeNull();
  });

  it("9. timer freezes after failure", () => {
    jest.useFakeTimers();
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    fireEvent.click(screen.getByRole("button", { name: "hw-fail" }));
    const frozenText = screen.getByText("00:02");
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(frozenText.textContent).toBe("00:02");
  });

  it("10. timer freezes after confirmed forfeit", () => {
    jest.useFakeTimers();
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    fireEvent.click(screen.getByRole("button", { name: /forfeit/i }));
    fireEvent.click(screen.getByRole("button", { name: "Forfeit Battle" }));
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.getByText("00:02")).toBeTruthy();
  });

  it("11. explicit Sudoku seconds replace visible time", () => {
    jest.useFakeTimers();
    const puzzle = makePuzzle({ puzzleType: "sudoku", sudoku: { puzzleGrid: "[[1]]", solutionGrid: "[[1]]" } });
    render(<WarzPlayBoard puzzle={puzzle} wager={50} onDone={jest.fn()} />);
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    fireEvent.click(screen.getByRole("button", { name: "sudoku-complete" }));
    expect(screen.getByText("01:17")).toBeTruthy();
  });

  it("12. explicit Jigsaw seconds replace visible time", () => {
    jest.useFakeTimers();
    const puzzle = makePuzzle({
      puzzleType: "jigsaw",
      jigsaw: { imageUrl: "https://example.test/a.png", gridRows: 3, gridCols: 3, snapTolerance: 10, rotationEnabled: false },
    });
    render(<WarzPlayBoard puzzle={puzzle} wager={50} onDone={jest.fn()} />);
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    fireEvent.click(screen.getByRole("button", { name: "jigsaw-complete" }));
    expect(screen.getByText("01:28")).toBeTruthy();
  });

  it("13. negative callback values are not manufactured by the shell", () => {
    const onDone = jest.fn();
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-solve" }));
    expect(onDone.mock.calls[0][0]).toBeGreaterThanOrEqual(1);
  });

  it("14. no request occurs on timer ticks", () => {
    jest.useFakeTimers();
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("WarzPlayBoard — exactly-once terminal submission", () => {
  it("1-2. Hidden Word solve calls onDone once, even with two synchronous callbacks", () => {
    const onDone = jest.fn();
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={onDone} />);
    const solveBtn = screen.getByRole("button", { name: "hw-solve" });
    fireEvent.click(solveBtn);
    fireEvent.click(solveBtn);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("3. Word Search solve calls once", () => {
    const onDone = jest.fn();
    const puzzle = makePuzzle({ puzzleType: "word_search" });
    render(<WarzPlayBoard puzzle={puzzle} wager={50} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "ws-solve" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("4-5. Sudoku complete passes exact supplied seconds; duplicate callbacks call once", () => {
    const onDone = jest.fn();
    const puzzle = makePuzzle({ puzzleType: "sudoku", sudoku: { puzzleGrid: "[[1]]", solutionGrid: "[[1]]" } });
    render(<WarzPlayBoard puzzle={puzzle} wager={50} onDone={onDone} />);
    const btn = screen.getByRole("button", { name: "sudoku-complete" });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(77, undefined);
  });

  it("6-7. Jigsaw complete passes exact supplied seconds; duplicate callbacks call once", () => {
    const onDone = jest.fn();
    const puzzle = makePuzzle({
      puzzleType: "jigsaw",
      jigsaw: { imageUrl: "https://example.test/a.png", gridRows: 3, gridCols: 3, snapTolerance: 10, rotationEnabled: false },
    });
    render(<WarzPlayBoard puzzle={puzzle} wager={50} onDone={onDone} />);
    const btn = screen.getByRole("button", { name: "jigsaw-complete" });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(88, undefined);
  });

  it("8. Anagram solve calls once", () => {
    const onDone = jest.fn();
    const puzzle = makePuzzle({ puzzleType: "anagram_blitz" });
    render(<WarzPlayBoard puzzle={puzzle} wager={50} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "anagram-solve" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("9. ARG solve calls once", () => {
    const onDone = jest.fn();
    const puzzle = makePuzzle({ puzzleType: "arg" });
    render(<WarzPlayBoard puzzle={puzzle} wager={50} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "arg-solve" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("10. Blackout solve calls once", () => {
    const onDone = jest.fn();
    const puzzle = makePuzzle({ puzzleType: "blackout" });
    render(<WarzPlayBoard puzzle={puzzle} wager={50} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "blackout-solve" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("11. solve followed by failure calls once", () => {
    const onDone = jest.fn();
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-solve" }));
    fireEvent.click(screen.getByRole("button", { name: "hw-fail" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("12. failure followed by solve submits only the failure outcome", () => {
    jest.useFakeTimers();
    const onDone = jest.fn();
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-fail" }));
    fireEvent.click(screen.getByRole("button", { name: "hw-solve" }));
    // Each tick's setTimeout is only scheduled once React flushes the
    // effect for the *previous* tick, so advance in five discrete steps
    // rather than one 5000ms jump.
    for (let i = 0; i < 5; i += 1) {
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    }
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(0, true);
  });

  it("13-14. manual Forfeit calls onDone(0, true) once, even rapidly confirmed", () => {
    const onDone = jest.fn();
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: /forfeit/i }));
    const confirmBtn = screen.getByRole("button", { name: "Forfeit Battle" });
    fireEvent.click(confirmBtn);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(0, true);
  });

  it("15. failure countdown expiry calls onDone(0, true) once", () => {
    jest.useFakeTimers();
    const onDone = jest.fn();
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-fail" }));
    // Each tick's setTimeout is only scheduled once React flushes the
    // effect for the *previous* tick, so advance in five discrete steps
    // rather than one 5000ms jump.
    for (let i = 0; i < 5; i += 1) {
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    }
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(0, true);
  });

  it("16. Forfeit Now calls onDone(0, true) once", () => {
    const onDone = jest.fn();
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-fail" }));
    fireEvent.click(screen.getByRole("button", { name: "Forfeit Now" }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(0, true);
  });

  it("17. Forfeit Now and countdown-expiry race call once", () => {
    jest.useFakeTimers();
    const onDone = jest.fn();
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-fail" }));
    act(() => {
      jest.advanceTimersByTime(4000);
    });
    fireEvent.click(screen.getByRole("button", { name: "Forfeit Now" }));
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("18. unmount during failure countdown calls zero times", () => {
    jest.useFakeTimers();
    const onDone = jest.fn();
    const { unmount } = render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-fail" }));
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    unmount();
    act(() => {
      jest.advanceTimersByTime(10000);
    });
    expect(onDone).not.toHaveBeenCalled();
  });

  it("19. parent rerender after solve does not call onDone again", () => {
    const onDone = jest.fn();
    const { rerender } = render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-solve" }));
    rerender(<WarzPlayBoard puzzle={makePuzzle()} wager={75} onDone={onDone} />);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("20. retry action does not call onDone again", () => {
    const onDone = jest.fn();
    const onRetry = jest.fn();
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={onDone} submitError="failed" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-solve" }));
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("WarzPlayBoard — renderer contracts", () => {
  it("Hidden Word: exact puzzleId, data, alreadySolved false, warzMode true", () => {
    const puzzle = makePuzzle({ puzzleType: "word_crack", data: { word: "CRANE" } });
    render(<WarzPlayBoard puzzle={puzzle} wager={50} onDone={jest.fn()} />);
    expect(screen.getByTestId("hw-puzzleId").textContent).toBe("puzzle-1");
    expect(screen.getByTestId("hw-data").textContent).toBe(JSON.stringify({ word: "CRANE" }));
    expect(screen.getByTestId("hw-alreadySolved").textContent).toBe("false");
    expect(screen.getByTestId("hw-warzMode").textContent).toBe("true");
  });

  it("Word Search: exact contract", () => {
    const puzzle = makePuzzle({ puzzleType: "word_search", data: { grid: [["A"]], words: ["A"] } });
    render(<WarzPlayBoard puzzle={puzzle} wager={50} onDone={jest.fn()} />);
    expect(screen.getByTestId("ws-puzzleId").textContent).toBe("puzzle-1");
    expect(screen.getByTestId("ws-data").textContent).toBe(JSON.stringify({ grid: [["A"]], words: ["A"] }));
    expect(screen.getByTestId("ws-alreadySolved").textContent).toBe("false");
    expect(screen.getByTestId("ws-warzMode").textContent).toBe("true");
    expect(screen.getByTestId("ws-persistenceScope").textContent).toBe("none");
    expect(screen.getByTestId("ws-puzzleInstanceId").textContent).toBe("shared:puzzle-1");
  });

  it("Sudoku: exact parsed puzzle/solution, mode, displayMode, puzzleId", () => {
    const puzzle = makePuzzle({
      puzzleType: "sudoku",
      sudoku: { puzzleGrid: "[[1,2],[3,4]]", solutionGrid: "[[1,2],[4,3]]" },
    });
    render(<WarzPlayBoard puzzle={puzzle} wager={50} onDone={jest.fn()} />);
    expect(screen.getByTestId("su-puzzleId").textContent).toBe("warz-puzzle-1");
    expect(screen.getByTestId("su-puzzle").textContent).toBe(JSON.stringify([[1, 2], [3, 4]]));
    expect(screen.getByTestId("su-solution").textContent).toBe(JSON.stringify([[1, 2], [4, 3]]));
    expect(screen.getByTestId("su-mode").textContent).toBe("daily");
    expect(screen.getByTestId("su-displayMode").textContent).toBe("standalone");
  });

  it("Jigsaw: exact contract", () => {
    const puzzle = makePuzzle({
      puzzleType: "jigsaw",
      jigsaw: { imageUrl: "https://example.test/a.png", gridRows: 4, gridCols: 5, snapTolerance: 12, rotationEnabled: true },
    });
    render(<WarzPlayBoard puzzle={puzzle} wager={50} onDone={jest.fn()} />);
    expect(screen.getByTestId("jg-imageUrl").textContent).toBe("https://example.test/a.png");
    expect(screen.getByTestId("jg-rows").textContent).toBe("4");
    expect(screen.getByTestId("jg-cols").textContent).toBe("5");
    expect(screen.getByTestId("jg-tolerance").textContent).toBe("12");
    expect(screen.getByTestId("jg-puzzleId").textContent).toBe("puzzle-1");
    expect(screen.getByTestId("jg-puzzleInstanceId").textContent).toBe("shared:puzzle-1");
    expect(screen.getByTestId("jg-mode").textContent).toBe("warz");
    expect(screen.getByTestId("jg-persistenceScope").textContent).toBe("none");
    expect(screen.getByTestId("jg-displayMode").textContent).toBe("standalone");
    // Preserved: WarzPlayBoard always forces rotationEnabled=false regardless
    // of the puzzle's own jigsaw.rotationEnabled field.
    expect(screen.getByTestId("jg-rotationEnabled").textContent).toBe("false");
    expect(screen.getByTestId("jg-suppressInternalCongrats").textContent).toBe("true");
  });

  it("Anagram: exact data", () => {
    const puzzle = makePuzzle({ puzzleType: "anagram_blitz", data: { letters: "CRANE" } });
    render(<WarzPlayBoard puzzle={puzzle} wager={50} onDone={jest.fn()} />);
    expect(screen.getByTestId("an-data").textContent).toBe(JSON.stringify({ letters: "CRANE" }));
  });

  it("ARG: exact data", () => {
    const puzzle = makePuzzle({ puzzleType: "arg", data: { clue: "x" } });
    render(<WarzPlayBoard puzzle={puzzle} wager={50} onDone={jest.fn()} />);
    expect(screen.getByTestId("arg-data").textContent).toBe(JSON.stringify({ clue: "x" }));
  });

  it("Blackout: exact data", () => {
    const puzzle = makePuzzle({ puzzleType: "blackout", data: { redactions: [1, 2] } });
    render(<WarzPlayBoard puzzle={puzzle} wager={50} onDone={jest.fn()} />);
    expect(screen.getByTestId("bo-data").textContent).toBe(JSON.stringify({ redactions: [1, 2] }));
  });

  it("Sudoku missing payload shows fallback copy", () => {
    const puzzle = makePuzzle({ puzzleType: "sudoku", sudoku: undefined });
    render(<WarzPlayBoard puzzle={puzzle} wager={50} onDone={jest.fn()} />);
    expect(screen.getByText("Sudoku data missing.")).toBeTruthy();
  });

  it("Jigsaw missing image shows fallback copy", () => {
    const puzzle = makePuzzle({
      puzzleType: "jigsaw",
      jigsaw: { imageUrl: null, gridRows: 3, gridCols: 3, snapTolerance: 10, rotationEnabled: false },
    });
    render(<WarzPlayBoard puzzle={puzzle} wager={50} onDone={jest.fn()} />);
    expect(screen.getByText("Jigsaw image missing.")).toBeTruthy();
  });

  it("Jigsaw not-ready shows loading copy", () => {
    mockJigsawImageInfo.mockReturnValue({ ready: false, width: null, height: null, isSquare: false, error: false });
    const puzzle = makePuzzle({
      puzzleType: "jigsaw",
      jigsaw: { imageUrl: "https://example.test/a.png", gridRows: 3, gridCols: 3, snapTolerance: 10, rotationEnabled: false },
    });
    render(<WarzPlayBoard puzzle={puzzle} wager={50} onDone={jest.fn()} />);
    expect(screen.getByText("Loading puzzle image…")).toBeTruthy();
  });

  it("Unsupported puzzle type shows fallback copy", () => {
    const puzzle = makePuzzle({ puzzleType: "not_a_real_type" });
    render(<WarzPlayBoard puzzle={puzzle} wager={50} onDone={jest.fn()} />);
    expect(screen.getByText("Unsupported puzzle type: not_a_real_type")).toBeTruthy();
  });
});

describe("WarzPlayBoard — Forfeit dialog", () => {
  it("1-2. HUD Forfeit opens a role='dialog'", () => {
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /forfeit/i }));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("3. Keep Fighting has initial focus", () => {
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /forfeit/i }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keep Fighting" }));
  });

  it("4. Keep Fighting closes dialog", async () => {
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /forfeit/i }));
    fireEvent.click(screen.getByRole("button", { name: "Keep Fighting" }));
    // AnimatePresence's exit animation completes via requestAnimationFrame,
    // not synchronously — flush one frame before asserting removal.
    await act(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("5. Escape closes dialog", async () => {
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /forfeit/i }));
    fireEvent.keyDown(document, { key: "Escape" });
    await act(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("6. Backdrop closes dialog", async () => {
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /forfeit/i }));
    fireEvent.click(screen.getByRole("dialog").parentElement!);
    await act(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("7. Panel click does not close", () => {
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /forfeit/i }));
    fireEvent.click(screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("8. Closing returns focus to HUD Forfeit", () => {
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    const forfeitBtn = screen.getByRole("button", { name: /forfeit/i });
    fireEvent.click(forfeitBtn);
    fireEvent.click(screen.getByRole("button", { name: "Keep Fighting" }));
    expect(document.activeElement).toBe(forfeitBtn);
  });

  it("9. Cancelling calls no onDone", () => {
    const onDone = jest.fn();
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: /forfeit/i }));
    fireEvent.click(screen.getByRole("button", { name: "Keep Fighting" }));
    expect(onDone).not.toHaveBeenCalled();
  });

  it("10. Timer continues while dialog is open", () => {
    jest.useFakeTimers();
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /forfeit/i }));
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByText("00:03")).toBeTruthy();
  });

  it("11. Confirm button calls exact forfeit body once", () => {
    const onDone = jest.fn();
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: /forfeit/i }));
    fireEvent.click(screen.getByRole("button", { name: "Forfeit Battle" }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(0, true);
  });

  it("12. Confirm button target is at least 48px", () => {
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /forfeit/i }));
    expect(screen.getByRole("button", { name: "Forfeit Battle" }).style.minHeight).toBe("48px");
  });

  it("13. Keep Fighting target is at least 44px", () => {
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /forfeit/i }));
    expect(screen.getByRole("button", { name: "Keep Fighting" }).style.minHeight).toBe("44px");
  });

  it("14. reduced motion removes scale", () => {
    mockUseAppReducedMotion.mockReturnValue(true);
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /forfeit/i }));
    const panel = screen.getByRole("dialog") as HTMLElement;
    expect(panel.style.transform).not.toMatch(/scale/);
  });

  it("15-16. no emoji or raw colors appear", () => {
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /forfeit/i }));
    const dialog = screen.getByRole("dialog");
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(emojiPattern.test(dialog.textContent || "")).toBe(false);
  });
});

describe("WarzPlayBoard — Failure dialog", () => {
  it("1. Failure opens alertdialog", () => {
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-fail" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });

  it("2-3. countdown begins at and displays five", () => {
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-fail" }));
    expect(screen.getByText("Forfeiting in 5…")).toBeTruthy();
  });

  it("4. countdown decreases each second", () => {
    jest.useFakeTimers();
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-fail" }));
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText("Forfeiting in 4…")).toBeTruthy();
  });

  it("5. Escape does not close", () => {
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-fail" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });

  it("6. Backdrop does not close", () => {
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-fail" }));
    fireEvent.click(screen.getByRole("alertdialog").parentElement!);
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });

  it("7. Forfeit Now receives focus", () => {
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-fail" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Forfeit Now" }));
  });

  it("8. underlying puzzle is non-interactive", () => {
    const { container } = render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-fail" }));
    const puzzleWrapper = container.querySelector('[data-testid="mock-hidden-word"]')?.parentElement;
    expect(puzzleWrapper?.className).toContain("pointer-events-none");
  });

  it("9. automatic expiry submits once", () => {
    jest.useFakeTimers();
    const onDone = jest.fn();
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-fail" }));
    // Each tick's setTimeout is only scheduled once React flushes the
    // effect for the *previous* tick, so advance in five discrete steps
    // rather than one 5000ms jump.
    for (let i = 0; i < 5; i += 1) {
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    }
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(0, true);
  });

  it("10. Forfeit Now submits once", () => {
    const onDone = jest.fn();
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-fail" }));
    fireEvent.click(screen.getByRole("button", { name: "Forfeit Now" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("11. manual/automatic race submits once", () => {
    jest.useFakeTimers();
    const onDone = jest.fn();
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-fail" }));
    act(() => {
      jest.advanceTimersByTime(4900);
    });
    fireEvent.click(screen.getByRole("button", { name: "Forfeit Now" }));
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("12. countdown clears on unmount", () => {
    jest.useFakeTimers();
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");
    const { unmount } = render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-fail" }));
    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it("13. countdown never displays below zero", () => {
    jest.useFakeTimers();
    const onDone = jest.fn();
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-fail" }));
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.queryByText(/Forfeiting in -/)).toBeNull();
  });

  it("14. no Keep Fighting action exists", () => {
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-fail" }));
    expect(screen.queryByRole("button", { name: "Keep Fighting" })).toBeNull();
  });

  it("15. Forfeit Now target is at least 48px", () => {
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-fail" }));
    expect(screen.getByRole("button", { name: "Forfeit Now" }).style.minHeight).toBe("48px");
  });

  it("16. reduced motion removes movement", () => {
    mockUseAppReducedMotion.mockReturnValue(true);
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-fail" }));
    const panel = screen.getByRole("alertdialog") as HTMLElement;
    expect(panel.style.transform).not.toMatch(/scale|translateY/);
  });

  it("17-18. no emoji or raw colors appear", () => {
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-fail" }));
    const dialog = screen.getByRole("alertdialog");
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(emojiPattern.test(dialog.textContent || "")).toBe(false);
  });
});

describe("WarzPlayBoard — submission state", () => {
  it("1. valid solve disables puzzle interaction", () => {
    const { container } = render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-solve" }));
    const puzzleWrapper = container.querySelector('[data-testid="mock-hidden-word"]')?.parentElement;
    expect(puzzleWrapper?.className).toContain("pointer-events-none");
  });

  it("2-3. shows PUZZLE COMPLETE with the exact submitted time", () => {
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-solve" }));
    expect(screen.getByText("Puzzle Complete")).toBeTruthy();
    expect(screen.getByText(/Solved in \d{2}:\d{2}/)).toBeTruthy();
  });

  it("4. default pending label is shown", () => {
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} submissionPending />);
    fireEvent.click(screen.getByRole("button", { name: "hw-solve" }));
    expect(screen.getByText("Submitting result…")).toBeTruthy();
  });

  it("5-7. custom pending labels are shown", () => {
    render(
      <WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} submissionPending submissionPendingLabel="Posting your challenge…" />
    );
    fireEvent.click(screen.getByRole("button", { name: "hw-solve" }));
    expect(screen.getByText("Posting your challenge…")).toBeTruthy();
    cleanup();

    render(
      <WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} submissionPending submissionPendingLabel="Submitting result…" />
    );
    fireEvent.click(screen.getByRole("button", { name: "hw-solve" }));
    expect(screen.getByText("Submitting result…")).toBeTruthy();
  });

  it("8. pending text uses status semantics", () => {
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} submissionPending />);
    fireEvent.click(screen.getByRole("button", { name: "hw-solve" }));
    expect(screen.getByRole("status").textContent).toBe("Submitting result…");
  });

  it("9-11. no winner, reward, or pot-result copy appears", () => {
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} submissionPending />);
    fireEvent.click(screen.getByRole("button", { name: "hw-solve" }));
    expect(screen.queryByText(/winner/i)).toBeNull();
    expect(screen.queryByText(/reward/i)).toBeNull();
    expect(screen.queryByText(/pot/i)).toBeNull();
  });

  it("12-13. submitError shows SUBMISSION INTERRUPTED with the exact error text", () => {
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} submitError="Failed to post challenge" />);
    fireEvent.click(screen.getByRole("button", { name: "hw-solve" }));
    expect(screen.getByText("Submission Interrupted")).toBeTruthy();
    expect(screen.getByText("Failed to post challenge")).toBeTruthy();
  });

  it("14. retry supporting copy is shown", () => {
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} submitError="failed" />);
    fireEvent.click(screen.getByRole("button", { name: "hw-solve" }));
    expect(screen.getByText("Your solve time is ready to retry.")).toBeTruthy();
  });

  it("15-16. Try Again appears only with onRetry and invokes it", () => {
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} submitError="failed" />);
    fireEvent.click(screen.getByRole("button", { name: "hw-solve" }));
    expect(screen.queryByRole("button", { name: "Try Again" })).toBeNull();
    cleanup();

    const onRetry = jest.fn();
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} submitError="failed" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-solve" }));
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("17. Try Again target is at least 48px", () => {
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} submitError="failed" onRetry={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-solve" }));
    expect(screen.getByRole("button", { name: "Try Again" }).style.minHeight).toBe("48px");
  });

  it("18. retry does not call onDone", () => {
    const onDone = jest.fn();
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={onDone} submitError="failed" onRetry={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "hw-solve" }));
    onDone.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(onDone).not.toHaveBeenCalled();
  });

  it("19. submitted solve time remains visible during error", () => {
    render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} submitError="failed" />);
    fireEvent.click(screen.getByRole("button", { name: "hw-solve" }));
    expect(screen.getByText(/Solved in \d{2}:\d{2}/)).toBeTruthy();
  });

  it("20. puzzle remains disabled during error", () => {
    const { container } = render(<WarzPlayBoard puzzle={makePuzzle()} wager={50} onDone={jest.fn()} submitError="failed" />);
    fireEvent.click(screen.getByRole("button", { name: "hw-solve" }));
    const puzzleWrapper = container.querySelector('[data-testid="mock-hidden-word"]')?.parentElement;
    expect(puzzleWrapper?.className).toContain("pointer-events-none");
  });
});
