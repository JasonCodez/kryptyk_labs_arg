export type SudokuCell = { row: number; col: number };
export type SudokuNotes = Record<string, number[]>;

export const emptySudokuGrid = (): number[][] => Array.from({ length: 9 }, () => Array(9).fill(0));
export const cloneSudokuGrid = (grid: number[][]): number[][] => grid.map((row) => [...row]);
export const sudokuCellKey = (row: number, col: number) => `${row}-${col}`;

export function normalizeSudokuGrid(value: unknown): number[][] | null {
  if (!Array.isArray(value) || value.length !== 9) return null;
  const grid = value.map((row) => Array.isArray(row) ? row.map(Number) : []);
  if (grid.some((row) => row.length !== 9 || row.some((n) => !Number.isInteger(n) || n < 0 || n > 9))) return null;
  return grid;
}

export function restoreSudokuGrid(value: unknown, givens: number[][]): number[][] | null {
  const grid = normalizeSudokuGrid(value);
  if (!grid) return null;
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      if (givens[row][col] !== 0 && grid[row][col] !== givens[row][col]) return null;
    }
  }
  return grid;
}

export function normalizeSudokuNotes(value: unknown): SudokuNotes {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const notes: SudokuNotes = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!/^([0-8])-([0-8])$/.test(key) || !Array.isArray(raw)) continue;
    const values = [...new Set(raw.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 9))].sort();
    if (values.length) notes[key] = values;
  }
  return notes;
}

export function sudokuPeers(row: number, col: number): SudokuCell[] {
  const peers = new Map<string, SudokuCell>();
  for (let i = 0; i < 9; i += 1) {
    if (i !== col) peers.set(sudokuCellKey(row, i), { row, col: i });
    if (i !== row) peers.set(sudokuCellKey(i, col), { row: i, col });
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r += 1) {
    for (let c = boxCol; c < boxCol + 3; c += 1) {
      if (r !== row || c !== col) peers.set(sudokuCellKey(r, c), { row: r, col: c });
    }
  }
  return [...peers.values()];
}

/** Rule-only conflicts. This deliberately does not accept or inspect a solution. */
export function findSudokuConflicts(grid: number[][]): Set<string> {
  const conflicts = new Set<string>();
  const groups: SudokuCell[][] = [];
  for (let i = 0; i < 9; i += 1) {
    groups.push(Array.from({ length: 9 }, (_, col) => ({ row: i, col })));
    groups.push(Array.from({ length: 9 }, (_, row) => ({ row, col: i })));
  }
  for (let boxRow = 0; boxRow < 3; boxRow += 1) {
    for (let boxCol = 0; boxCol < 3; boxCol += 1) {
      groups.push(Array.from({ length: 9 }, (_, index) => ({
        row: boxRow * 3 + Math.floor(index / 3), col: boxCol * 3 + index % 3,
      })));
    }
  }
  for (const group of groups) {
    const seen = new Map<number, SudokuCell[]>();
    for (const cell of group) {
      const value = grid[cell.row][cell.col];
      if (!value) continue;
      seen.set(value, [...(seen.get(value) ?? []), cell]);
    }
    for (const cells of seen.values()) {
      if (cells.length > 1) cells.forEach(({ row, col }) => conflicts.add(sudokuCellKey(row, col)));
    }
  }
  return conflicts;
}

export function isSudokuComplete(grid: number[][]): boolean {
  return grid.every((row) => row.every((value) => value >= 1 && value <= 9));
}

export function isSudokuSolved(grid: number[][]): boolean {
  return isSudokuComplete(grid) && findSudokuConflicts(grid).size === 0;
}
