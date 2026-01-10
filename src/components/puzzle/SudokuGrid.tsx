"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface SudokuGridProps {
  puzzle: number[][];
  onSubmit?: (solution: number[][]) => void;
  disabled?: boolean;
  solution?: number[][];
  validateOnChange?: boolean;
  maxAttempts?: number;
  onAttempt?: (attemptNumber: number, locked: boolean) => void;
  // Called after successful validation/animation; defaults to onSubmit timing
  onValidatedSuccess?: (solution: number[][]) => void;
  onNotify?: (message: string, type?: 'info' | 'success' | 'error') => void;
}

export default function SudokuGrid({ puzzle, onSubmit, disabled = false, solution, validateOnChange = false, onValidatedSuccess, onNotify, maxAttempts = 5, onAttempt }: SudokuGridProps) {
  const [grid, setGrid] = useState<number[][]>(() => puzzle.map((row) => [...row]));
  const [incorrectMap, setIncorrectMap] = useState<boolean[][]>(() => Array(9).fill(null).map(() => Array(9).fill(false)));
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [animating, setAnimating] = useState<'idle'|'validating'|'error'|'success'>('idle');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hasAttempted, setHasAttempted] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);

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

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  const handleSubmit = async () => {
    // Prevent submitting incomplete puzzles
    const isComplete = grid.flat().every((n) => n !== 0);
    if (!isComplete) {
      // in-grid message exists already; also provide brief non-blocking notification
      if (typeof onNotify === 'function') onNotify('Please fill all cells before submitting the Sudoku.', 'info');
      else alert('Please fill all cells before submitting the Sudoku.');
      return;
    }

    // If a solution is provided, run animated validation
    if (Array.isArray(solution)) {
      setAnimating('validating');
      const incorrect = findIncorrectCells(grid, solution);
      if (incorrect.length > 0) {
        // mark that the user has attempted to submit; count attempts but do NOT reveal incorrect cells
        setHasAttempted(true);
        const nextAttempts = attempts + 1;
        setAttempts(nextAttempts);
        const isLocked = nextAttempts >= maxAttempts;
        if (isLocked) setLocked(true);
        if (typeof onAttempt === 'function') onAttempt(nextAttempts, isLocked);
        if (typeof onNotify === 'function') {
          if (isLocked) onNotify(`Maximum attempts reached. Puzzle locked.`, 'error');
          else onNotify(`Incorrect. Attempts: ${nextAttempts}/${maxAttempts}`, 'error');
        }
        setAnimating('error');
        await sleep(800);
        setAnimating('idle');
        return;
      }

      // success animation
      setIncorrectMap(Array(9).fill(null).map(() => Array(9).fill(false)));
      setAnimating('success');

      // confetti if allowed
      if (!reducedMotion) {
        try {
          // @ts-ignore - canvas-confetti has no type declarations in this project
          const confetti = (await import('canvas-confetti')).default;
          confetti({ particleCount: 140, spread: 70, origin: { y: 0.6 } });
        } catch (e) {
          // ignore if not available
        }
      }

      // wait for pop animation to finish
      await sleep(520);
      setAnimating('idle');

      // call validated success handler (page will award points / open modal)
      if (typeof onValidatedSuccess === 'function') {
        onValidatedSuccess(grid.map((r) => [...r]));
      } else {
        onSubmit?.(grid);
      }

      return;
    }

    // No solution provided: just submit
    onSubmit(grid);
  };

  // Validation helpers
  const findIncorrectCells = (g: number[][], sol: number[][]) => {
    const incorrect: [number, number][] = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if ((puzzle[r]?.[c] || 0) === 0) {
          // only validate user-entered cells
          if (g[r][c] !== 0 && sol[r][c] !== g[r][c]) {
            incorrect.push([r, c]);
          }
        }
      }
    }
    return incorrect;
  };

  const validateGrid = (g: number[][]) => {
    if (!Array.isArray(solution)) return;
    if (!hasAttempted && !validateOnChange) return;
    const incorrect = findIncorrectCells(g, solution);
    setIncorrectCount(incorrect.length);
  };

  useEffect(() => {
    if (Array.isArray(solution) && validateOnChange) {
      validateGrid(grid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solution]);

  useEffect(() => {
    if (Array.isArray(solution) && validateOnChange) {
      validateGrid(grid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid]);

  useEffect(() => {
    try {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(Boolean(mq.matches));
    } catch (e) {
      setReducedMotion(false);
    }
  }, []);

  const isComplete = grid.flat().every((n) => n !== 0);

  return (
    <div className="flex flex-col gap-4 items-center justify-center">
      <motion.div
          className="inline-block border-4 p-3 bg-[#071016] rounded"
          style={{ borderColor: "#FDE74C", width: '100%', maxWidth: 'min(90vw,720px)' }}
          variants={{ idle: {}, popParent: { transition: { staggerChildren: 0.03 } } }}
          animate={animating === 'success' ? 'popParent' : 'idle'}
        >
          {grid.map((row, rowIdx) => (
            <div key={rowIdx} className="flex">
              {row.map((cell, colIdx) => {
              const isGiven = puzzle[rowIdx]?.[colIdx] !== 0;
              const thickRight = colIdx === 2 || colIdx === 5;
              const thickBottom = rowIdx === 2 || rowIdx === 5;

              return (
                  <motion.div
                    key={`${rowIdx}-${colIdx}`}
                    variants={{
                      idle: { scale: 1, x: 0 },
                      pop: { scale: [1, 1.12, 1], transition: { duration: 0.45, ease: 'easeOut' } },
                      shake: { x: [0, -6, 6, -6, 6, 0], transition: { duration: 0.6, ease: 'easeInOut' } },
                    }}
                    animate={animating === 'success' ? 'pop' : 'idle'}
                    className="flex-1"
                  >
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={cell === 0 ? "" : String(cell)}
                      disabled={disabled || isGiven}
                      onChange={(e) => handleCellChange(rowIdx, colIdx, e.target.value)}
                      className="w-full h-full text-center bg-slate-800 border focus:outline-none disabled:opacity-80"
                      style={{
                        width: '100%',
                        height: '100%',
                        boxSizing: 'border-box',
                        aspectRatio: '1 / 1',
                        minWidth: 36,
                        minHeight: 36,
                        fontSize: 'clamp(16px, 4vw, 28px)',
                        borderRightWidth: thickRight ? "3px" : "1px",
                        borderBottomWidth: thickBottom ? "3px" : "1px",
                        borderRightColor: thickRight ? "#3891A6" : undefined,
                        borderBottomColor: thickBottom ? "#3891A6" : undefined,
                        fontWeight: isGiven ? 700 : 500,
                        padding: 0,
                        lineHeight: '1',
                        color: isGiven ? '#FFFFFF' : '#FDE74C',
                        borderColor: '#334155',
                        boxShadow: undefined,
                      }}
                    />
                  </motion.div>
              );
            })}
          </div>
        ))}
        </motion.div>

      <div className="w-full flex items-center justify-center">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !isComplete}
          className="px-4 py-2 rounded bg-slate-700 text-white disabled:opacity-50"
        >
          Submit Sudoku
        </button>
      </div>
      {!isComplete && !disabled && (
        <div className="text-sm text-yellow-300 text-center">Please complete all cells before submitting.</div>
      )}
    </div>
  );
}
