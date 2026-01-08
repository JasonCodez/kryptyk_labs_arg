/**
 * Sudoku Puzzle Generator and Solver
 * Generates valid Sudoku puzzles with configurable difficulty levels
 */

// Types
export interface SudokuGrid {
  puzzle: number[][]; // 0 = empty cell
  solution: number[][];
}

export type SudokuDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

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

const fillGrid = (grid: number[][]): boolean => {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] === 0) {
        // Random order for variety
        const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
        
        for (const num of numbers) {
          if (isValid(grid, row, col, num)) {
            grid[row][col] = num;
            if (fillGrid(grid)) return true;
            grid[row][col] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
};

const createEmptyGrid = (): number[][] => {
  return Array(9)
    .fill(null)
    .map(() => Array(9).fill(0));
};

const copyGrid = (grid: number[][]): number[][] => {
  return grid.map(row => [...row]);
};

const countSolutions = (grid: number[][], limit: number = 2): number => {
  let count = 0;

  const solve = (): boolean => {
    if (count > limit) return true;

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (grid[row][col] === 0) {
          for (let num = 1; num <= 9; num++) {
            if (isValid(grid, row, col, num)) {
              grid[row][col] = num;
              if (solve()) return true;
              grid[row][col] = 0;
            }
          }
          return false;
        }
      }
    }

    count++;
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
    easy: 40,      // 41 clues
    medium: 50,    // 31 clues
    hard: 55,      // 26 clues
    expert: 60,    // 21 clues
  };

  const cellsToRemove = removalCounts[difficulty];
  let removed = 0;

  // Remove cells while maintaining unique solution
  while (removed < cellsToRemove) {
    const row = Math.floor(Math.random() * 9);
    const col = Math.floor(Math.random() * 9);

    if (puzzle[row][col] !== 0) {
      const backup = puzzle[row][col];
      puzzle[row][col] = 0;

      // Check if still has unique solution
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
