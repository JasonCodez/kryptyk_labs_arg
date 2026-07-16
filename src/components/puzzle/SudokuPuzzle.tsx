"use client";

import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
} from "react";
import confetti from "canvas-confetti";
import Link from "next/link";
import SudokuGrid from "./SudokuGrid";
import SudokuNumberPad from "./sudoku/SudokuNumberPad";
import SudokuUtilityBar from "./sudoku/SudokuUtilityBar";
import SudokuHelpDialog from "./sudoku/SudokuHelpDialog";
import SudokuConfirmDialog from "./sudoku/SudokuConfirmDialog";
import {
  cloneSudokuGrid, findSudokuConflicts, isSudokuComplete, normalizeSudokuGrid, normalizeSudokuNotes,
  restoreSudokuGrid, sudokuCellKey, sudokuPeers, type SudokuCell, type SudokuNotes,
} from "@/lib/sudokuPlay";
import { juice } from "@/lib/juice";

export type SudokuStatus = "ready" | "starting" | "playing" | "validating" | "won" | "lost" | "error";

export interface SudokuPresentationState {
  status: SudokuStatus;
  timeMode: "elapsed" | "remaining";
  timeMs: number;
  attemptsUsed: number;
  attemptsAllowed: number;
  attemptsLeft: number;
  filledCells: number;
  totalEditableCells: number;
  notesMode: boolean;
  selectedCell: SudokuCell | null;
}

export interface SudokuPuzzleHandle {
  openInstructions(): void;
  focusGame(): void;
  toggleNotes(): void;
  undo(): void;
  requestGiveUp(): void;
}

export interface SudokuRoundState {
  startedAt?: string | null;
  expiresAt?: string | null;
  lockedAt?: string | null;
  lockReason?: string | null;
  attemptsUsed?: number;
}

export interface SudokuCheckResult {
  success: boolean;
  attemptsUsed?: number;
  error?: string;
}

interface SudokuSnapshot { grid: number[][]; notes: SudokuNotes; hinted: string[]; locked: string[] }

export interface SudokuPuzzleProps {
  puzzleId: string;
  puzzle: number[][];
  solution: number[][];
  mode: "daily" | "catalog";
  displayMode?: "standalone" | "app-shell";
  attemptsUsed?: number;
  attemptsAllowed?: number;
  hintTokens?: number;
  timeLimitSeconds?: number;
  serverStartedAt?: string | null;
  serverExpiresAt?: string | null;
  serverLockedAt?: string | null;
  serverLockReason?: string | null;
  onStartRound?: () => Promise<SudokuRoundState>;
  onIncorrectAttempt?: (grid: number[][]) => Promise<SudokuCheckResult>;
  onComplete: (grid: number[][], elapsedSeconds: number) => Promise<SudokuCheckResult>;
  onHintUsed?: () => Promise<boolean>;
  onGiveUp?: () => Promise<void>;
  onTimeout?: () => Promise<void>;
  onRetry?: () => Promise<SudokuRoundState>;
  onCelebrationComplete?: () => void;
  onPresentationChange?: (state: SudokuPresentationState) => void;
}

const storageKey = (id: string) => `sudoku-state:v2:${id}`;
const sameGrid = (a: number[][], b: number[][]) => a.every((row, r) => row.every((value, c) => value === b[r]?.[c]));

