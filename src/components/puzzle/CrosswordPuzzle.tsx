"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { TegakiRenderer, type TegakiBundle } from "tegaki";
import caveat from "../../../node_modules/tegaki/dist/fonts/caveat/bundle.mjs";
import { usePuzzleSkin } from "@/hooks/usePuzzleSkin";

const LavaBackground = dynamic(() => import("@/components/LavaBackground"), { ssr: false });
const GalaxyBackground = dynamic(() => import("@/components/GalaxyBackground"), { ssr: false });
const IceBackground = dynamic(() => import("@/components/IceBackground"), { ssr: false });
const NeonBackground = dynamic(() => import("@/components/NeonBackground"), { ssr: false });
const RetroBackground = dynamic(() => import("@/components/RetroBackground"), { ssr: false });
const tegakiCaveatBundle = caveat as unknown as TegakiBundle;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CrosswordClue {
  number: number;
  text: string;
  answer: string; // uppercase letters only; may be empty in public payloads
  length: number;
  row: number;    // 0-based top-left start
  col: number;
}

export interface CrosswordData {
  clues: {
    across: CrosswordClue[];
    down: CrosswordClue[];
  };
}

interface Props {
  puzzleId: string;
  crosswordData: Record<string, unknown>;
  alreadySolved?: boolean;
  hintTokens?: number;
  onHintUsed?: () => Promise<boolean>;
  onSolved?: (elapsedSeconds?: number) => void;
  warzMode?: boolean;
}

type Direction = "across" | "down";

const WORD_SOLVED_ANIMATION_MS = 1400;
const WORD_SOLVED_STAGGER_MS = 55;
const LETTER_DRAW_ANIMATION_MS = 520;
// Extra breathing room after the last word's own solve animation before the
// whole-board celebration kicks in, so the two never visually collide.
const COMPLETION_LEAD_BUFFER_MS = 260;
// How long the whole-board pulse plays (visible on the grid itself) before the
// "Crossword Complete" card overlay fades in on top of it.
const BOARD_CELEBRATION_BASE_MS = 1800;
// Per-diagonal-step delay so the pulse reads as a wave sweeping across the
// grid from the top-left corner rather than every cell flashing in unison.
const BOARD_WAVE_STAGGER_MS = 10;
const PUZZLE_COMPLETE_ANIMATION_MS = 2600;
const GRID_BORDER_PX = 2;
const GRID_PADDING_PX = 2;
const DEFAULT_PENCIL_SFX_URL = "/audio/pencil_sound.mp3";
const PENCIL_SFX_VOLUME = 0.22;
const PENCIL_SFX_COOLDOWN_MS = 48;
const DEFAULT_SUCCESS_ANSWER_SFX_URL = "/audio/success_answer.mp3";
const SUCCESS_ANSWER_SFX_VOLUME = 0.4;

interface ActiveClue {
  direction: Direction;
  number: number;
}

interface CellState {
  isBlack: boolean;
  clueNumber?: number;  // label printed in corner
  acrossNumber?: number;
  downNumber?: number;
  userLetter: string;
  correctLetter: string; // only populated for already-solved
  revealed?: boolean;    // hint-revealed
}

interface SavedCrosswordProgress {
  signature: string;
  letters: string[][];
  revealedCells: string[];
  activeClue: ActiveClue | null;
  elapsedMs: number;
  savedAt: number;
}

interface CrosswordProgressPayload {
  solvedClues?: unknown;
  letters?: unknown;
  revealedCells?: unknown;
  activeClue?: unknown;
  elapsedMs?: unknown;
  allSolved?: unknown;
  savedAt?: unknown;
}

interface LetterDrawToken {
  id: string;
  isAnimating: boolean;
  durationMs: number;
  drawStartY: number;
  drawMidY: number;
  drawStartRotate: number;
  drawMidRotate: number;
  drawStartScale: number;
  drawMidScale: number;
}

function createEmptyLetters(rows: number, cols: number): string[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(""));
}

function getCrosswordProgressSignature(data: CrosswordData | null): string {
  if (!data) return "invalid";
  const serialize = (direction: Direction, clue: CrosswordClue) =>
    `${direction}:${clue.number}:${clue.row}:${clue.col}:${clue.length}`;
  return [
    ...data.clues.across.map((clue) => serialize("across", clue)),
    ...data.clues.down.map((clue) => serialize("down", clue)),
  ].join("|");
}

function getCrosswordProgressStorageKey(puzzleId: string): string {
  return `crossword-progress:${puzzleId}`;
}

function normalizeStoredLetters(
  value: unknown,
  rows: number,
  cols: number,
  grid: CellState[][]
): string[][] | null {
  if (!Array.isArray(value) || value.length !== rows) return null;

  const normalized = createEmptyLetters(rows, cols);
  for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
    const rawRow = value[rowIndex];
    const rowValues = typeof rawRow === "string"
      ? rawRow.split("")
      : Array.isArray(rawRow)
        ? rawRow
        : null;

    if (!rowValues || rowValues.length !== cols) return null;

    for (let colIndex = 0; colIndex < cols; colIndex++) {
      const cell = grid[rowIndex]?.[colIndex];
      const rawLetter = String(rowValues[colIndex] ?? "").trim().toUpperCase();
      normalized[rowIndex][colIndex] = cell && !cell.isBlack && /^[A-Z]$/.test(rawLetter) ? rawLetter : "";
    }
  }

  return normalized;
}

function normalizeStoredCellKeys(value: unknown, rows: number, cols: number, grid: CellState[][]): string[] {
  if (!Array.isArray(value)) return [];

  const keys = new Set<string>();
  for (const rawValue of value) {
    if (typeof rawValue !== "string") continue;
    const match = /^(\d+),(\d+)$/.exec(rawValue);
    if (!match) continue;

    const row = Number(match[1]);
    const col = Number(match[2]);
    if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
    if (row < 0 || row >= rows || col < 0 || col >= cols) continue;
    if (grid[row]?.[col]?.isBlack) continue;

    keys.add(`${row},${col}`);
  }

  return [...keys];
}

function normalizeStoredActiveClue(value: unknown, data: CrosswordData | null): ActiveClue | null {
  if (!data || !value || typeof value !== "object") return null;
  const raw = value as { direction?: unknown; number?: unknown };
  const direction = raw.direction;
  const number = raw.number;
  if (direction !== "across" && direction !== "down") return null;
  if (typeof number !== "number" || !Number.isInteger(number) || number <= 0) return null;

  const clues = direction === "across" ? data.clues.across : data.clues.down;
  return clues.some((clue) => clue.number === number) ? { direction, number } : null;
}

function hasCrosswordProgress(snapshot: SavedCrosswordProgress): boolean {
  return Boolean(
    snapshot.activeClue ||
    snapshot.revealedCells.length > 0 ||
    snapshot.letters.some((row) => row.some(Boolean)) ||
    snapshot.elapsedMs > 0
  );
}

function loadLocalCrosswordProgress(
  storageKey: string,
  signature: string,
  rows: number,
  cols: number,
  grid: CellState[][],
  data: CrosswordData | null
): SavedCrosswordProgress | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.signature !== signature) {
      localStorage.removeItem(storageKey);
      return null;
    }

    const letters = normalizeStoredLetters(parsed.letters, rows, cols, grid);
    if (!letters) return null;

    const progress: SavedCrosswordProgress = {
      signature,
      letters,
      revealedCells: normalizeStoredCellKeys(parsed.revealedCells, rows, cols, grid),
      activeClue: normalizeStoredActiveClue(parsed.activeClue, data),
      elapsedMs: typeof parsed.elapsedMs === "number" && Number.isFinite(parsed.elapsedMs)
        ? Math.max(0, Math.round(parsed.elapsedMs))
        : 0,
      savedAt: typeof parsed.savedAt === "number" && Number.isFinite(parsed.savedAt) ? parsed.savedAt : 0,
    };

    return hasCrosswordProgress(progress) ? progress : null;
  } catch {
    return null;
  }
}

function normalizeSolvedClueKeys(value: unknown, data: CrosswordData | null): Set<string> {
  const solved = new Set<string>();
  if (!data || !Array.isArray(value)) return solved;

  const validKeys = new Set([
    ...data.clues.across.map((clue) => `across:${clue.number}`),
    ...data.clues.down.map((clue) => `down:${clue.number}`),
  ]);

  for (const rawKey of value) {
    if (typeof rawKey !== "string") continue;
    const colonKey = rawKey.replace("-", ":");
    if (!validKeys.has(colonKey)) continue;
    solved.add(colonKey.replace(":", "-"));
  }

  return solved;
}

function buildSavedCrosswordProgress(
  signature: string,
  letters: string[][],
  revealed: Set<string>,
  activeClue: ActiveClue | null,
  elapsedMs: number
): SavedCrosswordProgress {
  return {
    signature,
    letters: letters.map((row) => row.map((letter) => letter || "")),
    revealedCells: [...revealed],
    activeClue,
    elapsedMs: Math.max(0, Math.round(elapsedMs)),
    savedAt: Date.now(),
  };
}

function formatElapsedStopwatch(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// ─── Grid builder ─────────────────────────────────────────────────────────────

function buildGrid(data: CrosswordData): { grid: CellState[][]; rows: number; cols: number } {
  const allClues = [...data.clues.across, ...data.clues.down];
  let maxRow = 0;
  let maxCol = 0;

  for (const clue of data.clues.across) {
    const endCol = clue.col + clue.length - 1;
    maxRow = Math.max(maxRow, clue.row);
    maxCol = Math.max(maxCol, endCol);
  }
  for (const clue of data.clues.down) {
    const endRow = clue.row + clue.length - 1;
    maxRow = Math.max(maxRow, endRow);
    maxCol = Math.max(maxCol, clue.col);
  }

  const rows = maxRow + 1;
  const cols = maxCol + 1;

  // Start as all-black
  const grid: CellState[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      isBlack: true,
      userLetter: "",
      correctLetter: "",
    }))
  );

  // Fill white cells from clues
  for (const clue of data.clues.across) {
    for (let i = 0; i < clue.length; i++) {
      const cell = grid[clue.row][clue.col + i];
      cell.isBlack = false;
      cell.acrossNumber = clue.number;
    }
  }
  for (const clue of data.clues.down) {
    for (let i = 0; i < clue.length; i++) {
      const cell = grid[clue.row + i][clue.col];
      cell.isBlack = false;
      cell.downNumber = clue.number;
    }
  }

  // Assign clue-number labels (top-left of each numbered word start)
  const numbered = new Set<string>();
  for (const clue of allClues) {
    const key = `${clue.row},${clue.col}`;
    if (!numbered.has(key)) {
      numbered.add(key);
      grid[clue.row][clue.col].clueNumber = clue.number;
    }
  }

  return { grid, rows, cols };
}

