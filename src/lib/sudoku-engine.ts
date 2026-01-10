/**
 * Sudoku Puzzle Generator and Solver
 * Generates valid Sudoku puzzles with configurable difficulty levels
 */

// Types
export interface SudokuGrid {
  puzzle: number[][]; // 0 = empty cell
  solution: number[][];
}

export type SudokuDifficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'extreme';

// Helper functions
const isValid = (grid: number[][], row: number, col: number, num: number): boolean => {
  // Check row
  for (let c = 0; c < 9; c++) {
    if (grid[row][c] === num) return false;
  }

  // Check column
  for (let r = 0; r < 9; r++) {
    if (grid[r][col] === num) return false;
  }

  // Check 3x3 box
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (grid[r][c] === num) return false;
    }
  }

  return true;
};

// Helper: find empty cell with minimum remaining values (MRV heuristic)
const findBestCell = (grid: number[][]): { row: number; col: number; candidates: number[] } | null => {
  let best: { row: number; col: number; candidates: number[] } | null = null;

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] === 0) {
        const candidates: number[] = [];
        for (let num = 1; num <= 9; num++) {
          if (isValid(grid, row, col, num)) candidates.push(num);
        }

        if (best === null || candidates.length < best.candidates.length) {
          best = { row, col, candidates };
          if (best.candidates.length === 0) return best; // dead end
        }
      }
    }
  }

  return best;
};

const fillGrid = (grid: number[][]): boolean => {
  const cell = findBestCell(grid);
  if (!cell) return true; // no empty cells

  // Order candidates by least-constraining-value (LCV) for better pruning
  const numbers = orderCandidatesByLCV(grid, cell.row, cell.col, cell.candidates);

  for (const num of numbers) {
    grid[cell.row][cell.col] = num;
    if (fillGrid(grid)) return true;
    grid[cell.row][cell.col] = 0;
  }

  return false;
};

// Order candidate numbers by least constraining value: prefer numbers that leave
// the most choices for neighboring empty cells (reduces dead-ends)
const orderCandidatesByLCV = (grid: number[][], row: number, col: number, candidates: number[]): number[] => {
  const scores: { num: number; score: number }[] = [];

  for (const num of candidates) {
    grid[row][col] = num;
    let impact = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] === 0) {
          // count remaining candidates for this empty cell
          let cnt = 0;
          for (let n = 1; n <= 9; n++) if (isValid(grid, r, c, n)) cnt++;
          impact += cnt;
        }
      }
    }
    scores.push({ num, score: impact });
    grid[row][col] = 0;
  }

  // Higher impact is better (more choices for others) -> sort desc
  scores.sort((a, b) => b.score - a.score);
  return scores.map(s => s.num);
};

const createEmptyGrid = (): number[][] => {
  return Array(9)
    .fill(null)
    .map(() => Array(9).fill(0));
};

const copyGrid = (grid: number[][]): number[][] => {
  return grid.map(row => [...row]);
};

// Fisher-Yates shuffle
const shuffleArray = <T>(arr: T[]): T[] => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
};

const countSolutions = (grid: number[][], limit: number = 2): number => {
  let count = 0;

  const solve = (): boolean => {
    const best = findBestCell(grid);
    if (!best) {
      count++;
      return count >= limit; // stop if we've reached the limit
    }

    // Use LCV ordering to find conflicts earlier
    const ordered = orderCandidatesByLCV(grid, best.row, best.col, best.candidates);
    for (const num of ordered) {
      grid[best.row][best.col] = num;
      if (solve()) {
        grid[best.row][best.col] = 0;
        return true; // early exit when limit reached
      }
      grid[best.row][best.col] = 0;
    }

    return false;
  };

  solve();
  return count;
};

export const generateSudoku = (difficulty: SudokuDifficulty = 'medium'): SudokuGrid => {
  // Create solved grid
  const solution = createEmptyGrid();
  fillGrid(solution);

  // Create puzzle by removing numbers
  const puzzle = copyGrid(solution);
  
  // Determine how many cells to remove based on difficulty
  const removalCounts: Record<SudokuDifficulty, number> = {
    easy: 40,      // ~41 clues
    medium: 50,    // ~31 clues
    hard: 55,      // ~26 clues
    expert: 60,    // ~21 clues
    extreme: 64,   // ~17 clues (very hard)
  };

  const cellsToRemove = removalCounts[difficulty];
  let removed = 0;

  // Create a shuffled list of all cell coordinates for deterministic-ish passes
  const coords: [number, number][] = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) coords.push([r, c]);
  shuffleArray(coords);

  // First pass: try removing cells once in shuffled order (favors spread removals)
  for (const [row, col] of coords) {
    if (removed >= cellsToRemove) break;
    if (puzzle[row][col] === 0) continue;
    const backup = puzzle[row][col];
    puzzle[row][col] = 0;
    const testGrid = copyGrid(puzzle);
    if (countSolutions(testGrid, 2) === 1) {
      removed++;
    } else {
      puzzle[row][col] = backup;
    }
  }

  // If we still need to remove more, do randomized attempts but cycle through shuffled coords
  if (removed < cellsToRemove) {
    const maxAttempts = Math.max(1000, (cellsToRemove - removed) * 200);
    let attempts = 0;
    let idx = 0;
    while (removed < cellsToRemove && attempts < maxAttempts) {
      attempts++;
      const [row, col] = coords[idx++ % coords.length];
      if (puzzle[row][col] === 0) continue;

      const backup = puzzle[row][col];
      puzzle[row][col] = 0;
      const testGrid = copyGrid(puzzle);
      if (countSolutions(testGrid, 2) === 1) {
        removed++;
      } else {
        puzzle[row][col] = backup;
      }
    }
  }

  return { puzzle, solution };
};

export const solveSudoku = (grid: number[][]): number[][] | null => {
  const solution = copyGrid(grid);

  const solve = (): boolean => {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (solution[row][col] === 0) {
          for (let num = 1; num <= 9; num++) {
            if (isValid(solution, row, col, num)) {
              solution[row][col] = num;
              if (solve()) return true;
              solution[row][col] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  };

  return solve() ? solution : null;
};

export const validateSudokuAnswer = (submitted: number[][], solution: number[][]): boolean => {
  // Check if grids match
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (submitted[row][col] !== solution[row][col]) {
        return false;
      }
    }
  }
  return true;
};

export const isValidSudoku = (grid: number[][]): boolean => {
  // Check for any invalid numbers or duplicates
  const rows = Array(9)
    .fill(null)
    .map(() => new Set<number>());
  const cols = Array(9)
    .fill(null)
    .map(() => new Set<number>());
  const boxes = Array(9)
    .fill(null)
    .map(() => new Set<number>());

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const num = grid[row][col];
      if (num < 0 || num > 9 || (num !== 0 && Number.isNaN(num))) {
        return false;
      }

      if (num !== 0) {
        const boxIndex = Math.floor(row / 3) * 3 + Math.floor(col / 3);

        if (
          rows[row].has(num) ||
          cols[col].has(num) ||
          boxes[boxIndex].has(num)
        ) {
          return false;
        }

        rows[row].add(num);
        cols[col].add(num);
        boxes[boxIndex].add(num);
      }
    }
  }

  return true;
};
