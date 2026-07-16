export interface SudokuAttemptProgress {
  solved: boolean;
  attempts: number;
  sudokuStartedAt: Date | null;
  sudokuExpiresAt: Date | null;
  sudokuLockedAt: Date | null;
}

export interface SudokuAttemptRejection {
  error: string;
  status: number;
  lockReason?: "time_limit";
}

function isCompletedSudokuGrid(grid: number[][] | undefined): grid is number[][] {
  return Array.isArray(grid) && grid.length === 9 && grid.every((row) =>
    Array.isArray(row) && row.length === 9 && row.every((value) => Number.isInteger(value) && value >= 1 && value <= 9)
  );
}

export function validateSudokuAttempt(
  progress: SudokuAttemptProgress,
  maxAttempts: number,
  submitted: number[][] | undefined,
  solution: number[][] | null,
  nowMs = Date.now(),
): SudokuAttemptRejection | null {
  if (progress.solved) return { error: "Sudoku puzzle already solved", status: 409 };
  if (!progress.sudokuStartedAt || !progress.sudokuExpiresAt) return { error: "Sudoku timer not started", status: 403 };
  if (progress.sudokuLockedAt) return { error: "Sudoku round locked", status: 403 };
  if (nowMs >= progress.sudokuExpiresAt.getTime()) return { error: "Sudoku time expired", status: 403, lockReason: "time_limit" };
  if (progress.attempts >= maxAttempts) return { error: "Maximum Sudoku attempts reached", status: 403 };
  if (!isCompletedSudokuGrid(submitted)) return { error: "A completed Sudoku grid is required", status: 400 };
  if (!solution) return { error: "Server missing Sudoku solution", status: 500 };
  if (submitted.every((row, rowIndex) => row.every((value, colIndex) => value === solution[rowIndex]?.[colIndex]))) {
    return { error: "Correct Sudoku grids must use attempt_success", status: 400 };
  }
  return null;
}
