"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { findSudokuConflicts, normalizeSudokuNotes, sudokuCellKey, type SudokuCell, type SudokuNotes } from "@/lib/sudokuPlay";

export interface SudokuGridProps {
  puzzle: number[][];
  givens?: number[][];
  grid?: number[][];
  notes?: SudokuNotes;
  selectedCell?: SudokuCell | null;
  lockedCells?: Set<string>;
  hintedCells?: Set<string>;
  disabled?: boolean;
  celebrating?: boolean;
  onSelectCell?: (cell: SudokuCell) => void;
  onChange?: (grid: number[][]) => void;
  onSubmit?: (grid: number[][]) => void;
  onValidatedSuccess?: (grid: number[][]) => void;
  solution?: number[][];
  validateOnChange?: boolean;
  maxAttempts?: number;
  usedAttempts?: number;
  onAttempt?: (attemptNumber: number, locked: boolean) => void;
  onNotify?: (message: string, type?: "info" | "success" | "error") => void;
  onGiveUp?: () => void;
  onRequestGiveUp?: () => void;
  hintTokens?: number;
  onHintUsed?: () => Promise<boolean>;
}

/** Semantic, input-free Sudoku board. Game state and validation live in SudokuPuzzle. */
export default function SudokuGrid({
  puzzle, givens = puzzle, grid: controlledGrid, notes: controlledNotes, selectedCell: controlledSelected,
  lockedCells = new Set(), hintedCells = new Set(), disabled = false, celebrating = false, onSelectCell,
}: SudokuGridProps) {
  const [fallbackGrid] = useState(() => puzzle.map((row) => [...row]));
  const [fallbackSelected, setFallbackSelected] = useState<SudokuCell | null>(null);
  const grid = controlledGrid ?? fallbackGrid;
  const notes = controlledNotes ?? normalizeSudokuNotes({});
  const selectedCell = controlledSelected === undefined ? fallbackSelected : controlledSelected;
  const conflicts = useMemo(() => findSudokuConflicts(grid), [grid]);
  const selectedValue = selectedCell ? grid[selectedCell.row]?.[selectedCell.col] : 0;

  const select = (row: number, col: number) => {
    if (disabled) return;
    const next = { row, col };
    setFallbackSelected(next);
    onSelectCell?.(next);
  };

  return (
    <motion.div
      className={`sudoku-grid${celebrating ? " is-celebrating" : ""}`}
      role="grid"
      aria-label="Sudoku board"
      aria-rowcount={9}
      aria-colcount={9}
      animate={celebrating ? { scale: [1, 1.015, 1] } : undefined}
      transition={{ duration: 0.5 }}
    >
      {grid.map((row, rowIndex) => (
        <div className="sudoku-row" role="row" key={rowIndex}>
          {row.map((value, colIndex) => {
            const key = sudokuCellKey(rowIndex, colIndex);
            const given = givens[rowIndex]?.[colIndex] !== 0;
            const selected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
            const related = selectedCell != null && (
              selectedCell.row === rowIndex || selectedCell.col === colIndex ||
              (Math.floor(selectedCell.row / 3) === Math.floor(rowIndex / 3) && Math.floor(selectedCell.col / 3) === Math.floor(colIndex / 3))
            );
            const matching = Boolean(value && selectedValue === value);
            const cellNotes = notes[key] ?? [];
            const label = `Row ${rowIndex + 1}, column ${colIndex + 1}, ${given ? "given" : "editable"}, ${value ? `value ${value}` : cellNotes.length ? `candidates ${cellNotes.join(", ")}` : "empty"}`;
            return (
              <button
                key={key}
                type="button"
                role="gridcell"
                className="sudoku-cell"
                data-row={rowIndex + 1}
                data-column={colIndex + 1}
                data-given={given || undefined}
                data-related={related || undefined}
                data-matching={matching || undefined}
                data-conflict={conflicts.has(key) || undefined}
                data-hinted={hintedCells.has(key) || undefined}
                data-locked={lockedCells.has(key) || undefined}
                aria-selected={selected}
                aria-readonly={given || lockedCells.has(key)}
                aria-label={label}
                tabIndex={selected || (!selectedCell && rowIndex === 0 && colIndex === 0) ? 0 : -1}
                disabled={disabled}
                onClick={() => select(rowIndex, colIndex)}
              >
                {value ? <span className={given ? "sudoku-given" : "sudoku-value"}>{value}</span> : (
                  <span className="sudoku-candidates" aria-hidden>
                    {Array.from({ length: 9 }, (_, index) => index + 1).map((candidate) => (
                      <span key={candidate}>{cellNotes.includes(candidate) ? candidate : ""}</span>
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </motion.div>
  );
}