const SudokuPuzzle = forwardRef<SudokuPuzzleHandle, SudokuPuzzleProps>(function SudokuPuzzle({
  puzzleId, puzzle, solution, mode, displayMode = "standalone", attemptsUsed: attemptsUsedProp = 0,
  attemptsAllowed = mode === "daily" ? Number.MAX_SAFE_INTEGER : 5, hintTokens = 0,
  timeLimitSeconds = 15 * 60,
  serverStartedAt = null, serverExpiresAt = null, serverLockedAt = null, serverLockReason = null,
  onStartRound, onIncorrectAttempt, onComplete, onHintUsed, onGiveUp, onTimeout, onRetry, onCelebrationComplete,
  onPresentationChange,
}, ref) {
  const givens = useMemo(() => normalizeSudokuGrid(puzzle) ?? Array.from({ length: 9 }, () => Array(9).fill(0)), [puzzle]);
  const safeSolution = useMemo(() => normalizeSudokuGrid(solution), [solution]);
  const [grid, setGrid] = useState(() => cloneSudokuGrid(givens));
  const [notes, setNotes] = useState<SudokuNotes>({});
  const [selectedCell, setSelectedCell] = useState<SudokuCell | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [history, setHistory] = useState<SudokuSnapshot[]>([]);
  const [hintedCells, setHintedCells] = useState<Set<string>>(new Set());
  const [lockedCells, setLockedCells] = useState<Set<string>>(new Set());
  const [helpOpen, setHelpOpen] = useState(false);
  const [giveUpOpen, setGiveUpOpen] = useState(false);
  const [status, setStatus] = useState<SudokuStatus>(() => serverLockedAt ? "lost" : mode === "daily" ? "playing" : "ready");
  const [message, setMessage] = useState("");
  const [startError, setStartError] = useState("");
  const [completionError, setCompletionError] = useState("");
  const [timeoutError, setTimeoutError] = useState("");
  const [timeoutPending, setTimeoutPending] = useState(false);
  const [timeoutCommitted, setTimeoutCommitted] = useState(false);
  const [attemptsUsed, setAttemptsUsed] = useState(attemptsUsedProp);
  const [startedAt, setStartedAt] = useState(serverStartedAt);
  const [expiresAt, setExpiresAt] = useState(serverExpiresAt);
  const [lockReason, setLockReason] = useState(serverLockReason);
  const [timeMs, setTimeMs] = useState(() => mode === "catalog" ? Math.max(1, timeLimitSeconds) * 1000 : 0);
  const [celebrating, setCelebrating] = useState(false);
  const gameRef = useRef<HTMLDivElement>(null);
  const completionRef = useRef(false);
  const timeoutRef = useRef(false);
  const timeoutCommitRef = useRef<Promise<void> | null>(null);
  const hintPendingRef = useRef(false);
  const startRoundRef = useRef(onStartRound);
  const timeoutCallbackRef = useRef(onTimeout);
  const giveUpCallbackRef = useRef(onGiveUp);
  const restoredRef = useRef(false);
  const lastPresentationRef = useRef("");
  startRoundRef.current = onStartRound;
  timeoutCallbackRef.current = onTimeout;
  giveUpCallbackRef.current = onGiveUp;
  const totalEditableCells = useMemo(() => givens.flat().filter((value) => value === 0).length, [givens]);
  const filledCells = useMemo(() => grid.flatMap((row, r) => row.map((value, c) => givens[r][c] === 0 && value !== 0)).filter(Boolean).length, [givens, grid]);
  const disabled = status !== "playing" || Boolean(completionError);

  const snapshot = useCallback((): SudokuSnapshot => ({
    grid: cloneSudokuGrid(grid), notes: JSON.parse(JSON.stringify(notes)) as SudokuNotes,
    hinted: [...hintedCells], locked: [...lockedCells],
  }), [grid, hintedCells, lockedCells, notes]);
  const pushHistory = useCallback(() => setHistory((current) => [...current.slice(-49), snapshot()]), [snapshot]);

  const undo = useCallback(() => {
    if (disabled || !history.length) return;
    const previous = history[history.length - 1];
    setGrid(cloneSudokuGrid(previous.grid)); setNotes(previous.notes);
    setHintedCells(new Set(previous.hinted)); setLockedCells(new Set(previous.locked));
    setHistory((current) => current.slice(0, -1)); setMessage("");
    juice.tap();
  }, [disabled, history]);

  const toggleNotes = useCallback(() => {
    if (!disabled) setNotesMode((current) => !current);
  }, [disabled]);

  const selectCell = useCallback((cell: SudokuCell) => {
    setSelectedCell(cell);
    requestAnimationFrame(() => gameRef.current?.focus({ preventScroll: true }));
  }, []);

  const enterDigit = useCallback((digit: number) => {
    if (disabled || !selectedCell || digit < 1 || digit > 9) return;
    const { row, col } = selectedCell; const key = sudokuCellKey(row, col);
    if (givens[row][col] || lockedCells.has(key)) return;
    pushHistory();
    if (notesMode && grid[row][col] === 0) {
      setNotes((current) => {
        const existing = current[key] ?? [];
        const next = existing.includes(digit) ? existing.filter((value) => value !== digit) : [...existing, digit].sort();
        const copy = { ...current }; if (next.length) copy[key] = next; else delete copy[key]; return copy;
      });
    } else {
      setGrid((current) => { const next = cloneSudokuGrid(current); next[row][col] = digit; return next; });
      setNotes((current) => { const copy = { ...current }; delete copy[key]; sudokuPeers(row, col).forEach((peer) => {
        const peerKey = sudokuCellKey(peer.row, peer.col); if (copy[peerKey]) copy[peerKey] = copy[peerKey].filter((value) => value !== digit);
      }); return copy; });
    }
    setMessage(""); juice.tap();
  }, [disabled, givens, grid, lockedCells, notesMode, pushHistory, selectedCell]);

  const erase = useCallback(() => {
    if (disabled || !selectedCell) return;
    const { row, col } = selectedCell; const key = sudokuCellKey(row, col);
    if (givens[row][col] || lockedCells.has(key) || (!grid[row][col] && !(notes[key]?.length))) return;
    pushHistory(); setGrid((current) => { const next = cloneSudokuGrid(current); next[row][col] = 0; return next; });
    setNotes((current) => { const copy = { ...current }; delete copy[key]; return copy; }); setMessage(""); juice.tap();
  }, [disabled, givens, grid, lockedCells, notes, pushHistory, selectedCell]);

  const revealHint = useCallback(async () => {
    if (disabled || hintPendingRef.current || !safeSolution) return;
    if (hintTokens < 1) { setMessage("You need a hint token to reveal a cell."); return; }
    const candidates: SudokuCell[] = [];
    for (let row = 0; row < 9; row += 1) for (let col = 0; col < 9; col += 1) {
      if (!givens[row][col] && grid[row][col] !== safeSolution[row][col] && !lockedCells.has(sudokuCellKey(row, col))) candidates.push({ row, col });
    }
    if (!candidates.length) return;
    hintPendingRef.current = true;
    try {
      if (onHintUsed && !(await onHintUsed())) { setMessage("The hint could not be used. Please try again."); return; }
      const cell = selectedCell && candidates.some((candidate) => candidate.row === selectedCell.row && candidate.col === selectedCell.col) ? selectedCell : candidates[0];
      // A consumed token cannot be refunded by local Undo, so the reveal is
      // deliberately not added to the reversible edit history.
      const key = sudokuCellKey(cell.row, cell.col); const digit = safeSolution[cell.row][cell.col];
      setGrid((current) => { const next = cloneSudokuGrid(current); next[cell.row][cell.col] = digit; return next; });
      setNotes((current) => { const copy = { ...current }; delete copy[key]; sudokuPeers(cell.row, cell.col).forEach((peer) => {
        const peerKey = sudokuCellKey(peer.row, peer.col); if (copy[peerKey]) copy[peerKey] = copy[peerKey].filter((value) => value !== digit);
      }); return copy; });
      setHintedCells((current) => new Set(current).add(key)); setLockedCells((current) => new Set(current).add(key)); selectCell(cell); setMessage("Hint revealed and locked.");
    } finally { hintPendingRef.current = false; }
  }, [disabled, givens, grid, hintTokens, lockedCells, onHintUsed, safeSolution, selectCell, selectedCell]);

  const finishCelebration = useCallback(() => {
    setCelebrating(true); juice.success();
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) confetti({ particleCount: 120, spread: 70, origin: { y: 0.62 } });
    window.setTimeout(() => { setCelebrating(false); onCelebrationComplete?.(); }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1500);
  }, [onCelebrationComplete]);

  const completionElapsedSeconds = useCallback(() => {
    const startMs = startedAt ? Date.parse(startedAt) : Number.NaN;
    const elapsedMs = Number.isFinite(startMs) ? Date.now() - startMs : mode === "daily" ? timeMs : 0;
    return Math.max(0, Math.round((Number.isFinite(elapsedMs) ? elapsedMs : 0) / 1000));
  }, [mode, startedAt, timeMs]);

  const submitCompletion = useCallback(async () => {
    if (completionRef.current) return;
    completionRef.current = true; setCompletionError(""); setStatus("validating"); setMessage("Checking puzzle…");
    try {
      const result = await onComplete(cloneSudokuGrid(grid), completionElapsedSeconds());
      if (!result.success) throw new Error(result.error || "Completion was not confirmed.");
      localStorage.removeItem(storageKey(puzzleId)); setStatus("won"); setMessage("Puzzle solved!"); finishCelebration();
    } catch (error) {
      completionRef.current = false; setStatus("error");
      const detail = error instanceof Error ? error.message : "Completion failed. Retry submission.";
      setCompletionError(detail); setMessage(detail);
    }
  }, [completionElapsedSeconds, finishCelebration, grid, onComplete, puzzleId]);

  const checkPuzzle = useCallback(async () => {
    if (disabled || completionRef.current) return;
    if (!isSudokuComplete(grid)) { setMessage("Fill every cell before checking the puzzle."); return; }
    setStatus("validating"); setMessage("Checking puzzle…");
    const locallyCorrect = safeSolution ? sameGrid(grid, safeSolution) : findSudokuConflicts(grid).size === 0;
    if (!locallyCorrect) {
      if (mode === "daily") { setStatus("playing"); setMessage("Not quite yet. Check the highlighted rule conflicts and try again."); juice.error(); return; }
      try {
        const result = await onIncorrectAttempt?.(cloneSudokuGrid(grid));
        const nextAttempts = result?.attemptsUsed ?? attemptsUsed + 1; setAttemptsUsed((current) => Math.max(current, nextAttempts));
        if (nextAttempts >= attemptsAllowed) { setLockReason("max_attempts"); setStatus("lost"); localStorage.removeItem(storageKey(puzzleId)); }
        else { setStatus("playing"); setMessage(result?.error || `That solution is incorrect. ${attemptsAllowed - nextAttempts} attempts left.`); }
      } catch (error) { setStatus("playing"); setMessage(error instanceof Error ? error.message : "We could not record that check. Please try again."); }
      juice.error(); return;
    }
    await submitCompletion();
  }, [attemptsAllowed, attemptsUsed, disabled, grid, mode, onIncorrectAttempt, puzzleId, safeSolution, submitCompletion]);

  const retrySubmission = useCallback(() => { if (completionError && !completionRef.current) void submitCompletion(); }, [completionError, submitCompletion]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (helpOpen || giveUpOpen || event.key === "Tab") return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); undo(); return; }
    if (/^[1-9]$/.test(event.key)) { event.preventDefault(); enterDigit(Number(event.key)); return; }
    if (["Backspace", "Delete", "0"].includes(event.key)) { event.preventDefault(); erase(); return; }
    if (event.key.toLowerCase() === "n") { event.preventDefault(); toggleNotes(); return; }
    if (event.key === "Enter" && isSudokuComplete(grid)) { event.preventDefault(); void checkPuzzle(); return; }
    const delta: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (delta[event.key]) { event.preventDefault(); const [dr, dc] = delta[event.key]; const current = selectedCell ?? { row: 0, col: 0 };
      selectCell({ row: Math.max(0, Math.min(8, current.row + dr)), col: Math.max(0, Math.min(8, current.col + dc)) }); }
  }, [checkPuzzle, enterDigit, erase, giveUpOpen, grid, helpOpen, selectCell, selectedCell, toggleNotes, undo]);

  useImperativeHandle(ref, () => ({
    openInstructions: () => setHelpOpen(true), focusGame: () => gameRef.current?.focus({ preventScroll: true }),
    toggleNotes, undo, requestGiveUp: () => setGiveUpOpen(true),
  }), [toggleNotes, undo]);

  useEffect(() => {
    if (restoredRef.current) return; restoredRef.current = true;
    try {
      const raw = localStorage.getItem(storageKey(puzzleId)); if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>; const restoredGrid = restoreSudokuGrid(parsed.grid, givens);
      if (!restoredGrid) { localStorage.removeItem(storageKey(puzzleId)); return; }
      setGrid(restoredGrid); setNotes(normalizeSudokuNotes(parsed.notes));
      const selected = parsed.selectedCell as SudokuCell | undefined;
      if (selected && Number.isInteger(selected.row) && Number.isInteger(selected.col) && selected.row >= 0 && selected.row < 9 && selected.col >= 0 && selected.col < 9) setSelectedCell(selected);
      setNotesMode(Boolean(parsed.notesMode));
      setHintedCells(new Set(Array.isArray(parsed.hintedCells) ? parsed.hintedCells.filter((key): key is string => typeof key === "string" && /^([0-8])-([0-8])$/.test(key)) : []));
      setLockedCells(new Set(Array.isArray(parsed.lockedCells) ? parsed.lockedCells.filter((key): key is string => typeof key === "string" && /^([0-8])-([0-8])$/.test(key)) : []));
    } catch { localStorage.removeItem(storageKey(puzzleId)); }
  }, [givens, puzzleId]);

  useEffect(() => {
    if (!restoredRef.current || status === "won" || status === "lost") return;
    localStorage.setItem(storageKey(puzzleId), JSON.stringify({ version: 2, grid, notes, selectedCell, notesMode, hintedCells: [...hintedCells], lockedCells: [...lockedCells], started: status !== "ready" }));
  }, [grid, hintedCells, lockedCells, notes, notesMode, puzzleId, selectedCell, status]);

  const applyRound = useCallback((round: SudokuRoundState) => {
    const roundStartedAt = round.startedAt ?? null; const roundExpiresAt = round.expiresAt ?? null;
    if (round.lockedAt) {
      setStartedAt(roundStartedAt); setExpiresAt(roundExpiresAt); setLockReason(round.lockReason ?? "locked");
      setAttemptsUsed((current) => Math.max(current, round.attemptsUsed ?? 0)); setTimeoutCommitted(true); setStatus("lost"); return;
    }
    if (!roundStartedAt || !roundExpiresAt || !Number.isFinite(Date.parse(roundStartedAt)) || !Number.isFinite(Date.parse(roundExpiresAt))) {
      throw new Error("The server did not return a valid Sudoku timer.");
    }
    setStartedAt(roundStartedAt); setExpiresAt(roundExpiresAt); setAttemptsUsed(round.attemptsUsed ?? 0);
    setLockReason(null); setStartError(""); setTimeoutError(""); setTimeoutCommitted(false); timeoutRef.current = false; setStatus("playing");
  }, []);

  const beginRound = useCallback(async () => {
    if (!startRoundRef.current) { setStartError("The timed round cannot be started right now."); setStatus("error"); return; }
    setStartError(""); setStatus("starting");
    try { applyRound(await startRoundRef.current()); }
    catch (error) {
      const detail = error instanceof Error ? error.message : "Could not start the timed round. Try again.";
      setStartError(detail); setMessage(detail); setStatus("error");
    }
  }, [applyRound]);

  useEffect(() => {
    setAttemptsUsed((current) => Math.max(current, attemptsUsedProp));
    if (mode !== "catalog") return;
    if (serverLockedAt) {
      setStartedAt(serverStartedAt); setExpiresAt(serverExpiresAt); setLockReason(serverLockReason ?? "locked");
      setTimeoutCommitted(true); setStatus("lost"); return;
    }
    if (serverExpiresAt && Number.isFinite(Date.parse(serverExpiresAt))) {
      if (serverStartedAt && Number.isFinite(Date.parse(serverStartedAt))) setStartedAt(serverStartedAt);
      setExpiresAt(serverExpiresAt); setStartError("");
      timeoutRef.current = false; setStatus((current) => current === "won" || current === "lost" ? current : "playing");
    }
  }, [attemptsUsedProp, mode, serverExpiresAt, serverLockedAt, serverLockReason, serverStartedAt]);

  useEffect(() => {
    if (mode !== "catalog" || serverLockedAt || serverExpiresAt) return;
    const timer = window.setTimeout(() => { if (!startedAt && !expiresAt) void beginRound(); }, 0);
    return () => window.clearTimeout(timer);
  }, [beginRound, expiresAt, mode, serverExpiresAt, serverLockedAt, startedAt]);

  const commitTimeout = useCallback(() => {
    if (timeoutCommitRef.current) return timeoutCommitRef.current;
    setTimeoutPending(true); setTimeoutError("");
    const request = (async () => {
      try { await timeoutCallbackRef.current?.(); setTimeoutCommitted(true); }
      catch (error) { setTimeoutCommitted(false); setTimeoutError(error instanceof Error ? error.message : "Could not confirm the timeout. Try again."); }
      finally { setTimeoutPending(false); timeoutCommitRef.current = null; }
    })();
    timeoutCommitRef.current = request; return request;
  }, []);

  const updateTime = useCallback(() => {
    if (status !== "playing" && status !== "validating") return;
    if (mode === "daily") { setTimeMs(startedAt ? Math.max(0, Date.now() - Date.parse(startedAt)) : 0); return; }
    const remaining = expiresAt ? Math.max(0, Date.parse(expiresAt) - Date.now()) : 0; setTimeMs(remaining);
    if (expiresAt && remaining <= 0 && !timeoutRef.current) {
      timeoutRef.current = true; setLockReason("time_limit"); setStatus("lost"); localStorage.removeItem(storageKey(puzzleId)); void commitTimeout();
    }
  }, [commitTimeout, expiresAt, mode, puzzleId, startedAt, status]);

  useEffect(() => {
    if (mode === "daily" && !startedAt) setStartedAt(new Date().toISOString());
    updateTime(); const timer = window.setInterval(updateTime, 250);
    const onVisibility = () => { if (document.visibilityState === "visible") updateTime(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, [mode, startedAt, updateTime]);

  const presentation = useMemo<SudokuPresentationState>(() => ({
    status, timeMode: mode === "daily" ? "elapsed" : "remaining", timeMs: Math.floor(timeMs / 1000) * 1000,
    attemptsUsed, attemptsAllowed, attemptsLeft: Math.max(0, attemptsAllowed - attemptsUsed), filledCells,
    totalEditableCells, notesMode, selectedCell,
  }), [attemptsAllowed, attemptsUsed, filledCells, mode, notesMode, selectedCell, status, timeMs, totalEditableCells]);
  useEffect(() => {
    const signature = JSON.stringify(presentation); if (signature === lastPresentationRef.current) return;
    lastPresentationRef.current = signature; onPresentationChange?.(presentation);
  }, [onPresentationChange, presentation]);

  const retryRound = async () => {
    if (!onRetry || timeoutPending || (lockReason === "time_limit" && !timeoutCommitted)) return;
    setStatus("starting"); setMessage(""); setStartError("");
    try {
      const round = await onRetry(); localStorage.removeItem(storageKey(puzzleId));
      setGrid(cloneSudokuGrid(givens)); setNotes({}); setSelectedCell(null); setHistory([]); setHintedCells(new Set()); setLockedCells(new Set());
      completionRef.current = false; setCompletionError(""); applyRound(round);
    } catch (error) {
      setStatus("lost"); setMessage(error instanceof Error ? error.message : "Could not start a fresh round.");
    }
  };

  const confirmGiveUp = async () => {
    if (!giveUpCallbackRef.current) throw new Error("Give Up is unavailable right now.");
    await giveUpCallbackRef.current();
    localStorage.removeItem(storageKey(puzzleId)); setGiveUpOpen(false); setLockReason("given_up"); setStatus("lost");
  };

  return (
    <div className={`sudoku-puzzle sudoku-${displayMode}`} data-status={status} data-testid="sudoku-root">
      {displayMode === "standalone" && <div className="sudoku-internal-header"><h2>SUDOKU</h2><button type="button" onClick={() => setHelpOpen(true)}>Help</button></div>}
      {startError && status === "error" && <div className="sudoku-status-card" role="alert"><p>{startError}</p><button type="button" className="sudoku-dialog-primary" onClick={() => void beginRound()}>Retry Start</button></div>}
      {status === "starting" && <div className="sudoku-status-card" role="status"><span className="sudoku-spinner" />Starting your round…</div>}
      {status === "lost" ? (
        <section className="sudoku-result-card" aria-labelledby="sudoku-loss-title">
          <span aria-hidden>⌛</span><h2 id="sudoku-loss-title">Round over</h2>
          <p>{lockReason === "max_attempts" ? "You used all available attempts." : lockReason === "given_up" ? "You gave up this round." : "The time limit expired."}</p>
          {timeoutError && <p className="sudoku-dialog-error" role="alert">{timeoutError}</p>}
          {timeoutError && <button type="button" onClick={() => void commitTimeout()} disabled={timeoutPending}>{timeoutPending ? "Confirming…" : "Retry Timeout"}</button>}
          <div><button type="button" onClick={() => void retryRound()} disabled={!onRetry || timeoutPending || (lockReason === "time_limit" && !timeoutCommitted)}>Try Again</button><Link href="/puzzles">Back to Puzzles</Link></div>
        </section>
      ) : status !== "starting" && !startError ? (
        <div ref={gameRef} className="sudoku-game-surface" data-testid="sudoku-game-surface" tabIndex={0} onKeyDown={handleKeyDown} aria-label="Sudoku game. Use arrow keys to select a cell and number keys to enter digits.">
          <div className="sudoku-board-region"><SudokuGrid puzzle={givens} givens={givens} grid={grid} notes={notes} selectedCell={selectedCell} lockedCells={lockedCells} hintedCells={hintedCells} disabled={disabled} celebrating={celebrating} onSelectCell={selectCell} /></div>
          <div className="sudoku-controls">
            <SudokuUtilityBar notesMode={notesMode} canUndo={history.length > 0} canHint={Boolean(safeSolution)} showHint={mode === "catalog"} disabled={disabled} onNotes={toggleNotes} onUndo={undo} onErase={erase} onHint={() => void revealHint()} />
            <SudokuNumberPad onDigit={enterDigit} disabled={disabled} />
            <div className="sudoku-validation-row">
              <p role="status" aria-live="polite">{message || (notesMode ? "Notes mode is on" : "Select a cell to begin")}</p>
              {completionError ? <button type="button" onClick={retrySubmission}>Retry Submission</button> : <button type="button" onClick={() => void checkPuzzle()} disabled={disabled || !isSudokuComplete(grid)}>Check Puzzle</button>}
            </div>
          </div>
        </div>
      ) : null}
      <SudokuHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <SudokuConfirmDialog
        open={giveUpOpen}
        title="Give up this round?"
        description="Your current round will end and saved board state will be cleared."
        confirmLabel="Give Up"
        onClose={() => setGiveUpOpen(false)}
        onConfirm={confirmGiveUp}
      />
    </div>
  );
});

export default SudokuPuzzle;
