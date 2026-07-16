/** @jest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import SudokuPuzzle, { type SudokuPuzzleHandle } from "./SudokuPuzzle";
import { findSudokuConflicts, restoreSudokuGrid, sudokuCellKey } from "@/lib/sudokuPlay";

jest.mock("framer-motion", () => ({ motion: { div: ({ children, animate, transition, variants, ...props }: React.HTMLAttributes<HTMLDivElement> & { animate?: unknown; transition?: unknown; variants?: unknown }) => {
  void animate; void transition; void variants; return <div {...props}>{children}</div>;
} } }));
jest.mock("canvas-confetti", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("@/components/juice/Pressable", () => function PressableMock(props: React.ButtonHTMLAttributes<HTMLButtonElement>) { return <button {...props} />; });
jest.mock("@/lib/juice", () => ({ juice: { tap: jest.fn(), success: jest.fn(), error: jest.fn() } }));

const SOLUTION = [
  [5,3,4,6,7,8,9,1,2],[6,7,2,1,9,5,3,4,8],[1,9,8,3,4,2,5,6,7],
  [8,5,9,7,6,1,4,2,3],[4,2,6,8,5,3,7,9,1],[7,1,3,9,2,4,8,5,6],
  [9,6,1,5,3,7,2,8,4],[2,8,7,4,1,9,6,3,5],[3,4,5,2,8,6,1,7,9],
];
const PUZZLE = SOLUTION.map((row, r) => row.map((value, c) => (r === 0 && c < 2 ? value : 0)));

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", { writable: true, value: () => ({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() }) });
});
afterEach(() => { cleanup(); localStorage.clear(); jest.clearAllMocks(); jest.useRealTimers(); });

function renderGame(overrides: Partial<React.ComponentProps<typeof SudokuPuzzle>> = {}) {
  const onComplete = jest.fn(async () => ({ success: true }));
  const result = render(<SudokuPuzzle puzzleId="sudoku-test" puzzle={PUZZLE} solution={SOLUTION} mode="daily" displayMode="app-shell" onComplete={onComplete} {...overrides} />);
  return { ...result, onComplete };
}

test("givens cannot be edited and one key press edits one selected cell", () => {
  renderGame();
  const surface = screen.getByLabelText(/Sudoku game/);
  fireEvent.click(screen.getByRole("gridcell", { name: /Row 1, column 1/ }));
  fireEvent.keyDown(surface, { key: "9" });
  expect(screen.getByRole("gridcell", { name: /Row 1, column 1, given, value 5/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("gridcell", { name: /Row 1, column 3/ }));
  fireEvent.keyDown(surface, { key: "4" });
  expect(screen.getByRole("gridcell", { name: /Row 1, column 3, editable, value 4/ })).toBeTruthy();
  expect(screen.getByRole("gridcell", { name: /Row 1, column 3, editable, value 4/ }).textContent).toBe("4");
});

test("notes toggle, repeat removes a note, and undo restores it", () => {
  renderGame(); const surface = screen.getByLabelText(/Sudoku game/);
  fireEvent.click(screen.getByRole("gridcell", { name: /Row 1, column 3/ }));
  fireEvent.keyDown(surface, { key: "n" }); fireEvent.keyDown(surface, { key: "4" });
  expect(screen.getByRole("gridcell", { name: /candidates 4/ })).toBeTruthy();
  fireEvent.keyDown(surface, { key: "4" }); expect(screen.getByRole("gridcell", { name: /Row 1, column 3, editable, empty/ })).toBeTruthy();
  fireEvent.keyDown(surface, { key: "z", ctrlKey: true }); expect(screen.getByRole("gridcell", { name: /candidates 4/ })).toBeTruthy();
});

test("backspace erases one cell and arrows move selection", () => {
  renderGame(); const surface = screen.getByLabelText(/Sudoku game/);
  fireEvent.click(screen.getByRole("gridcell", { name: /Row 2, column 2/ })); fireEvent.keyDown(surface, { key: "7" });
  fireEvent.keyDown(surface, { key: "Backspace" }); expect(screen.getByRole("gridcell", { name: /Row 2, column 2, editable, empty/ })).toBeTruthy();
  fireEvent.keyDown(surface, { key: "ArrowRight" }); expect(screen.getByRole("gridcell", { name: /Row 2, column 3/ }).getAttribute("aria-selected")).toBe("true");
});

test("incomplete checks do not submit or consume attempts", () => {
  const onPresentationChange = jest.fn(); const { onComplete } = renderGame({ onPresentationChange });
  const check = screen.getByRole("button", { name: "Check Puzzle" }) as HTMLButtonElement; expect(check.disabled).toBe(true);
  fireEvent.click(check); expect(onComplete).not.toHaveBeenCalled();
  expect(onPresentationChange.mock.calls.at(-1)?.[0].attemptsUsed).toBe(0);
});

test("app-shell removes duplicate title while standalone retains compact controls", () => {
  const first = renderGame(); expect(screen.queryByRole("heading", { name: "SUDOKU" })).toBeNull(); first.unmount();
  renderGame({ displayMode: "standalone" }); expect(screen.getByRole("heading", { name: "SUDOKU" })).toBeTruthy(); expect(screen.getByRole("button", { name: "Help" })).toBeTruthy();
});

test("imperative help control opens a focus-trapped dialog", () => {
  const ref = createRef<SudokuPuzzleHandle>(); renderGame({ ref }); act(() => ref.current?.openInstructions());
  expect(screen.getByRole("dialog", { name: "How to play Sudoku" })).toBeTruthy();
});

test("rule conflicts do not require a solution", () => {
  const grid = PUZZLE.map((row) => [...row]); grid[1][0] = 4; grid[1][1] = 4;
  const conflicts = findSudokuConflicts(grid); expect(conflicts.has(sudokuCellKey(1, 0))).toBe(true); expect(conflicts.has(sudokuCellKey(1, 1))).toBe(true);
});

test("restored state cannot overwrite givens", () => {
  const bad = PUZZLE.map((row) => [...row]); bad[0][0] = 9;
  expect(restoreSudokuGrid(bad, PUZZLE)).toBeNull();
});

test("server-confirmed completion is submitted exactly once", async () => {
  localStorage.setItem("sudoku-state:v2:sudoku-test", JSON.stringify({ version: 2, grid: SOLUTION, notes: {} }));
  const { onComplete } = renderGame();
  const check = await screen.findByRole("button", { name: "Check Puzzle" });
  await waitFor(() => expect((check as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(check); fireEvent.click(check);
  await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
});

test("completion failure leaves Retry Submission available", async () => {
  localStorage.setItem("sudoku-state:v2:sudoku-test", JSON.stringify({ version: 2, grid: SOLUTION, notes: {} }));
  renderGame({ onComplete: jest.fn(async () => ({ success: false, error: "Offline" })) });
  const check = await screen.findByRole("button", { name: "Check Puzzle" }); await waitFor(() => expect((check as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(check);
  expect(await screen.findByRole("button", { name: "Retry Submission" })).toBeTruthy(); expect(screen.getByText("Offline")).toBeTruthy();
});

test("incorrect completed catalog check consumes one persistent attempt and locks at the maximum", async () => {
  const wrong = SOLUTION.map((row) => [...row]); [wrong[0][2], wrong[0][3]] = [wrong[0][3], wrong[0][2]];
  localStorage.setItem("sudoku-state:v2:sudoku-test", JSON.stringify({ version: 2, grid: wrong, notes: {} }));
  const onIncorrectAttempt = jest.fn(async () => ({ success: false, attemptsUsed: 1 }));
  renderGame({ mode: "catalog", attemptsAllowed: 1, serverStartedAt: new Date().toISOString(), serverExpiresAt: new Date(Date.now() + 60_000).toISOString(), onIncorrectAttempt });
  const check = await screen.findByRole("button", { name: "Check Puzzle" }); await waitFor(() => expect((check as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(check);
  await waitFor(() => expect(onIncorrectAttempt).toHaveBeenCalledTimes(1)); expect(await screen.findByRole("heading", { name: "Round over" })).toBeTruthy(); expect(screen.getByText("You used all available attempts.")).toBeTruthy();
});

test("catalog timer derives from server expiry and time-out fires once", async () => {
  jest.useFakeTimers(); const now = new Date("2026-07-15T12:00:00.000Z"); jest.setSystemTime(now);
  const onTimeout = jest.fn(); const onPresentationChange = jest.fn();
  renderGame({ mode: "catalog", serverStartedAt: now.toISOString(), serverExpiresAt: new Date(now.getTime() + 2_000).toISOString(), onTimeout, onPresentationChange });
  await act(async () => { jest.advanceTimersByTime(2_500); });
  expect(onTimeout).toHaveBeenCalledTimes(1); expect(onPresentationChange.mock.calls.at(-1)?.[0].status).toBe("lost");
  expect(onPresentationChange.mock.calls.length).toBeLessThanOrEqual(5);
  await act(async () => { jest.advanceTimersByTime(2_000); }); expect(onTimeout).toHaveBeenCalledTimes(1); jest.useRealTimers();
});
