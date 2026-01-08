"use client";

import { useEffect, useState } from "react";

interface SudokuGridProps {
  puzzle: number[][];
  onSubmit: (solution: number[][]) => void;
  disabled?: boolean;
}

export default function SudokuGrid({ puzzle, onSubmit, disabled = false }: SudokuGridProps) {
  const [grid, setGrid] = useState<number[][]>(() => puzzle.map((row) => [...row]));

  useEffect(() => {
    setGrid(puzzle.map((row) => [...row]));
  }, [puzzle]);

  const handleCellChange = (row: number, col: number, value: string) => {
    if (disabled) return;
    if (puzzle[row]?.[col] !== 0) return;

    const num = value === "" ? 0 : Number.parseInt(value, 10);
    if (Number.isNaN(num) || num < 0 || num > 9) return;

    setGrid((prev) => {
      const next = prev.map((r) => [...r]);
      next[row][col] = num;
      return next;
    });
  };

  const handleSubmit = () => {
    onSubmit(grid);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-block border-4" style={{ borderColor: "#FDE74C" }}>
        {grid.map((row, rowIdx) => (
          <div key={rowIdx} className="flex">
            {row.map((cell, colIdx) => {
              const isGiven = puzzle[rowIdx]?.[colIdx] !== 0;
              const thickRight = colIdx === 2 || colIdx === 5;
              const thickBottom = rowIdx === 2 || rowIdx === 5;

              return (
                <input
                  key={`${rowIdx}-${colIdx}`}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={cell === 0 ? "" : String(cell)}
                  disabled={disabled || isGiven}
                  onChange={(e) => handleCellChange(rowIdx, colIdx, e.target.value)}
                  className="w-10 h-10 text-center text-white bg-slate-800 border border-slate-600 focus:outline-none disabled:opacity-80"
                  style={{
                    borderRightWidth: thickRight ? "3px" : "1px",
                    borderBottomWidth: thickBottom ? "3px" : "1px",
                    borderRightColor: thickRight ? "#3891A6" : undefined,
                    borderBottomColor: thickBottom ? "#3891A6" : undefined,
                    fontWeight: isGiven ? 700 : 500,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled}
        className="px-4 py-2 rounded bg-slate-700 text-white disabled:opacity-50"
      >
        Submit Sudoku
      </button>
    </div>
  );
}