// ─── Cell sizing ──────────────────────────────────────────────────────────────

function getGridGap(cols: number): number {
  return cols >= 19 ? 0 : 1;
}

function getGridChrome(trackCount: number, gap: number): number {
  return (GRID_BORDER_PX * 2) + (GRID_PADDING_PX * 2) + Math.max(0, trackCount - 1) * gap;
}

function getGridOuterChrome(cols: number): number {
  return getGridChrome(cols, getGridGap(cols));
}

function getGridPixelWidth(cols: number, cellSize: number): number {
  if (cols <= 0) return 0;
  return cols * cellSize + getGridOuterChrome(cols);
}

function getInitialCellSize(cols: number): number {
  if (cols <= 0) return 32;
  const phoneWidth = 336;
  const cellBudget = Math.floor((phoneWidth - getGridOuterChrome(cols)) / cols);
  return Math.max(8, Math.min(36, cellBudget));
}

function useCellSize(
  containerRef: React.RefObject<HTMLDivElement | null>,
  cols: number,
  rows: number
): number {
  const [size, setSize] = useState(() => getInitialCellSize(cols));

  useEffect(() => {
    const update = () => {
      if (cols <= 0) return;
      if (!containerRef.current) return;

      const availableWidth = Math.max(120, containerRef.current.clientWidth);
      const gridGap = getGridGap(cols);
      const chromeWidth = getGridChrome(cols, gridGap);
      const byWidth = Math.floor((availableWidth - chromeWidth) / cols);

      const isMobileWidth = typeof window !== "undefined" && window.innerWidth < 768;
      const heightBudget = typeof window !== "undefined" && isMobileWidth
        ? Math.max(260, window.innerHeight * 0.58)
        : Number.POSITIVE_INFINITY;
      const byHeight = rows > 0 && Number.isFinite(heightBudget)
        ? Math.floor((heightBudget - getGridChrome(rows, gridGap)) / rows)
        : Number.POSITIVE_INFINITY;

      const maxCellSize = isMobileWidth ? 36 : 52;
      const fittedCellSize = Math.min(maxCellSize, byWidth, byHeight);
      setSize(Math.max(5, fittedCellSize));
    };

    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [containerRef, cols, rows]);

  return size;
}

// ─── Clue word cells helper ────────────────────────────────────────────────────

function getWordCells(
  grid: CellState[][],
  row: number,
  col: number,
  direction: Direction
): { row: number; col: number }[] {
  const cells: { row: number; col: number }[] = [];
  if (direction === "across") {
    // find start
    let c = col;
    while (c > 0 && !grid[row][c - 1].isBlack) c--;
    while (c < grid[0].length && !grid[row][c].isBlack) {
      cells.push({ row, col: c });
      c++;
    }
  } else {
    let r = row;
    while (r > 0 && !grid[r - 1][col].isBlack) r--;
    while (r < grid.length && !grid[r][col].isBlack) {
      cells.push({ row: r, col });
      r++;
    }
  }
  return cells;
}

// ─── Instructions modal ───────────────────────────────────────────────────────

function InstructionsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4"
      onClick={onClose}
    >
      <div
        className="max-w-md w-full rounded-xl p-6 shadow-2xl"
        style={{ background: "#0f0f1a", border: "1px solid rgba(255,255,255,0.12)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-extrabold" style={{ color: "#FDE74C" }}>How to Play — Crossword</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none ml-4">✕</button>
        </div>
        <div className="space-y-3 text-sm text-gray-300">
          <p><strong className="text-white">Click a white cell</strong> to select it. Click again to toggle between Across and Down.</p>
          <p>The <strong className="text-white">active clue</strong> is highlighted in blue. Type letters to fill in the cells.</p>
          <p>Press <strong className="text-white">Backspace</strong> to erase the previous letter. Press <strong className="text-white">Tab</strong> or <strong className="text-white">Enter</strong> to jump to the next clue.</p>
          <p>When you complete a word correctly it <strong className="text-white" style={{ color: "#38D399" }}>turns green</strong>. Solve every word to finish the puzzle.</p>
          <p><strong className="text-white">Hint tokens</strong> reveal a letter in the selected cell.</p>
        </div>
        <button
          onClick={onClose}
          className="mt-6 w-full py-3 rounded-xl font-black text-lg tracking-widest transition-all duration-150 active:scale-95"
          style={{ background: "linear-gradient(135deg, #10b981, #38D399)", color: "#020202" }}
        >
          START ⚡
        </button>
      </div>
    </div>
  );
}

function CrosswordCompletionOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 flex items-center justify-center px-4"
      style={{ zIndex: 2147483647, background: "rgba(2,6,23,0.78)", backdropFilter: "blur(6px)" }}
    >
      <div style={{ position: "relative", width: "min(560px, 94vw)", minHeight: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="crossword-completion-ring" style={{ position: "absolute", inset: 4, border: "2px solid rgba(74,222,128,0.56)", borderRadius: 16 }} />
        <div className="crossword-completion-ring" style={{ position: "absolute", inset: 34, border: "1px solid rgba(253,231,76,0.36)", borderRadius: 14, animationDelay: "220ms" }} />
        <div
          className="crossword-completion-card"
          style={{
            position: "relative",
            width: "100%",
            padding: "28px 30px",
            borderRadius: 14,
            background: "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(6,78,59,0.94))",
            border: "2px solid rgba(134,239,172,0.9)",
            boxShadow: "0 26px 90px rgba(0,0,0,0.65), 0 0 54px rgba(34,197,94,0.42)",
            textAlign: "center",
            opacity: 1,
          }}
        >
          <div style={{ color: "#bbf7d0", fontWeight: 900, fontSize: "0.72rem", letterSpacing: "0.22em", textTransform: "uppercase" }}>Puzzle Solved</div>
          <div style={{ color: "#f8fafc", fontWeight: 900, fontSize: "clamp(1.7rem, 6vw, 3.1rem)", letterSpacing: 0, lineHeight: 1.05, marginTop: 7 }}>Crossword Complete</div>
          <div style={{ color: "#d1fae5", fontSize: "0.95rem", fontWeight: 800, marginTop: 12, letterSpacing: 0 }}>Preparing your XP and points</div>
          <div style={{ height: 6, marginTop: 20, borderRadius: 999, background: "rgba(255,255,255,0.16)", overflow: "hidden" }}>
            <div className="crossword-completion-bar" style={{ height: "100%", width: "100%", borderRadius: 999, background: "linear-gradient(90deg, #38d399, #fde74c)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CrosswordPuzzle({
  puzzleId,
  crosswordData,
  alreadySolved = false,
  hintTokens = 0,
  onHintUsed,
  onSolved,
  warzMode = false,
}: Props) {
  const skin = usePuzzleSkin();

  // Parse + validate incoming data
  const data = useMemo<CrosswordData | null>(() => {
    try {
      const raw = crosswordData as {
        clues?: {
          across?: Array<Partial<CrosswordClue>>;
          down?: Array<Partial<CrosswordClue>>;
        };
      };

      if (!Array.isArray(raw.clues?.across) || !Array.isArray(raw.clues?.down)) return null;

      const normalizeClue = (clue: Partial<CrosswordClue>): CrosswordClue | null => {
        const number = Number(clue.number);
        const row = Number(clue.row);
        const col = Number(clue.col);
        const text = String(clue.text ?? "").trim();
        const answer = String(clue.answer ?? "")
          .toUpperCase()
          .replace(/[^A-Z]/g, "");

        const rawLength = Number(clue.length);
        const length =
          Number.isInteger(rawLength) && rawLength > 0
            ? rawLength
            : answer.length;

        if (!Number.isInteger(number) || number <= 0) return null;
        if (!Number.isInteger(row) || row < 0) return null;
        if (!Number.isInteger(col) || col < 0) return null;
        if (!text) return null;
        if (!Number.isInteger(length) || length < 3) return null;

        return {
          number,
          text,
          answer,
          length,
          row,
          col,
        };
      };

      const across = raw.clues.across
        .map(normalizeClue)
        .filter((c): c is CrosswordClue => c != null);
      const down = raw.clues.down
        .map(normalizeClue)
        .filter((c): c is CrosswordClue => c != null);

      if (across.length !== raw.clues.across.length) return null;
      if (down.length !== raw.clues.down.length) return null;

      return {
        clues: {
          across,
          down,
        },
      };
    } catch {
      return null;
    }
  }, [crosswordData]);

  const { grid: initialGrid, rows, cols } = useMemo(
    () => (data ? buildGrid(data) : { grid: [], rows: 0, cols: 0 }),
    [data]
  );
  const progressSignature = useMemo(() => getCrosswordProgressSignature(data), [data]);
  const progressStorageKey = useMemo(() => getCrosswordProgressStorageKey(puzzleId), [puzzleId]);
  const localProgressRef = useRef<SavedCrosswordProgress | null>(null);
  const localProgressLoadedRef = useRef(false);

  if (!localProgressLoadedRef.current && !alreadySolved && data && initialGrid.length > 0) {
    localProgressLoadedRef.current = true;
    localProgressRef.current = loadLocalCrosswordProgress(
      progressStorageKey,
      progressSignature,
      rows,
      cols,
      initialGrid,
      data
    );
  }

  // Mutable cell letters stored in state
  const [letters, setLetters] = useState<string[][]>(() =>
    alreadySolved ? createEmptyLetters(rows, cols) : localProgressRef.current?.letters ?? createEmptyLetters(rows, cols)
  );
  // Track which clues are correctly solved
  const [solvedClues, setSolvedClues] = useState<Set<string>>(() => {
    if (alreadySolved && data) {
      const all = new Set<string>();
      data.clues.across.forEach((c) => all.add(`across-${c.number}`));
      data.clues.down.forEach((c) => all.add(`down-${c.number}`));
      return all;
    }
    return new Set();
  });
  const solvedCluesRef = useRef<Set<string>>(solvedClues);
  // Hint-revealed cells
  const [revealed, setRevealed] = useState<Set<string>>(() =>
    alreadySolved ? new Set() : new Set(localProgressRef.current?.revealedCells ?? [])
  );

  const [activeClue, setActiveClue] = useState<ActiveClue | null>(() =>
    alreadySolved ? null : localProgressRef.current?.activeClue ?? null
  );
  const [elapsedMs, setElapsedMs] = useState<number>(() =>
    alreadySolved ? 0 : Math.max(0, localProgressRef.current?.elapsedMs ?? 0)
  );
  const [cluePanelDirection, setCluePanelDirection] = useState<Direction>("across");
  const [gameStatus, setGameStatus] = useState<"playing" | "won">(
    alreadySolved ? "won" : "playing"
  );
  const [showInstructions, setShowInstructions] = useState(!alreadySolved && !localProgressRef.current);
  const [hintLoading, setHintLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [justSolvedClues, setJustSolvedClues] = useState<Set<string>>(new Set());
  const [latestSolvedClue, setLatestSolvedClue] = useState<ActiveClue | null>(null);
  const [letterDrawTokens, setLetterDrawTokens] = useState<Record<string, LetterDrawToken>>({});
  const [completionAnimating, setCompletionAnimating] = useState(false);
  const [boardCelebrating, setBoardCelebrating] = useState(false);
  const [showRestoreNotice, setShowRestoreNotice] = useState(() =>
    !alreadySolved && Boolean(localProgressRef.current)
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const cellSize = useCellSize(containerRef, cols, rows);
  const gridGap = getGridGap(cols);
  const gridPixelWidth = getGridPixelWidth(cols, cellSize);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const checkingCluesRef = useRef<Map<string, string>>(new Map());
  const checkQueueRef = useRef<Promise<void>>(Promise.resolve());
  const solvedAnimationTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const letterDrawTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preCompletionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boardCelebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoreNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set the instant ANY path (live completion or hydrate discovering a
  // pre-existing solve) determines the puzzle is done, so the two can't race
  // and double-fire onSolved. Separate from animationStartedRef below, which
  // only guards startCompletionAnimation's own re-entrancy.
  const completionNotifiedRef = useRef(false);
  const animationStartedRef = useRef(false);
  const lettersRef = useRef<string[][]>(letters);
  const revealedRef = useRef<Set<string>>(revealed);
  const activeClueRef = useRef<ActiveClue | null>(activeClue);
  const elapsedMsRef = useRef<number>(elapsedMs);
  const timerAnchorRef = useRef<number | null>(null);
  const onSolvedRef = useRef<Props["onSolved"]>(onSolved);
  const pencilAudioContextRef = useRef<AudioContext | null>(null);
  const lastPencilSfxAtRef = useRef(0);
  const lastPencilSfxClueKeyRef = useRef<string | null>(null);
  const lastSavedPayloadRef = useRef<string>("");

  const showRestoredProgressBanner = useCallback(() => {
    if (restoreNoticeTimerRef.current) clearTimeout(restoreNoticeTimerRef.current);
    setShowRestoreNotice(true);
    restoreNoticeTimerRef.current = setTimeout(() => {
      setShowRestoreNotice(false);
      restoreNoticeTimerRef.current = null;
    }, 2600);
  }, []);

  const isPencilSfxEnabled = useCallback(() => {
    if (typeof window === "undefined") return false;

    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
      const userPrefsRaw = window.localStorage.getItem("userPreferences");
      if (userPrefsRaw) {
        const prefs = JSON.parse(userPrefsRaw) as { reduceAnimations?: boolean };
        if (prefs?.reduceAnimations) return false;
      }

      // Optional user override for crossword SFX.
      if (window.localStorage.getItem("crosswordSoundEffectsEnabled") === "false") return false;
    } catch {
      // Fall through to enabled.
    }

    return true;
  }, []);

  const getPencilSfxUrl = useCallback(() => {
    if (typeof window === "undefined") return DEFAULT_PENCIL_SFX_URL;

    try {
      const customUrl = window.localStorage.getItem("crosswordPencilSfxUrl");
      if (typeof customUrl === "string" && customUrl.trim()) return customUrl.trim();
    } catch {
      // Fall back to default path.
    }

    return DEFAULT_PENCIL_SFX_URL;
  }, []);

  const playProceduralPencilSfx = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = pencilAudioContextRef.current ?? new AudioCtx();
      pencilAudioContextRef.current = ctx;
      if (ctx.state === "suspended") {
        void ctx.resume().catch(() => {
          // Ignore resume failures.
        });
      }

      const now = ctx.currentTime;
      const duration = 0.055 + Math.random() * 0.045;
      const sampleRate = ctx.sampleRate;
      const length = Math.max(1, Math.floor(sampleRate * duration));
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const channel = buffer.getChannelData(0);

      for (let i = 0; i < length; i++) {
        const t = i / length;
        const envelope = 1 - t * 0.55;
        channel[i] = (Math.random() * 2 - 1) * envelope;
      }

      const src = ctx.createBufferSource();
      src.buffer = buffer;

      const highpass = ctx.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.setValueAtTime(560 + Math.random() * 240, now);

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = "bandpass";
      bandpass.frequency.setValueAtTime(1680 + Math.random() * 820, now);
      bandpass.Q.setValueAtTime(0.72 + Math.random() * 0.4, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.03, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      src.connect(highpass);
      highpass.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(ctx.destination);

      src.start(now);
      src.stop(now + duration + 0.01);
    } catch {
      // Ignore Web Audio failures.
    }
  }, []);

  const playPencilWriteSfx = useCallback(() => {
    if (!isPencilSfxEnabled()) return;

    const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (nowMs - lastPencilSfxAtRef.current < PENCIL_SFX_COOLDOWN_MS) return;
    lastPencilSfxAtRef.current = nowMs;

    const soundUrl = getPencilSfxUrl();
    if (!soundUrl) {
      playProceduralPencilSfx();
      return;
    }

    try {
      const clip = new Audio(soundUrl);
      clip.preload = "auto";
      clip.volume = PENCIL_SFX_VOLUME;
      void clip.play().catch(() => {
        // Fall back if custom file is missing/blocked.
        playProceduralPencilSfx();
      });
    } catch {
      playProceduralPencilSfx();
    }
  }, [getPencilSfxUrl, isPencilSfxEnabled, playProceduralPencilSfx]);

  const playSuccessAnswerSfx = useCallback(() => {
    if (!isPencilSfxEnabled()) return;

    try {
      const clip = new Audio(DEFAULT_SUCCESS_ANSWER_SFX_URL);
      clip.preload = "auto";
      clip.volume = SUCCESS_ANSWER_SFX_VOLUME;
      void clip.play().catch(() => {
        // Ignore playback failures.
      });
    } catch {
      // Ignore playback failures.
    }
  }, [isPencilSfxEnabled]);

  useEffect(() => {
    solvedCluesRef.current = solvedClues;
  }, [solvedClues]);

  useEffect(() => {
    lettersRef.current = letters;
  }, [letters]);

  useEffect(() => {
    revealedRef.current = revealed;
  }, [revealed]);

  useEffect(() => {
    activeClueRef.current = activeClue;
  }, [activeClue]);

  useEffect(() => {
    const clueKey = activeClue ? `${activeClue.direction}-${activeClue.number}` : null;
    if (clueKey && clueKey !== lastPencilSfxClueKeyRef.current) {
      // Ensure the first typed letter in a newly selected word is not skipped by SFX cooldown.
      lastPencilSfxAtRef.current = Number.NEGATIVE_INFINITY;
    }
    lastPencilSfxClueKeyRef.current = clueKey;
  }, [activeClue]);

  useEffect(() => {
    onSolvedRef.current = onSolved;
  }, [onSolved]);

  useEffect(() => {
    elapsedMsRef.current = elapsedMs;
  }, [elapsedMs]);

  useEffect(() => {
    if (alreadySolved || warzMode || gameStatus !== "playing") {
      timerAnchorRef.current = null;
      return;
    }

    timerAnchorRef.current = Date.now();
    const timer = setInterval(() => {
      const anchor = timerAnchorRef.current;
      if (!anchor) return;

      const now = Date.now();
      const delta = Math.max(0, now - anchor);
      timerAnchorRef.current = now;

      if (delta > 0) {
        setElapsedMs((prev) => prev + delta);
      }
    }, 1000);

    return () => {
      clearInterval(timer);
      timerAnchorRef.current = null;
    };
  }, [alreadySolved, warzMode, gameStatus]);

  const getElapsedSnapshotMs = useCallback(() => {
    const base = elapsedMsRef.current;
    if (gameStatus !== "playing") return base;

    const anchor = timerAnchorRef.current;
    if (!anchor) return base;

    return base + Math.max(0, Date.now() - anchor);
  }, [gameStatus]);

  useEffect(() => {
    if (activeClue) setCluePanelDirection(activeClue.direction);
  }, [activeClue]);

  useEffect(() => {
    if (localProgressRef.current) showRestoredProgressBanner();
  }, [showRestoredProgressBanner]);

  useEffect(() => {
    return () => {
      solvedAnimationTimersRef.current.forEach((timer) => clearTimeout(timer));
      letterDrawTimersRef.current.forEach((timer) => clearTimeout(timer));
      if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
      if (preCompletionTimerRef.current) clearTimeout(preCompletionTimerRef.current);
      if (boardCelebrationTimerRef.current) clearTimeout(boardCelebrationTimerRef.current);
      if (restoreNoticeTimerRef.current) clearTimeout(restoreNoticeTimerRef.current);
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      if (pencilAudioContextRef.current) {
        void pencilAudioContextRef.current.close().catch(() => {
          // Ignore close failures.
        });
        pencilAudioContextRef.current = null;
      }
    };
  }, []);

  // Pre-fill correct letters when already solved
  useEffect(() => {
    if (alreadySolved && data) {
      const filled = Array.from({ length: rows }, () => Array(cols).fill(""));
      data.clues.across.forEach((clue) => {
        for (let i = 0; i < clue.answer.length; i++) {
          filled[clue.row][clue.col + i] = clue.answer[i];
        }
      });
      data.clues.down.forEach((clue) => {
        for (let i = 0; i < clue.answer.length; i++) {
          filled[clue.row + i][clue.col] = clue.answer[i];
        }
      });
      setLetters(filled);
    }
  }, [alreadySolved, data, rows, cols]);

  useEffect(() => {
    if (!data || !alreadySolved) return;

    const all = new Set<string>();
    data.clues.across.forEach((c) => all.add(`across-${c.number}`));
    data.clues.down.forEach((c) => all.add(`down-${c.number}`));

    setSolvedClues(all);
    setGameStatus("won");
    setShowInstructions(false);
  }, [alreadySolved, data]);

  useEffect(() => {
    if (alreadySolved || warzMode || !data || !initialGrid.length) return;

    let cancelled = false;

    const hydrateProgress = async () => {
      try {
        const response = await fetch(`/api/puzzles/${puzzleId}/crossword`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) return;

        const payload = (await response.json()) as CrosswordProgressPayload;
        if (cancelled) return;

        const serverSolved = normalizeSolvedClueKeys(payload.solvedClues, data);
        const hasNewSolved = [...serverSolved].some((key) => !solvedCluesRef.current.has(key));
        const savedAt = typeof payload.savedAt === "number" && Number.isFinite(payload.savedAt)
          ? payload.savedAt
          : 0;
        const serverElapsedMs = typeof payload.elapsedMs === "number" && Number.isFinite(payload.elapsedMs)
          ? Math.max(0, Math.round(payload.elapsedMs))
          : 0;
        const serverLetters = normalizeStoredLetters(payload.letters, rows, cols, initialGrid);
        const serverRevealed = normalizeStoredCellKeys(payload.revealedCells, rows, cols, initialGrid);
        const serverActiveClue = normalizeStoredActiveClue(payload.activeClue, data);
        const serverSnapshot = serverLetters
          ? {
              signature: progressSignature,
              letters: serverLetters,
              revealedCells: serverRevealed,
              activeClue: serverActiveClue,
              elapsedMs: serverElapsedMs,
              savedAt,
            }
          : null;
        const shouldUseServerSnapshot = Boolean(
          serverSnapshot &&
          hasCrosswordProgress(serverSnapshot) &&
          savedAt >= (localProgressRef.current?.savedAt ?? 0)
        );

        if (serverSolved.size > 0) {
          const nextSolved = new Set([...solvedCluesRef.current, ...serverSolved]);
          solvedCluesRef.current = nextSolved;
          setSolvedClues(nextSolved);
        }

        if (shouldUseServerSnapshot && serverSnapshot) {
          localProgressRef.current = serverSnapshot;
          lastSavedPayloadRef.current = JSON.stringify({
            letters: serverSnapshot.letters,
            revealedCells: serverSnapshot.revealedCells,
            activeClue: serverSnapshot.activeClue,
            elapsedMs: serverSnapshot.elapsedMs,
          });
          setLetters(serverSnapshot.letters);
          setRevealed(new Set(serverSnapshot.revealedCells));
          setActiveClue(serverSnapshot.activeClue);
          setElapsedMs(serverSnapshot.elapsedMs);
          setShowInstructions(false);
          showRestoredProgressBanner();
        } else if (hasNewSolved && serverLetters) {
          setLetters((current) => {
            const merged = current.map((row) => [...row]);
            for (let r = 0; r < rows; r++) {
              for (let c = 0; c < cols; c++) {
                if (!merged[r][c] && serverLetters[r]?.[c]) {
                  merged[r][c] = serverLetters[r][c];
                }
              }
            }
            return merged;
          });
          showRestoredProgressBanner();
        } else if (hasNewSolved) {
          showRestoredProgressBanner();
        }

        // Guarded by completionNotifiedRef so that if the player already
        // finished the puzzle live (in this same session) while this hydrate
        // request was still in flight, we don't steal the completion and skip
        // straight past the board celebration / completion card animation.
        if (payload.allSolved === true && !completionNotifiedRef.current) {
          completionNotifiedRef.current = true;
          setGameStatus("won");
          if (serverElapsedMs > 0) {
            setElapsedMs((current) => Math.max(current, serverElapsedMs));
          }
          setShowInstructions(false);
          const elapsedSeconds = serverElapsedMs > 0 ? Math.round(serverElapsedMs / 1000) : undefined;
          onSolvedRef.current?.(elapsedSeconds);
        }
      } catch {
        // Local progress is still available if the server hydrate fails.
      }
    };

    hydrateProgress();

    return () => {
      cancelled = true;
    };
  }, [alreadySolved, warzMode, data, initialGrid, puzzleId, rows, cols, progressSignature, showRestoredProgressBanner]);

  // ── Compute active word cells ──────────────────────────────────────────────
  const activeWordCells = useMemo<Set<string>>(() => {
    if (!activeClue || !initialGrid.length) return new Set();
    const startClue =
      activeClue.direction === "across"
        ? data?.clues.across.find((c) => c.number === activeClue.number)
        : data?.clues.down.find((c) => c.number === activeClue.number);
    if (!startClue) return new Set();
    const cells = getWordCells(initialGrid, startClue.row, startClue.col, activeClue.direction);
    return new Set(cells.map((c) => `${c.row},${c.col}`));
  }, [activeClue, initialGrid, data]);

  const triggerSolvedClueAnimation = useCallback((key: string, direction: Direction, number: number) => {
    const solvedClue = direction === "across"
      ? data?.clues.across.find((entry) => entry.number === number)
      : data?.clues.down.find((entry) => entry.number === number);
    const staggerTailMs = solvedClue ? Math.max(0, solvedClue.length - 1) * WORD_SOLVED_STAGGER_MS : 0;
    const cleanupDelayMs = WORD_SOLVED_ANIMATION_MS + staggerTailMs + 120;

    setJustSolvedClues((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setLatestSolvedClue({ direction, number });

    const timer = setTimeout(() => {
      setJustSolvedClues((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setLatestSolvedClue((current) => (
        current?.direction === direction && current.number === number ? null : current
      ));
    }, cleanupDelayMs);
    solvedAnimationTimersRef.current.push(timer);
  }, [data]);

  const startCompletionAnimation = useCallback(() => {
    if (animationStartedRef.current) return;
    animationStartedRef.current = true;

    const finalElapsedMs = Math.max(0, Math.round(getElapsedSnapshotMs()));
    completionNotifiedRef.current = true;
    timerAnchorRef.current = null;
    setElapsedMs(finalElapsedMs);
    setGameStatus("won");
    // Phase 1: let the whole board celebrate (visible, nothing covers it) before
    // the "Crossword Complete" card appears — see checkWord's allSolved branch
    // for the delay that lets the last word's own solve animation finish first.
    setBoardCelebrating(true);

    const waveTailMs = Math.max(0, (rows - 1) + (cols - 1)) * BOARD_WAVE_STAGGER_MS;
    if (boardCelebrationTimerRef.current) clearTimeout(boardCelebrationTimerRef.current);
    boardCelebrationTimerRef.current = setTimeout(() => {
      // Phase 2: now bring in the full-screen completion card.
      setBoardCelebrating(false);
      setCompletionAnimating(true);

      if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
      completionTimerRef.current = setTimeout(() => {
        setCompletionAnimating(false);
        // Phase 3: hand off to the caller (XP/rating modals, etc.).
        onSolved?.(Math.round(finalElapsedMs / 1000));
      }, PUZZLE_COMPLETE_ANIMATION_MS);
    }, BOARD_CELEBRATION_BASE_MS + waveTailMs);
  }, [getElapsedSnapshotMs, onSolved, rows, cols]);

  const triggerLetterDrawAnimation = useCallback((row: number, col: number) => {
    if (typeof window === "undefined") return;

    const pick = (min: number, max: number, precision = 2) =>
      Number((Math.random() * (max - min) + min).toFixed(precision));

    const cellKey = `${row},${col}`;
    const tokenId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const token: LetterDrawToken = {
      id: tokenId,
      isAnimating: true,
      durationMs: pick(360, 520, 0),
      drawStartY: pick(0.9, 2.3),
      drawMidY: pick(-0.45, 0.18),
      drawStartRotate: pick(-2.8, 1.8),
      drawMidRotate: pick(-0.7, 0.5),
      drawStartScale: pick(0.93, 0.98),
      drawMidScale: pick(1.0, 1.03),
    };

    // Keep Tegaki mounted for this cell so the final letter style does not swap out.
    setLetterDrawTokens((prev) => ({ ...prev, [cellKey]: token }));
    playPencilWriteSfx();

    const timer = setTimeout(() => {
      setLetterDrawTokens((prev) => {
        const current = prev[cellKey];
        if (!current || current.id !== tokenId || !current.isAnimating) return prev;
        return {
          ...prev,
          [cellKey]: {
            ...current,
            isAnimating: false,
          },
        };
      });
    }, Math.max(LETTER_DRAW_ANIMATION_MS, token.durationMs) + 110);

    letterDrawTimersRef.current.push(timer);
  }, [playPencilWriteSfx]);

  // ── Check a word against the server ───────────────────────────────────────
  const checkWord = useCallback(
    async (direction: Direction, number: number, answer: string) => {
      const key = `${direction}-${number}`;
      if (solvedCluesRef.current.has(key)) return;
      if (checkingCluesRef.current.get(key) === answer) return;

      checkingCluesRef.current.set(key, answer);

      const runCheck = async () => {
        if (solvedCluesRef.current.has(key)) {
          if (checkingCluesRef.current.get(key) === answer) {
            checkingCluesRef.current.delete(key);
          }
          return;
        }

        setSubmitting(true);
        try {
          const res = await fetch(`/api/puzzles/${puzzleId}/crossword`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ direction, number, answer }),
          });
          const json = await res.json();
          if (json.correct && checkingCluesRef.current.get(key) === answer) {
            if (!solvedCluesRef.current.has(key)) {
              const next = new Set(solvedCluesRef.current);
              next.add(key);
              solvedCluesRef.current = next;
              setSolvedClues(next);
              triggerSolvedClueAnimation(key, direction, number);
              playSuccessAnswerSfx();
            }
            setError("");
            if (json.allSolved && !completionNotifiedRef.current) {
              // Claim completion immediately so a slow, still-in-flight hydrate
              // fetch from page load can't race in and short-circuit past the
              // animation once it resolves (see hydrateProgress's allSolved
              // check above) -- the actual animation is still deferred below.
              completionNotifiedRef.current = true;
              // Wait for this last word's own solve animation to finish playing
              // before the board-wide celebration (and later, the completion
              // card) takes over — otherwise it gets cut off/covered instantly.
              const staggerTailMs = Math.max(0, answer.length - 1) * WORD_SOLVED_STAGGER_MS;
              const leadDelayMs = WORD_SOLVED_ANIMATION_MS + staggerTailMs + COMPLETION_LEAD_BUFFER_MS;
              if (preCompletionTimerRef.current) clearTimeout(preCompletionTimerRef.current);
              preCompletionTimerRef.current = setTimeout(() => {
                startCompletionAnimation();
              }, leadDelayMs);
            }
          }
        } catch {
          // network error — silently ignore
        } finally {
          if (checkingCluesRef.current.get(key) === answer) {
            checkingCluesRef.current.delete(key);
          }
          setSubmitting(false);
        }
      };

      const queuedCheck = checkQueueRef.current.catch(() => undefined).then(runCheck);
      checkQueueRef.current = queuedCheck;
      await queuedCheck;
    },
    [playSuccessAnswerSfx, puzzleId, startCompletionAnimation, triggerSolvedClueAnimation]
  );

  const checkFilledClues = useCallback(
    (currentLetters: string[][]) => {
      if (!data || !initialGrid.length || gameStatus !== "playing") return;

      const checkClueSet = (direction: Direction, clues: CrosswordClue[]) => {
        for (const clue of clues) {
          const key = `${direction}-${clue.number}`;
          if (solvedCluesRef.current.has(key)) continue;

          const cells = getWordCells(initialGrid, clue.row, clue.col, direction);
          if (cells.length !== clue.length) continue;

          const word = cells.map((cell) => currentLetters[cell.row]?.[cell.col] ?? "").join("");
          if (checkingCluesRef.current.get(key) === word) continue;
          if (word.length === clue.length && cells.every((cell) => !!currentLetters[cell.row]?.[cell.col])) {
            checkWord(direction, clue.number, word);
          }
        }
      };

      checkClueSet("across", data.clues.across);
      checkClueSet("down", data.clues.down);
    },
    [data, gameStatus, initialGrid, checkWord]
  );

  useEffect(() => {
    checkFilledClues(letters);
  }, [letters, checkFilledClues]);

  const persistCrosswordProgress = useCallback(
    (sendServer: boolean, keepalive = false) => {
      if (alreadySolved || warzMode || !data || !initialGrid.length || gameStatus !== "playing") return;

      const snapshot = buildSavedCrosswordProgress(
        progressSignature,
        lettersRef.current,
        revealedRef.current,
        activeClueRef.current,
        getElapsedSnapshotMs()
      );
      const hasProgress = hasCrosswordProgress(snapshot);

      try {
        if (hasProgress) {
          localStorage.setItem(progressStorageKey, JSON.stringify(snapshot));
          localProgressRef.current = snapshot;
        } else {
          localStorage.removeItem(progressStorageKey);
          localProgressRef.current = null;
        }
      } catch {
        // Storage can fail in private browsing or restricted environments.
      }

      if (!sendServer) return;
      if (!hasProgress && lastSavedPayloadRef.current === "") return;

      const requestBody = JSON.stringify({
        letters: snapshot.letters,
        revealedCells: snapshot.revealedCells,
        activeClue: snapshot.activeClue,
        elapsedMs: snapshot.elapsedMs,
      });
      if (!keepalive && requestBody === lastSavedPayloadRef.current) return;
      lastSavedPayloadRef.current = requestBody;

      void fetch(`/api/puzzles/${puzzleId}/crossword`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        keepalive,
        body: requestBody,
      }).catch(() => undefined);
    },
    [alreadySolved, warzMode, data, initialGrid, gameStatus, progressSignature, progressStorageKey, puzzleId, getElapsedSnapshotMs]
  );

  useEffect(() => {
    if (alreadySolved || warzMode || !data || gameStatus !== "playing") return;

    persistCrosswordProgress(false);
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      persistCrosswordProgress(true);
      autosaveTimerRef.current = null;
    }, 700);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [letters, revealed, activeClue, alreadySolved, warzMode, data, gameStatus, persistCrosswordProgress]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePageHide = () => persistCrosswordProgress(true, true);
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [persistCrosswordProgress]);

  // ── Move cursor to next empty cell in word ─────────────────────────────────
  const [cursorCell, setCursorCell] = useState<{ row: number; col: number } | null>(null);

  useEffect(() => {
    if (!activeClue || cursorCell || !data || !initialGrid.length) return;

    const clue = activeClue.direction === "across"
      ? data.clues.across.find((entry) => entry.number === activeClue.number)
      : data.clues.down.find((entry) => entry.number === activeClue.number);
    if (!clue) return;

    const cells = getWordCells(initialGrid, clue.row, clue.col, activeClue.direction);
    const firstEmpty = cells.find((cell) => !letters[cell.row]?.[cell.col]);
    setCursorCell(firstEmpty ?? cells[0] ?? { row: clue.row, col: clue.col });
  }, [activeClue, cursorCell, data, initialGrid, letters]);

  const advanceCursor = useCallback(
    (row: number, col: number, direction: Direction) => {
      if (!initialGrid.length) return;
      const next =
        direction === "across"
          ? initialGrid[row]?.[col + 1]
          : initialGrid[row + 1]?.[col];
      if (next && !next.isBlack) {
        const nr = direction === "across" ? row : row + 1;
        const nc = direction === "across" ? col + 1 : col;
        setCursorCell({ row: nr, col: nc });
      }
    },
    [initialGrid]
  );

  const retreatCursor = useCallback(
    (row: number, col: number, direction: Direction) => {
      if (!initialGrid.length) return;
      const prev =
        direction === "across"
          ? initialGrid[row]?.[col - 1]
          : initialGrid[row - 1]?.[col];
      if (prev && !prev.isBlack) {
        const nr = direction === "across" ? row : row - 1;
        const nc = direction === "across" ? col - 1 : col;
        setCursorCell({ row: nr, col: nc });
      }
    },
    [initialGrid]
  );

  // ── Select all clues sorted numerically for Tab navigation ────────────────
  const sortedClues = useMemo<ActiveClue[]>(() => {
    if (!data) return [];
    const all: ActiveClue[] = [];
    [...data.clues.across.map((c) => ({ direction: "across" as Direction, number: c.number })),
     ...data.clues.down.map((c) => ({ direction: "down" as Direction, number: c.number }))]
      .sort((a, b) => a.number - b.number || a.direction.localeCompare(b.direction))
      .forEach((c) => all.push(c));
    return all;
  }, [data]);

  const goToNextClue = useCallback(() => {
    if (!activeClue || !sortedClues.length) return;
    const idx = sortedClues.findIndex(
      (c) => c.direction === activeClue.direction && c.number === activeClue.number
    );
    const next = sortedClues[(idx + 1) % sortedClues.length];
    setActiveClue(next);
    // move cursor to first empty cell in next clue
    if (data) {
      const clue =
        next.direction === "across"
          ? data.clues.across.find((c) => c.number === next.number)
          : data.clues.down.find((c) => c.number === next.number);
      if (clue) setCursorCell({ row: clue.row, col: clue.col });
    }
  }, [activeClue, sortedClues, data]);

  const isLockedCell = useCallback(
    (row: number, col: number): boolean => {
      const cell = initialGrid[row]?.[col];
      if (!cell || cell.isBlack) return false;

      const acrossLocked = cell.acrossNumber
        ? solvedCluesRef.current.has(`across-${cell.acrossNumber}`)
        : false;
      const downLocked = cell.downNumber
        ? solvedCluesRef.current.has(`down-${cell.downNumber}`)
        : false;

      return acrossLocked || downLocked;
    },
    [initialGrid]
  );

  const focusKeyboardInput = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus({ preventScroll: true });
  }, []);

  // ── Cell click ─────────────────────────────────────────────────────────────
  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (gameStatus !== "playing") return;
      const cell = initialGrid[row]?.[col];
      if (!cell || cell.isBlack) return;

      // Keep focus tied to direct touch/click so mobile virtual keyboards open reliably.
      focusKeyboardInput();

      const hasAcross = !!cell.acrossNumber;
      const hasDown = !!cell.downNumber;

      if (cursorCell?.row === row && cursorCell?.col === col && activeClue) {
        // Toggle direction on same cell
        if (hasAcross && hasDown) {
          const newDir: Direction = activeClue.direction === "across" ? "down" : "across";
          const num = newDir === "across" ? cell.acrossNumber! : cell.downNumber!;
          setActiveClue({ direction: newDir, number: num });
        }
      } else {
        setCursorCell({ row, col });
        // prefer current direction if the cell belongs to it
        if (activeClue?.direction === "across" && hasAcross) {
          setActiveClue({ direction: "across", number: cell.acrossNumber! });
        } else if (activeClue?.direction === "down" && hasDown) {
          setActiveClue({ direction: "down", number: cell.downNumber! });
        } else if (hasAcross) {
          setActiveClue({ direction: "across", number: cell.acrossNumber! });
        } else if (hasDown) {
          setActiveClue({ direction: "down", number: cell.downNumber! });
        }
      }
    },
    [gameStatus, initialGrid, cursorCell, activeClue, focusKeyboardInput]
  );

  const handleDeleteAtCursor = useCallback(() => {
    if (gameStatus !== "playing" || !activeClue || !cursorCell) return;

    const { row, col } = cursorCell;
    const currentLocked = isLockedCell(row, col);
    if (letters[row][col] && !currentLocked) {
      // erase current
      setLetters((prev) => {
        const next = prev.map((r) => [...r]);
        next[row][col] = "";
        return next;
      });
      return;
    }

    // move back and erase
    retreatCursor(row, col, activeClue.direction);
    const pr = activeClue.direction === "across" ? row : row - 1;
    const pc = activeClue.direction === "across" ? col - 1 : col;
    if (pr >= 0 && pc >= 0 && !initialGrid[pr]?.[col === 0 ? col : pc]?.isBlack) {
      const tr = activeClue.direction === "across" ? row : pr;
      const tc = activeClue.direction === "across" ? pc : col;
      if (isLockedCell(tr, tc)) return;
      setLetters((prev) => {
        const next = prev.map((r) => [...r]);
        if (tr >= 0 && tc >= 0) next[tr][tc] = "";
        return next;
      });
    }
  }, [gameStatus, activeClue, cursorCell, isLockedCell, letters, retreatCursor, initialGrid]);

  const handleLetterEntry = useCallback(
    (rawKey: string) => {
      if (gameStatus !== "playing" || !activeClue || !cursorCell) return;

      const { row, col } = cursorCell;
      const key = rawKey.toUpperCase();
      if (!/^[A-Z]$/.test(key)) return;

      const currentLocked = isLockedCell(row, col);
      if (currentLocked) {
        advanceCursor(row, col, activeClue.direction);
        return;
      }

      setLetters((prev) => {
        const next = prev.map((r) => [...r]);
        next[row][col] = key;
        return next;
      });
      triggerLetterDrawAnimation(row, col);
      advanceCursor(row, col, activeClue.direction);
    },
    [gameStatus, activeClue, cursorCell, isLockedCell, advanceCursor, triggerLetterDrawAnimation]
  );

  // ── Keyboard handling ─────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (gameStatus !== "playing" || !activeClue || !cursorCell) return;
      const { row, col } = cursorCell;
      const key = e.key.toUpperCase();

      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        goToNextClue();
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        handleDeleteAtCursor();
        return;
      }

      // Arrow keys
      if (e.key === "ArrowRight") { e.preventDefault(); advanceCursor(row, col, "across"); setActiveClue((a) => a && { ...a, direction: "across", number: initialGrid[row][col].acrossNumber ?? a.number }); return; }
      if (e.key === "ArrowLeft")  { e.preventDefault(); retreatCursor(row, col, "across"); setActiveClue((a) => a && { ...a, direction: "across", number: initialGrid[row][col].acrossNumber ?? a.number }); return; }
      if (e.key === "ArrowDown")  { e.preventDefault(); advanceCursor(row, col, "down");   setActiveClue((a) => a && { ...a, direction: "down",   number: initialGrid[row][col].downNumber   ?? a.number }); return; }
      if (e.key === "ArrowUp")    { e.preventDefault(); retreatCursor(row, col, "down");   setActiveClue((a) => a && { ...a, direction: "down",   number: initialGrid[row][col].downNumber   ?? a.number }); return; }

      if (/^[A-Z]$/.test(key)) {
        e.preventDefault();
        handleLetterEntry(key);
      }
    },
    [gameStatus, activeClue, cursorCell, initialGrid, goToNextClue, retreatCursor, advanceCursor, handleDeleteAtCursor, handleLetterEntry]
  );

  const handleHiddenInputBeforeInput = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      const native = e.nativeEvent as InputEvent;
      if (native.inputType === "deleteContentBackward") {
        e.preventDefault();
        handleDeleteAtCursor();
        e.currentTarget.value = "";
      }
    },
    [handleDeleteAtCursor]
  );

  const handleHiddenInputInput = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      const raw = e.currentTarget.value ?? "";
      if (!raw) return;
      e.currentTarget.value = "";

      const nextLetter = raw.toUpperCase().replace(/[^A-Z]/g, "").slice(-1);
      if (!nextLetter) return;
      handleLetterEntry(nextLetter);
    },
    [handleLetterEntry]
  );

  // ── Hint: reveal a letter in the current cell ──────────────────────────────
  const useHintToken = useCallback(async () => {
    if (!cursorCell || !activeClue || hintTokens < 1 || hintLoading) return;
    if (!data) return;

    // If the cursor is sitting on a cell that's already been revealed (the
    // common case right after using a hint, since the cursor doesn't move),
    // retarget to the next not-yet-revealed cell in the same word instead of
    // silently doing nothing. If the whole word is already revealed, tell the
    // user why instead of leaving the button looking broken.
    let target = cursorCell;
    if (revealed.has(`${target.row},${target.col}`)) {
      const startClue = activeClue.direction === "across"
        ? data.clues.across.find((c) => c.number === activeClue.number)
        : data.clues.down.find((c) => c.number === activeClue.number);
      const nextCell = startClue
        ? getWordCells(initialGrid, startClue.row, startClue.col, activeClue.direction)
            .find((cell) => !revealed.has(`${cell.row},${cell.col}`))
        : undefined;

      if (!nextCell) {
        setError("Every letter in this word is already revealed — select a different word to use a hint.");
        return;
      }
      target = nextCell;
    }

    const { row, col } = target;
    const key = `${row},${col}`;

    setError("");
    setHintLoading(true);
    try {
      const ok = onHintUsed ? await onHintUsed() : true;
      if (!ok) { setHintLoading(false); return; }

      const res = await fetch(`/api/puzzles/${puzzleId}/crossword/hint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ row, col }),
      });
      const json = await res.json();
      if (res.ok && json.letter) {
        setLetters((prev) => {
          const next = prev.map((r) => [...r]);
          next[row][col] = json.letter;
          return next;
        });
        setRevealed((prev) => new Set(prev).add(key));
        setCursorCell(target);
      } else {
        setError(json.error || "Couldn't reveal that letter. Please try again.");
      }
    } catch {
      setError("Couldn't reveal that letter — check your connection and try again.");
    } finally {
      setHintLoading(false);
    }
  }, [cursorCell, activeClue, hintTokens, hintLoading, revealed, onHintUsed, puzzleId, data, initialGrid]);

  // ── Clue list click ────────────────────────────────────────────────────────
  const handleClueClick = useCallback(
    (direction: Direction, number: number) => {
      if (gameStatus !== "playing") return;
      setCluePanelDirection(direction);
      setActiveClue({ direction, number });
      if (data) {
        const clue =
          direction === "across"
            ? data.clues.across.find((c) => c.number === number)
            : data.clues.down.find((c) => c.number === number);
        if (clue) {
          // Move cursor to first empty cell in this clue
          const cells = getWordCells(initialGrid, clue.row, clue.col, direction);
          const firstEmpty = cells.find((c) => !letters[c.row][c.col]);
          setCursorCell(firstEmpty ?? cells[0] ?? { row: clue.row, col: clue.col });
        }
      }
      focusKeyboardInput();
    },
    [gameStatus, data, initialGrid, letters, focusKeyboardInput]
  );

  const getCellStatus = (row: number, col: number): { isSolved: boolean; isJustSolved: boolean } => {
    const cell = initialGrid[row]?.[col];
    if (!cell || cell.isBlack) return { isSolved: false, isJustSolved: false };

    const acrossKey = cell.acrossNumber ? `across-${cell.acrossNumber}` : null;
    const downKey = cell.downNumber ? `down-${cell.downNumber}` : null;

    return {
      isSolved: !!((acrossKey && solvedClues.has(acrossKey)) || (downKey && solvedClues.has(downKey))),
      isJustSolved: !!((acrossKey && justSolvedClues.has(acrossKey)) || (downKey && justSolvedClues.has(downKey))),
    };
  };

  const getSolvedCellAnimationDelayMs = (
    row: number,
    col: number,
    status: { isSolved: boolean; isJustSolved: boolean }
  ): number => {
    if (!status.isJustSolved || !latestSolvedClue || !data) return 0;

    const clue = latestSolvedClue.direction === "across"
      ? data.clues.across.find((entry) => entry.number === latestSolvedClue.number)
      : data.clues.down.find((entry) => entry.number === latestSolvedClue.number);
    if (!clue) return 0;

    if (latestSolvedClue.direction === "across") {
      if (row !== clue.row) return 0;
      if (col < clue.col || col >= clue.col + clue.length) return 0;
      return (col - clue.col) * WORD_SOLVED_STAGGER_MS;
    }

    if (col !== clue.col) return 0;
    if (row < clue.row || row >= clue.row + clue.length) return 0;
    return (row - clue.row) * WORD_SOLVED_STAGGER_MS;
  };

  function getCellPalette(
    row: number,
    col: number,
    status = getCellStatus(row, col)
  ): {
    isBlack: boolean;
    bg: string;
    borderColor: string;
    textColor: string;
    clueColor: string;
    isActive: boolean;
    isSolved: boolean;
  } {
    const cell = initialGrid[row]?.[col];
    if (!cell || cell.isBlack) {
      return {
        isBlack: true,
        bg: skin.tileBg === "transparent" ? "#111" : "#0a0a0f",
        borderColor: "#222",
        textColor: "#e2e8f0",
        clueColor: "#94a3b8",
        isActive: false,
        isSolved: false,
      };
    }

    const key = `${row},${col}`;
    const isActive = cursorCell?.row === row && cursorCell?.col === col;
    const isInWord = activeWordCells.has(key);
    const isRevealed = revealed.has(key);

    let bg = "#ffffff";
    let borderColor = "#cbd5e1";
    let textColor = "#0f172a";
    let clueColor = "#64748b";

    if (isInWord) {
      bg = "#e0e7ff";
      borderColor = "#6366f1";
      textColor = "#1f2937";
      clueColor = "#4f46e5";
    }
    if (isRevealed) {
      bg = "#fef3c7";
      borderColor = "#f59e0b";
      textColor = "#78350f";
      clueColor = "#92400e";
    }
    if (status.isSolved) {
      bg = "#dcfce7";
      borderColor = "#22c55e";
      textColor = "#14532d";
      clueColor = "#15803d";
    }

    if (isActive) {
      if (status.isSolved) {
        bg = "#bbf7d0";
        borderColor = "#16a34a";
      } else if (isRevealed) {
        bg = "#fde68a";
        borderColor = "#d97706";
      } else {
        bg = "#c7d2fe";
        borderColor = "#4f46e5";
        textColor = "#0f172a";
        clueColor = "#4338ca";
      }
    }

    return {
      isBlack: false,
      bg,
      borderColor,
      textColor,
      clueColor,
      isActive,
      isSolved: status.isSolved,
    };
  }

  // ── Cell color ────────────────────────────────────────────────────────────
  function cellStyle(
    row: number,
    col: number,
    status = getCellStatus(row, col),
    palette = getCellPalette(row, col, status)
  ): React.CSSProperties {
    if (palette.isBlack) {
      return { background: palette.bg, border: `1px solid ${palette.borderColor}` };
    }

    return {
      background: palette.bg,
      border: `2px solid ${palette.borderColor}`,
      boxShadow: palette.isActive
        ? palette.isSolved
          ? "0 0 0 2px rgba(34,197,94,0.28)"
          : "0 0 0 2px rgba(79,70,229,0.28)"
        : undefined,
      cursor: "pointer",
      position: "relative",
    };
  }

  if (!data) {
    return (
      <div className="p-8 text-center" style={{ color: "#ef4444" }}>
        Invalid crossword data — check puzzle configuration.
      </div>
    );
  }

  const acrossClues = [...data.clues.across].sort((a, b) => a.number - b.number);
  const downClues = [...data.clues.down].sort((a, b) => a.number - b.number);
  const panelClues = cluePanelDirection === "across" ? acrossClues : downClues;
  const panelSolvedCount = panelClues.filter((clue) => solvedClues.has(`${cluePanelDirection}-${clue.number}`)).length;
  const acrossSolvedCount = acrossClues.filter((clue) => solvedClues.has(`across-${clue.number}`)).length;
  const downSolvedCount = downClues.filter((clue) => solvedClues.has(`down-${clue.number}`)).length;
  const completionOverlay = completionAnimating && typeof document !== "undefined"
    ? createPortal(<CrosswordCompletionOverlay />, document.body)
    : null;

  return (
    <>
      <style jsx global>{`
        @keyframes crossword-cell-success {
          0% { filter: brightness(1); box-shadow: 0 0 0 rgba(74, 222, 128, 0); }
          18% { filter: brightness(1.75); box-shadow: 0 0 0 4px rgba(74, 222, 128, 0.35), 0 0 26px rgba(74, 222, 128, 0.95); }
          42% { filter: brightness(1.35); box-shadow: 0 0 0 2px rgba(253, 231, 76, 0.26), 0 0 18px rgba(253, 231, 76, 0.42); }
          100% { filter: brightness(1); box-shadow: 0 0 0 rgba(74, 222, 128, 0); }
        }

        @keyframes crossword-cell-burst {
          0% { opacity: 0; transform: scale(0.4); box-shadow: 0 0 0 rgba(16,185,129,0); }
          22% { opacity: 1; transform: scale(1.08); box-shadow: 0 0 20px rgba(16,185,129,0.45), 0 0 10px rgba(253,231,76,0.42); }
          100% { opacity: 0; transform: scale(1.3); box-shadow: 0 0 0 rgba(16,185,129,0); }
        }

        @keyframes crossword-cell-shine {
          0% { opacity: 0; transform: translateX(-130%) skewX(-20deg); }
          24% { opacity: 0.85; }
          100% { opacity: 0; transform: translateX(165%) skewX(-20deg); }
        }

        @keyframes crossword-cell-finish {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          35% { transform: scale(1.08); filter: brightness(1.65); }
        }

        @keyframes crossword-clue-success {
          0% { transform: translateX(0) scale(1); }
          20% { transform: translateX(6px) scale(1.03); }
          100% { transform: translateX(0) scale(1); }
        }

        @keyframes crossword-completion-card {
          0% { transform: scale(0.9) translateY(18px); }
          20% { transform: scale(1.05) translateY(0); }
          100% { transform: scale(1) translateY(0); }
        }

        @keyframes crossword-completion-ring {
          0% { opacity: 0; transform: scale(0.58); }
          20% { opacity: 0.9; }
          100% { opacity: 0; transform: scale(1.42); }
        }

        @keyframes crossword-word-toast {
          0% { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.94); }
          18% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1.04); }
          78% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-6px) scale(0.96); }
        }

        @keyframes crossword-completion-bar {
          0% { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }

        @keyframes crossword-letter-settle {
          0% {
            opacity: 0;
            transform: translateY(var(--cw-draw-start-y, 1.6px)) rotate(var(--cw-draw-start-rot, -2deg)) scale(var(--cw-draw-start-scale, 0.95));
            filter: blur(0.4px);
          }
          44% {
            opacity: 1;
            transform: translateY(var(--cw-draw-mid-y, -0.28px)) rotate(var(--cw-draw-mid-rot, -0.4deg)) scale(var(--cw-draw-mid-scale, 1.02));
            filter: blur(0.04px);
          }
          100% {
            opacity: 1;
            transform: translateY(0) rotate(0deg) scale(1);
            filter: none;
          }
        }

        .crossword-cell-success {
          --cw-cell-delay: 0ms;
          animation: crossword-cell-success ${WORD_SOLVED_ANIMATION_MS}ms ease-out both;
          animation-delay: var(--cw-cell-delay);
          z-index: 2;
          overflow: hidden;
        }

        .crossword-cell-success::before {
          content: "";
          position: absolute;
          inset: -2px;
          border-radius: inherit;
          border: 2px solid rgba(52, 211, 153, 0.7);
          pointer-events: none;
          animation: crossword-cell-burst 760ms ease-out both;
          animation-delay: calc(var(--cw-cell-delay) + 80ms);
        }

        .crossword-cell-success::after {
          content: "";
          position: absolute;
          top: -20%;
          bottom: -20%;
          left: -40%;
          width: 42%;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.72), rgba(255,255,255,0));
          pointer-events: none;
          animation: crossword-cell-shine 680ms ease-out both;
          animation-delay: calc(var(--cw-cell-delay) + 110ms);
        }

        .crossword-letter-draw {
          --cw-write-duration: ${LETTER_DRAW_ANIMATION_MS}ms;
          --cw-draw-start-y: 1.6px;
          --cw-draw-mid-y: -0.28px;
          --cw-draw-start-rot: -2deg;
          --cw-draw-mid-rot: -0.4deg;
          --cw-draw-start-scale: 0.95;
          --cw-draw-mid-scale: 1.02;
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transform-origin: center 74%;
          will-change: transform, opacity, filter;
          animation: crossword-letter-settle var(--cw-write-duration) cubic-bezier(0.22, 0.72, 0.2, 1) both;
        }

        .crossword-tegaki-letter {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          color: inherit;
        }

        .crossword-cell-finish {
          animation: crossword-cell-finish 900ms ease-in-out 2;
          animation-delay: var(--cw-board-wave-delay, 0ms);
        }

        .crossword-clue-success {
          animation: crossword-clue-success ${WORD_SOLVED_ANIMATION_MS}ms ease-out;
          box-shadow: 0 0 0 1px rgba(74, 222, 128, 0.45), 0 0 24px rgba(74, 222, 128, 0.18);
        }

        .crossword-completion-card {
          animation: crossword-completion-card ${PUZZLE_COMPLETE_ANIMATION_MS}ms ease-in-out both;
        }

        .crossword-completion-ring {
          animation: crossword-completion-ring ${PUZZLE_COMPLETE_ANIMATION_MS}ms ease-out both;
        }

        .crossword-word-toast {
          animation: crossword-word-toast ${WORD_SOLVED_ANIMATION_MS}ms ease-out both;
        }

        .crossword-completion-bar {
          transform-origin: left center;
          animation: crossword-completion-bar ${PUZZLE_COMPLETE_ANIMATION_MS}ms linear both;
        }

        .crossword-clue-panel-scroll {
          max-height: min(340px, 42vh);
          scrollbar-width: thin;
          scrollbar-color: rgba(129, 140, 248, 0.5) rgba(15, 23, 42, 0.35);
        }

        .crossword-clue-panel-scroll::-webkit-scrollbar {
          width: 8px;
        }

        .crossword-clue-panel-scroll::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.35);
          border-radius: 999px;
        }

        .crossword-clue-panel-scroll::-webkit-scrollbar-thumb {
          background: rgba(129, 140, 248, 0.5);
          border-radius: 999px;
        }

        @media (min-width: 1024px) {
          .crossword-clue-panel-scroll {
            max-height: min(62vh, 520px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .crossword-cell-success,
          .crossword-cell-finish,
          .crossword-clue-success,
          .crossword-completion-card,
          .crossword-completion-ring,
          .crossword-word-toast,
          .crossword-completion-bar {
            animation: none !important;
          }

          .crossword-letter-draw,
          .crossword-tegaki-letter {
            animation: none !important;
          }

          .crossword-letter-draw {
            transform: none !important;
            filter: none !important;
            opacity: 1 !important;
          }

          .crossword-cell-success::before,
          .crossword-cell-success::after {
            animation: none !important;
          }
        }
      `}</style>
      {showInstructions && <InstructionsModal onClose={() => setShowInstructions(false)} />}
      {completionOverlay}

      <div
        className="wc-skin-root"
        data-skin={skin._key ?? "default"}
        style={{ position: "relative", borderRadius: "1rem", overflow: "hidden", width: "100%", maxWidth: "100vw" }}
      >
        {(skin._key === "lava"   || skin._key === "skin_lava")   && <LavaBackground />}
        {(skin._key === "galaxy" || skin._key === "skin_galaxy") && <GalaxyBackground />}
        {(skin._key === "ice"    || skin._key === "skin_ice" || skin._key === "christmas" || skin._key === "skin_christmas")    && <IceBackground />}
        {(skin._key === "neon"   || skin._key === "skin_neon")   && <NeonBackground />}
        {(skin._key === "retro"  || skin._key === "skin_retro")  && <RetroBackground />}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: skin.backdropScrim,
            zIndex: 0,
          }}
        />

        <div
          className="flex flex-col items-center gap-4 select-none pb-6"
          style={{
            position: "relative",
            zIndex: 1,
            fontFamily: "'Clear Sans','Helvetica Neue',Arial,sans-serif",
          }}
        >
          {/* Header */}
          <div className="text-center relative w-full px-8 pt-4">
            <h2 className="text-2xl sm:text-3xl font-black tracking-[0.2em] mb-1"
              style={{
                display: "inline-block",
                backgroundImage: "linear-gradient(135deg, #818cf8, #c084fc, #f472b6)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
                WebkitTextFillColor: "transparent",
              }}
            >
              CROSSWORD
            </h2>
            <button
              onClick={() => setShowInstructions(true)}
              className="absolute right-4 top-4 w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center"
              style={{ background: "rgba(129,140,248,0.2)", border: "1px solid rgba(129,140,248,0.4)", color: "#818cf8" }}
            >?</button>
            <p className="text-xs mt-1 font-medium" style={{ color: "#e2e8f0", textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>
              {acrossClues.length + downClues.length} clues · {solvedClues.size} solved
            </p>
            <p className="text-[11px] mt-1 font-semibold" style={{ color: "#94a3b8", textShadow: "0 1px 4px rgba(0,0,0,0.65)" }}>
              Elapsed {formatElapsedStopwatch(elapsedMs)}
            </p>
          </div>

          {/* Win banner */}
          {gameStatus === "won" && (
            <div className="px-6 py-4 rounded-2xl text-center"
              style={{ background: "linear-gradient(135deg,rgba(56,211,153,.15),rgba(16,185,129,.15))", border: "1px solid #38D39955" }}>
              <div style={{ fontSize: "2rem" }}>⚡</div>
              <div className="font-black text-lg mt-1" style={{ color: "#38D399" }}>CROSSWORD CRACKED!</div>
              <div className="text-sm mt-1" style={{ color: "#9ca3af" }}>All words solved</div>
            </div>
          )}

          {error && (
            <div className="px-5 py-2 rounded-full text-sm font-bold"
              style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.5)", color: "#fca5a5" }}>
              {error}
            </div>
          )}

          {showRestoreNotice && gameStatus === "playing" && (
            <div className="px-4 py-2 rounded-full text-xs font-black tracking-wide"
              style={{ background: "rgba(56,211,153,0.14)", border: "1px solid rgba(56,211,153,0.45)", color: "#bbf7d0" }}>
              Progress restored from your last session
            </div>
          )}

          {/* Main layout: grid + clues */}
          <div className="w-full min-w-0 max-w-full px-2 flex flex-col lg:flex-row gap-4 items-start justify-center overflow-hidden">

            {/* Grid */}
            <div className="flex w-full min-w-0 max-w-full flex-col items-center gap-2 lg:flex-1">
              {/* Active clue banner */}
              <div style={{ position: "relative", width: "100%", maxWidth: gridPixelWidth > 0 ? `${gridPixelWidth}px` : "24rem" }}>
              {latestSolvedClue && (
                <div
                  className="crossword-word-toast"
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: -38,
                    transform: "translateX(-50%)",
                    width: "max-content",
                    maxWidth: "100%",
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: "rgba(20,83,45,0.94)",
                    border: "1px solid rgba(134,239,172,0.7)",
                    boxShadow: "0 10px 28px rgba(0,0,0,0.28), 0 0 18px rgba(34,197,94,0.32)",
                    color: "#bbf7d0",
                    fontSize: "0.72rem",
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    zIndex: 3,
                  }}
                >
                  Correct: {latestSolvedClue.number} {latestSolvedClue.direction}
                </div>
              )}
              <div className="w-full min-h-[2.5rem] px-3 py-1.5 rounded-lg text-sm text-center"
                style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", color: "#c7d2fe" }}>
                {activeClue ? (
                  <>
                    <span className="font-black">{activeClue.number} {activeClue.direction.toUpperCase()} </span>
                    {activeClue.direction === "across"
                      ? acrossClues.find((c) => c.number === activeClue.number)?.text
                      : downClues.find((c) => c.number === activeClue.number)?.text}
                  </>
                ) : (
                  <span style={{ color: "#6b7280" }}>Click a cell to begin</span>
                )}
              </div>
              </div>

              {/* Grid container */}
              <div
                ref={containerRef}
                className="flex w-full min-w-0 justify-center"
                style={{
                  maxWidth: "min(100%, calc(100vw - 1rem))",
                }}
              >
              <div
                style={{
                  boxSizing: "border-box",
                  display: "inline-grid",
                  gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
                  gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
                  gap: gridGap,
                  background: "#1a1a2e",
                  border: `${GRID_BORDER_PX}px solid ${skin.boardBorder ?? "rgba(255,255,255,0.12)"}`,
                  borderRadius: "8px",
                  padding: GRID_PADDING_PX,
                  opacity: 1,
                  width: gridPixelWidth > 0 ? `${gridPixelWidth}px` : "100%",
                  maxWidth: "100%",
                  overflow: "hidden",
                }}
                onClick={focusKeyboardInput}
                onTouchStart={focusKeyboardInput}
              >
                {initialGrid.map((rowArr, r) =>
                  rowArr.map((cell, c) => {
                    const status = getCellStatus(r, c);
                    const palette = getCellPalette(r, c, status);
                    const solvedDelayMs = getSolvedCellAnimationDelayMs(r, c, status);
                    const cellKey = `${r},${c}`;
                    const letterDrawToken = letterDrawTokens[cellKey];
                    const letterDrawTokenId = letterDrawToken?.id;
                    const hasLetter = Boolean(letters[r][c]);
                    const shouldAnimateLetterDraw = Boolean(letterDrawToken?.isAnimating && hasLetter);
                    const shouldRenderTegaki = hasLetter;
                    const isCompactCell = cellSize <= 28;
                    const tegakiClipStrength = isCompactCell ? 2.95 : 2.45;
                    const tegakiSegmentSize = isCompactCell ? 1.1 : 1.4;
                    const letterDrawVars = shouldAnimateLetterDraw && letterDrawToken
                      ? ({
                          ["--cw-write-duration" as any]: `${letterDrawToken.durationMs}ms`,
                          ["--cw-draw-start-y" as any]: `${letterDrawToken.drawStartY}px`,
                          ["--cw-draw-mid-y" as any]: `${letterDrawToken.drawMidY}px`,
                          ["--cw-draw-start-rot" as any]: `${letterDrawToken.drawStartRotate}deg`,
                          ["--cw-draw-mid-rot" as any]: `${letterDrawToken.drawMidRotate}deg`,
                          ["--cw-draw-start-scale" as any]: String(letterDrawToken.drawStartScale),
                          ["--cw-draw-mid-scale" as any]: String(letterDrawToken.drawMidScale),
                        } as React.CSSProperties)
                      : undefined;
                    const cellClasses = [
                      status.isJustSolved ? "crossword-cell-success" : "",
                      boardCelebrating && !cell.isBlack ? "crossword-cell-finish" : "",
                    ].filter(Boolean).join(" ");

                    return (
                      <div
                        key={`${r}-${c}`}
                        className={cellClasses || undefined}
                        style={{
                          width: cellSize,
                          height: cellSize,
                          ...cellStyle(r, c, status, palette),
                          ...(status.isJustSolved
                            ? ({ ["--cw-cell-delay" as any]: `${solvedDelayMs}ms` } as React.CSSProperties)
                            : {}),
                          ...(boardCelebrating
                            ? ({ ["--cw-board-wave-delay" as any]: `${(r + c) * BOARD_WAVE_STAGGER_MS}ms` } as React.CSSProperties)
                            : {}),
                          borderRadius: "3px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          userSelect: "none",
                        }}
                        onClick={() => handleCellClick(r, c)}
                      >
                        {!cell.isBlack && (
                          <>
                            {cell.clueNumber !== undefined && (
                              <span style={{
                                position: "absolute",
                                top: cellSize < 12 ? 0 : 1,
                                left: cellSize < 12 ? 1 : 2,
                                display: cellSize < 9 ? "none" : undefined,
                                fontSize: Math.max(5, Math.min(9, cellSize * 0.24)),
                                lineHeight: 1,
                                color: palette.clueColor,
                                fontWeight: 700,
                                textShadow: "0 1px 0 rgba(255,255,255,0.35), 0 0 2px rgba(15,23,42,0.12)",
                                pointerEvents: "none",
                              }}>
                                {cell.clueNumber}
                              </span>
                            )}
                            <span
                              key={`letter-${r}-${c}-${letterDrawTokenId ?? "static"}`}
                              className={shouldAnimateLetterDraw ? "crossword-letter-draw" : undefined}
                              style={{
                              ...letterDrawVars,
                              fontSize: Math.min(Math.max(6, cellSize * 0.58), Math.max(4, cellSize - 1)),
                              fontWeight: 900,
                              fontFamily: "Caveat, var(--font-handwriting), 'Segoe Print', 'Bradley Hand', 'Chalkboard SE', 'Comic Sans MS', cursive",
                              letterSpacing: "0.01em",
                              color: palette.textColor,
                              lineHeight: 1,
                              display: "inline-block",
                              transition: "color 180ms ease, text-shadow 180ms ease",
                              textShadow: status.isSolved
                                ? "0 0 8px rgba(22,163,74,0.24), 0 1px 0 rgba(255,255,255,0.35)"
                                : "0 1px 0 rgba(255,255,255,0.45), 0 0 2px rgba(15,23,42,0.16)",
                            }}
                            >
                              {shouldRenderTegaki ? (
                                <TegakiRenderer
                                  as="span"
                                  className="crossword-tegaki-letter"
                                  font={tegakiCaveatBundle}
                                  time={
                                    shouldAnimateLetterDraw && letterDrawToken
                                      ? {
                                          mode: "uncontrolled",
                                          duration: Math.max(0.28, letterDrawToken.durationMs / 1000),
                                          loop: false,
                                          playing: true,
                                        }
                                      : {
                                          mode: "controlled",
                                          value: 1,
                                          unit: "progress",
                                        }
                                  }
                                  quality={{
                                    clipText: tegakiClipStrength,
                                    smoothing: true,
                                    segmentSize: tegakiSegmentSize,
                                  }}
                                  style={{
                                    display: "inline-block",
                                    fontSize: "1em",
                                    lineHeight: 1,
                                  }}
                                >
                                  {letters[r][c]}
                                </TegakiRenderer>
                              ) : (
                                null
                              )}
                            </span>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              </div>

              {/* Hidden input to capture keyboard on mobile */}
              <input
                ref={inputRef}
                type="text"
                className="absolute w-px h-px opacity-0 pointer-events-none"
                onKeyDown={handleKeyDown}
                onBeforeInput={handleHiddenInputBeforeInput}
                onInput={handleHiddenInputInput}
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="next"
                aria-label="Crossword input"
              />

              {/* Hint button */}
              {gameStatus === "playing" && (
                <button
                  onClick={useHintToken}
                  disabled={hintLoading || hintTokens < 1 || !cursorCell}
                  className="mt-1 px-4 py-1.5 rounded-full text-sm font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: hintTokens < 1 ? "rgba(255,107,107,0.1)" : "rgba(56,145,166,0.15)",
                    border: `1px solid ${hintTokens < 1 ? "rgba(255,107,107,0.5)" : "rgba(56,145,166,0.4)"}`,
                    color: hintTokens < 1 ? "#FF6B6B" : "#3891A6",
                  }}
                >
                  {hintLoading ? "..." : hintTokens < 1 ? "🔤 No Hint Tokens" : `🔤 Reveal Letter (${hintTokens} token${hintTokens !== 1 ? "s" : ""})`}
                </button>
              )}
            </div>

            {/* Clue panel */}
            <div
              className="w-full min-w-0 max-w-full lg:w-[22rem] lg:flex-none"
              style={{
                borderRadius: 12,
                border: "1px solid rgba(129,140,248,0.28)",
                background: "rgba(15,23,42,0.58)",
                boxShadow: "0 14px 38px rgba(0,0,0,0.18)",
                overflow: "hidden",
              }}
            >
              <div className="flex items-center justify-between gap-2 px-3 py-2" style={{ borderBottom: "1px solid rgba(148,163,184,0.18)" }}>
                <div>
                  <div className="text-xs font-black tracking-widest" style={{ color: "#e2e8f0" }}>CLUES</div>
                  <div className="text-[11px] font-semibold" style={{ color: "#94a3b8" }}>
                    {panelSolvedCount}/{panelClues.length} {cluePanelDirection}
                  </div>
                </div>
                <div className="grid grid-cols-2 rounded-lg p-1" style={{ background: "rgba(2,6,23,0.5)", border: "1px solid rgba(148,163,184,0.18)" }}>
                  {(["across", "down"] as const).map((direction) => {
                    const active = cluePanelDirection === direction;
                    const solvedCount = direction === "across" ? acrossSolvedCount : downSolvedCount;
                    const totalCount = direction === "across" ? acrossClues.length : downClues.length;
                    return (
                      <button
                        key={direction}
                        type="button"
                        onClick={() => setCluePanelDirection(direction)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-black uppercase transition-all"
                        style={{
                          background: active
                            ? direction === "across" ? "rgba(99,102,241,0.32)" : "rgba(192,132,252,0.28)"
                            : "transparent",
                          color: active ? "#f8fafc" : "#94a3b8",
                          border: `1px solid ${active ? direction === "across" ? "rgba(129,140,248,0.5)" : "rgba(216,180,254,0.45)" : "transparent"}`,
                        }}
                      >
                        {direction} {solvedCount}/{totalCount}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="crossword-clue-panel-scroll overflow-y-auto p-2">
                <div className="grid gap-1">
                  {panelClues.map((clue) => {
                    const key = `${cluePanelDirection}-${clue.number}`;
                    const solved = solvedClues.has(key);
                    const justSolved = justSolvedClues.has(key);
                    const isActive = activeClue?.direction === cluePanelDirection && activeClue.number === clue.number;
                    const activeBorder = cluePanelDirection === "across" ? "rgba(129,140,248,0.55)" : "rgba(216,180,254,0.5)";
                    const activeText = cluePanelDirection === "across" ? "#c7d2fe" : "#e9d5ff";

                    return (
                      <button
                        key={clue.number}
                        type="button"
                        onClick={() => handleClueClick(cluePanelDirection, clue.number)}
                        className={`text-left px-2.5 py-2 rounded-lg text-xs transition-all${justSolved ? " crossword-clue-success" : ""}`}
                        style={{
                          background: isActive ? "rgba(99,102,241,0.18)" : solved ? "rgba(34,197,94,0.1)" : "rgba(15,23,42,0.26)",
                          border: `1px solid ${isActive ? activeBorder : solved ? "rgba(34,197,94,0.3)" : "rgba(148,163,184,0.12)"}`,
                          color: solved ? "#4ade80" : isActive ? activeText : "#cbd5e1",
                          textDecoration: solved ? "line-through" : undefined,
                          overflowWrap: "anywhere",
                          width: "100%",
                          lineHeight: 1.25,
                        }}
                      >
                        <span className="font-black mr-1" style={{ color: solved ? "#4ade80" : isActive ? activeText : "#94a3b8" }}>{clue.number}.</span>
                        {clue.text}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
