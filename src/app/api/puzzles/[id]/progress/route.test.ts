import { validateSudokuAttempt, type SudokuAttemptProgress } from "@/lib/puzzle-progress/sudoku-attempt-validation";

const SOLUTION = [
  [5,3,4,6,7,8,9,1,2],[6,7,2,1,9,5,3,4,8],[1,9,8,3,4,2,5,6,7],
  [8,5,9,7,6,1,4,2,3],[4,2,6,8,5,3,7,9,1],[7,1,3,9,2,4,8,5,6],
  [9,6,1,5,3,7,2,8,4],[2,8,7,4,1,9,6,3,5],[3,4,5,2,8,6,1,7,9],
];
const NOW = new Date("2026-07-15T12:00:00.000Z");

function activeProgress(overrides: Partial<SudokuAttemptProgress> = {}): SudokuAttemptProgress {
  return {
    solved: false,
    attempts: 0,
    sudokuStartedAt: new Date(NOW.getTime() - 30_000),
    sudokuExpiresAt: new Date(NOW.getTime() + 870_000),
    sudokuLockedAt: null,
    ...overrides,
  };
}

test("Sudoku log_attempt rejects a round without a timer", () => {
  expect(validateSudokuAttempt(activeProgress({ sudokuStartedAt: null, sudokuExpiresAt: null }), 5, SOLUTION, SOLUTION, NOW.getTime()))
    .toMatchObject({ error: "Sudoku timer not started", status: 403 });
});

test("Sudoku log_attempt rejects an expired timer", () => {
  expect(validateSudokuAttempt(activeProgress({ sudokuExpiresAt: new Date(NOW.getTime() - 1) }), 5, SOLUTION, SOLUTION, NOW.getTime()))
    .toMatchObject({ error: "Sudoku time expired", status: 403, lockReason: "time_limit" });
});

test("Sudoku log_attempt rejects a locked round", () => {
  expect(validateSudokuAttempt(activeProgress({ sudokuLockedAt: NOW }), 5, SOLUTION, SOLUTION, NOW.getTime()))
    .toMatchObject({ error: "Sudoku round locked", status: 403 });
});

test("Sudoku log_attempt rejects the maximum attempt count", () => {
  expect(validateSudokuAttempt(activeProgress({ attempts: 5 }), 5, SOLUTION, SOLUTION, NOW.getTime()))
    .toMatchObject({ error: "Maximum Sudoku attempts reached", status: 403 });
});

test("Sudoku log_attempt accepts one incorrect completed grid in an active round", () => {
  const wrong = SOLUTION.map((row) => [...row]);
  [wrong[0][2], wrong[0][3]] = [wrong[0][3], wrong[0][2]];
  expect(validateSudokuAttempt(activeProgress(), 5, wrong, SOLUTION, NOW.getTime())).toBeNull();
});
