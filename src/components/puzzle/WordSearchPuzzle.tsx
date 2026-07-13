"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, useAnimationControls } from "framer-motion";
import { usePuzzleSkin } from "@/hooks/usePuzzleSkin";
import { findWordInGrid, normalizeWordList } from "@/lib/wordSearchCore";
import WordDefinitionModal, { type WordDefinitionData } from "@/components/puzzle/WordDefinitionModal";
import { playSound, isHapticsEnabled } from "@/lib/juice";

const LavaBackground = dynamic(() => import("@/components/LavaBackground"), { ssr: false });
const GalaxyBackground = dynamic(() => import("@/components/GalaxyBackground"), { ssr: false });
const IceBackground = dynamic(() => import("@/components/IceBackground"), { ssr: false });
const NeonBackground = dynamic(() => import("@/components/NeonBackground"), { ssr: false });
const RetroBackground = dynamic(() => import("@/components/RetroBackground"), { ssr: false });

interface Props {
  puzzleId: string;
  wordSearchData: Record<string, unknown>;
  onSolved?: () => void;
  alreadySolved?: boolean;
  warzMode?: boolean;
  /** Daily-puzzle context: suppresses the route's normal point/XP award (the daily
   * completion flow awards its own streak-based reward instead) without disabling
   * autosave/hydrate the way warzMode does. */
  dailyMode?: boolean;
  hintTokens?: number;
  onHintUsed?: () => Promise<boolean>;
}

type CellCoord = { row: number; col: number };

const WORD_COLORS = [
  { bg: "rgba(34,197,94,0.28)", border: "#22c55e", text: "#4ade80" },
  { bg: "rgba(59,130,246,0.28)", border: "#3b82f6", text: "#60a5fa" },
  { bg: "rgba(234,179,8,0.28)", border: "#eab308", text: "#facc15" },
  { bg: "rgba(239,68,68,0.28)", border: "#ef4444", text: "#f87171" },
  { bg: "rgba(168,85,247,0.28)", border: "#a855f7", text: "#c084fc" },
  { bg: "rgba(244,114,182,0.28)", border: "#f472b6", text: "#f9a8d4" },
  { bg: "rgba(20,184,166,0.28)", border: "#14b8a6", text: "#2dd4bf" },
  { bg: "rgba(249,115,22,0.28)", border: "#f97316", text: "#fb923c" },
];

function serializeCoord(c: CellCoord) {
  return `${c.row},${c.col}`;
}

function cellsInLine(from: CellCoord, to: CellCoord): CellCoord[] {
  const dr = to.row - from.row;
  const dc = to.col - from.col;
  if (dr === 0 && dc === 0) return [from];
  const len = Math.max(Math.abs(dr), Math.abs(dc));
  // Only allow straight lines (horizontal, vertical, diagonal)
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return [from];
  const sr = dr === 0 ? 0 : Math.sign(dr);
  const sc = dc === 0 ? 0 : Math.sign(dc);
  return Array.from({ length: len + 1 }, (_, i) => ({
    row: from.row + sr * i,
    col: from.col + sc * i,
  }));
}

function snapDirection(dr: number, dc: number): { dr: number; dc: number } | null {
  if (dr === 0 && dc === 0) return null;
  const octant = Math.round(Math.atan2(dr, dc) / (Math.PI / 4));
  switch (octant) {
    case 0: return { dr: 0, dc: 1 };
    case 1: return { dr: 1, dc: 1 };
    case 2: return { dr: 1, dc: 0 };
    case 3: return { dr: 1, dc: -1 };
    case 4:
    case -4:
      return { dr: 0, dc: -1 };
    case -3: return { dr: -1, dc: -1 };
    case -2: return { dr: -1, dc: 0 };
    case -1: return { dr: -1, dc: 1 };
    default:
      return null;
  }
}

function HowToPlayModal({ onClose, onShowIntro }: { onClose: () => void; onShowIntro: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4"
      onClick={onClose}
    >
      <div
        className="max-w-lg w-full rounded-xl p-6 shadow-2xl"
        style={{ background: "#0f0f1a", border: "1px solid rgba(255,255,255,0.12)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-extrabold" style={{ color: "#FDE74C" }}>How to Play — Word Trove</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none ml-4">✕</button>
        </div>
        <div className="space-y-3 text-sm text-gray-300">
          <p>Find all the words listed to the side of the grid. Each word is hidden in the grid in a straight line.</p>
          <p><strong className="text-white">How to select:</strong> Click and drag across the letters to highlight a word. Works in any direction — horizontal, vertical, or diagonal, and both forwards and backwards.</p>
          <p><strong className="text-white">Finding a word:</strong> When you correctly select a word, it lights up in color and is crossed off the list. Find all words to solve the puzzle.</p>
          <p><strong className="text-white">Hints:</strong> Use a hint token to automatically reveal a random unfound word. Hint tokens can be purchased from the Store.</p>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            onClick={() => { onClose(); onShowIntro(); }}
            className="text-xs font-semibold underline underline-offset-2 transition-opacity hover:opacity-80"
            style={{ color: "#9BD1D6" }}
          >
            🗝️ Why Word Trove?
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: "#FDE74C", color: "#000" }}>Got it</button>
        </div>
      </div>
    </div>
  );
}

function WordTroveIntroModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 px-4"
      onClick={onClose}
    >
      <div
        className="max-w-lg w-full rounded-2xl p-6 shadow-2xl"
        style={{ background: "linear-gradient(160deg, rgba(15,15,26,0.98) 0%, rgba(4,4,8,0.98) 100%)", border: "1px solid rgba(129,140,248,0.35)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <h2
            className="text-xl font-black tracking-tight"
            style={{
              backgroundImage: "linear-gradient(135deg, #818cf8, #c084fc, #f472b6)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
              WebkitTextFillColor: "transparent",
            }}
          >
            🗝️ More Than a Word Search
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none ml-4 shrink-0">✕</button>
        </div>

        <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
          <p>
            Word Trove plays like a normal word search, but finding a word is just the start —
            every one you find pops up its real definition, so each puzzle doubles as a
            chance to pick up new vocabulary.
          </p>
          <p>
            You&apos;ll run into a mix of words. Some will be everyday and familiar — others
            might be new to you. That&apos;s intentional: the less common words are where the
            actual learning happens, not a sign the puzzle is too hard.
          </p>
        </div>

        <div className="mt-4 space-y-2 rounded-xl p-3.5" style={{ background: "rgba(129,140,248,0.08)", border: "1px solid rgba(129,140,248,0.2)" }}>
          <div className="flex items-start gap-2.5 text-xs text-gray-300">
            <span className="text-base leading-none">🔍</span>
            <span>Find a word by dragging across the grid, same as always.</span>
          </div>
          <div className="flex items-start gap-2.5 text-xs text-gray-300">
            <span className="text-base leading-none">📖</span>
            <span>A popup reveals its definition, part of speech, and how to say it.</span>
          </div>
          <div className="flex items-start gap-2.5 text-xs text-gray-300">
            <span className="text-base leading-none">🧠</span>
            <span>Words with thin definitions link out to Merriam-Webster for the full picture.</span>
          </div>
        </div>

        <div className="mt-5 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-bold"
            style={{ background: "linear-gradient(135deg, #818cf8, #c084fc)", color: "#0f0f1a" }}
          >
            Let&apos;s play →
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WordSearchPuzzle({
  puzzleId,
  wordSearchData,
  onSolved,
  alreadySolved,
  warzMode,
  dailyMode,
  hintTokens = 0,
  onHintUsed,
}: Props) {
  const grid = useMemo(() => (wordSearchData.grid ?? []) as string[][], [wordSearchData.grid]);
  const words = useMemo(() => normalizeWordList(wordSearchData.words ?? []), [wordSearchData.words]);
  const gridSize = grid.length || 12;
  const storageKey = `ws-found-${puzzleId}`;

  // Unified init: compute foundWords + their cell positions together
  const [{ foundWords, foundWordCells }, setFoundState] = useState<{
    foundWords: string[];
    foundWordCells: Map<string, CellCoord[]>;
  }>(() => {
    const initialInput: string[] = alreadySolved
      ? [...words]
      : (() => {
          if (typeof window === "undefined") return [];
          try {
            return JSON.parse(localStorage.getItem(storageKey) ?? "[]") as string[];
          } catch {
            return [];
          }
        })();

    const initial = normalizeWordList(initialInput).filter((w) => words.includes(w));

    const map = new Map<string, CellCoord[]>();
    for (const w of initial) {
      const cells = findWordInGrid(w, grid);
      if (cells) map.set(w, cells);
    }
    return { foundWords: initial, foundWordCells: map };
  });

  const [selectedCells, setSelectedCells] = useState<CellCoord[]>([]);
  const [flashWord, setFlashWord] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [gameStatus, setGameStatus] = useState<"playing" | "won">(() =>
    alreadySolved || foundWords.length === words.length ? "won" : "playing"
  );
  const [wsHintCount, setWsHintCount] = useState(0);
  const [isUltraNarrow, setIsUltraNarrow] = useState(false);
  const [showRestoreNotice, setShowRestoreNotice] = useState(false);

  // ── Juice: trail line + shake + pop feedback (purely presentational — none of this
  // touches the drag/selection math above or below it) ──────────────────────────────
  const [trailPoints, setTrailPoints] = useState<{ x: number; y: number }[]>([]);
  const [poppingCells, setPoppingCells] = useState<Set<string>>(new Set());
  const gridShakeControls = useAnimationControls();

  const gridRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<CellCoord | null>(null);
  const isDraggingRef = useRef(false);
  const selectedCellsRef = useRef<CellCoord[]>([]);
  const directionLockRef = useRef<{ dr: number; dc: number } | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const queuedPointRef = useRef<{ x: number; y: number } | null>(null);
  const moveRafRef = useRef<number | null>(null);
  const restoreNoticeTimeoutRef = useRef<number | null>(null);
  const foundWordsRef = useRef<string[]>(foundWords);
  const skin = usePuzzleSkin();
  const [showHelp, setShowHelp] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [definitionModal, setDefinitionModal] = useState<{
    word: string;
    colorIdx: number;
    status: "loading" | "found" | "not-found";
    data?: WordDefinitionData;
  } | null>(null);

  async function revealDefinition(word: string, colorIdx: number) {
    setDefinitionModal({ word, colorIdx, status: "loading" });
    try {
      const res = await fetch(`/api/dictionary/define?word=${encodeURIComponent(word)}`);
      const json = await res.json();
      setDefinitionModal(
        json.found
          ? {
              word,
              colorIdx,
              status: "found",
              data: {
                phonetic: json.phonetic,
                audioUrl: json.audioUrl,
                partOfSpeech: json.partOfSpeech,
                definition: json.definition,
                example: json.example,
              },
            }
          : { word, colorIdx, status: "not-found" }
      );
    } catch {
      setDefinitionModal({ word, colorIdx, status: "not-found" });
    }
  }

  const showRestoredProgressBanner = () => {
    if (restoreNoticeTimeoutRef.current !== null) {
      window.clearTimeout(restoreNoticeTimeoutRef.current);
    }
    setShowRestoreNotice(true);
    restoreNoticeTimeoutRef.current = window.setTimeout(() => {
      setShowRestoreNotice(false);
      restoreNoticeTimeoutRef.current = null;
    }, 2600);
  };

  useEffect(() => {
    return () => {
      if (moveRafRef.current !== null) {
        cancelAnimationFrame(moveRafRef.current);
      }
      if (restoreNoticeTimeoutRef.current !== null) {
        window.clearTimeout(restoreNoticeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    foundWordsRef.current = foundWords;
  }, [foundWords]);

  // First-time intro explaining Word Trove's "find a word, learn its definition" angle —
  // shown once per browser, not on every puzzle, and skipped entirely for a puzzle the
  // player has already solved (nothing left to "start" at that point).
  useEffect(() => {
    if (alreadySolved) return;
    if (typeof window === "undefined") return;
    try {
      if (!localStorage.getItem("wordTroveIntroSeen")) setShowIntro(true);
    } catch {}
  }, [alreadySolved]);

  const dismissIntro = () => {
    setShowIntro(false);
    try {
      localStorage.setItem("wordTroveIntroSeen", "1");
    } catch {}
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 360px)");
    const apply = () => setIsUltraNarrow(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  // Hydrate progress from server so leaving/reloading resumes correctly even without localStorage.
  useEffect(() => {
    if (alreadySolved) return;
    if (!puzzleId) return;

    let cancelled = false;

    const hydrateFromServer = async () => {
      try {
        const resp = await fetch(`/api/puzzles/${puzzleId}/word_search`, { cache: "no-store" });
        if (!resp.ok) return;

        const data = await resp.json();
        const serverFound = normalizeWordList(data?.foundWords ?? []).filter((w) => words.includes(w));
        if (serverFound.length === 0) return;

        if (cancelled) return;

        const hasNewServerProgress = serverFound.some((w) => !foundWordsRef.current.includes(w));
        if (!hasNewServerProgress) return;

        setFoundState((prev) => {
          const mergedWords = Array.from(new Set([...prev.foundWords, ...serverFound]));
          if (mergedWords.length === prev.foundWords.length) {
            return prev;
          }

          const mergedCells = new Map(prev.foundWordCells);

          for (const word of mergedWords) {
            if (mergedCells.has(word)) continue;
            const cells = findWordInGrid(word, grid);
            if (cells) mergedCells.set(word, cells);
          }

          return {
            foundWords: mergedWords,
            foundWordCells: mergedCells,
          };
        });
        showRestoredProgressBanner();

        if (data?.allFound) {
          setGameStatus("won");
        }
      } catch {
        // Non-fatal: localStorage still provides client-side resume fallback.
      }
    };

    hydrateFromServer();

    return () => {
      cancelled = true;
    };
  }, [alreadySolved, puzzleId, words, grid]);

  // Persist found words across page reloads
  useEffect(() => {
    if (!alreadySolved) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(foundWords));
      } catch {}
    }
  }, [foundWords, storageKey, alreadySolved]);

  // Build a coord → color-index map for rendering
  const cellColorMap = new Map<string, number>();
  foundWordCells.forEach((cells, word) => {
    const idx = words.indexOf(word) % WORD_COLORS.length;
    cells.forEach((c) => cellColorMap.set(serializeCoord(c), idx));
  });

  const selectedSet = new Set(selectedCells.map(serializeCoord));

  function setSelection(cells: CellCoord[]) {
    selectedCellsRef.current = cells;
    setSelectedCells(cells);
  }

  // Recompute the connecting trail line's pixel points whenever the selection changes.
  // Cell size is a responsive clamp() rather than a fixed px value, so the centers are
  // measured from the actual rendered cells (same data-ws-row/col hook cellFromPoint uses)
  // instead of derived from CSS math.
  useLayoutEffect(() => {
    const gridEl = gridRef.current;
    if (!gridEl || selectedCells.length < 2) {
      setTrailPoints([]);
      return;
    }
    const gridRect = gridEl.getBoundingClientRect();
    const points = selectedCells.map(({ row, col }) => {
      const cellEl = gridEl.querySelector<HTMLElement>(`[data-ws-row="${row}"][data-ws-col="${col}"]`);
      if (!cellEl) return null;
      const r = cellEl.getBoundingClientRect();
      return { x: r.left - gridRect.left + r.width / 2, y: r.top - gridRect.top + r.height / 2 };
    });
    if (points.some((p) => p === null)) return;
    setTrailPoints(points as { x: number; y: number }[]);
  }, [selectedCells]);

  function triggerHaptic(pattern: number | number[]) {
    if (!isHapticsEnabled()) return; // respect the Settings → Haptic Feedback toggle
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  }

  // Hint: reveal a random unfound word (costs 1 hint token)
  const useWordSearchHint = async () => {
    if (gameStatus !== "playing") return;
    if (hintTokens < 1) return; // button is disabled; guard anyway
    if (onHintUsed) {
      const ok = await onHintUsed();
      if (!ok) return;
    }
    const unfound = words.filter((w) => !foundWords.includes(w));
    if (unfound.length === 0) return;
    const word = unfound[Math.floor(Math.random() * unfound.length)];
    const cells = findWordInGrid(word, grid);
    if (!cells) return;
    setFoundState((prev) => ({
      foundWords: [...prev.foundWords, word],
      foundWordCells: new Map(prev.foundWordCells).set(word, cells),
    }));
    triggerHaptic(12);
    playSound("unlock"); // hint revealed a word
    setFlashWord(word);
    setTimeout(() => setFlashWord(null), 1200);
    setWsHintCount((c) => c + 1);
    revealDefinition(word, words.indexOf(word) % WORD_COLORS.length);
  };

  // ── Drag handlers ───────────────────────────────────────────────────────────

  function startDrag(row: number, col: number) {
    if (gameStatus !== "playing" || submitting) return;
    dragStartRef.current = { row, col };
    isDraggingRef.current = true;
    directionLockRef.current = null;
    setSelection([{ row, col }]);
  }

  function extendDrag(row: number, col: number) {
    const dragStart = dragStartRef.current;
    if (!isDraggingRef.current || !dragStart) return;

    const rawDr = row - dragStart.row;
    const rawDc = col - dragStart.col;
    const lockThresholdReached = Math.max(Math.abs(rawDr), Math.abs(rawDc)) >= 2;
    // Re-derive the snapped direction from the full start→current vector on every move,
    // rather than freezing whatever direction the drag first crossed the threshold at.
    // A one-time freeze meant an early wobble (meaning to go straight but drifting a cell)
    // would permanently lock the wrong diagonal for the rest of the gesture — this way the
    // player can correct course mid-drag, and since the vector is cumulative (not frame-to-
    // frame), it naturally stabilizes as the drag gets longer instead of jittering.
    directionLockRef.current = lockThresholdReached ? snapDirection(rawDr, rawDc) : null;

    const dir = directionLockRef.current;
    if (!dir) {
      setSelection(cellsInLine(dragStart, { row, col }));
      return;
    }

    const maxRowSteps =
      dir.dr > 0
        ? gridSize - 1 - dragStart.row
        : dir.dr < 0
        ? dragStart.row
        : Number.POSITIVE_INFINITY;
    const maxColSteps =
      dir.dc > 0
        ? gridSize - 1 - dragStart.col
        : dir.dc < 0
        ? dragStart.col
        : Number.POSITIVE_INFINITY;
    const maxSteps = Math.min(maxRowSteps, maxColSteps);
    const rawSteps = dir.dr !== 0 ? Math.round(rawDr / dir.dr) : Math.round(rawDc / dir.dc);
    const clampedSteps = Math.max(0, Math.min(maxSteps, rawSteps));
    const lockedTo = {
      row: dragStart.row + dir.dr * clampedSteps,
      col: dragStart.col + dir.dc * clampedSteps,
    };

    setSelection(cellsInLine(dragStart, lockedTo));
  }

  async function endDrag() {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const cells = selectedCellsRef.current;
    setSelection([]);
    dragStartRef.current = null;
    directionLockRef.current = null;

    if (cells.length < 2) return;

    const selWord = cells.map((c) => grid[c.row]?.[c.col] ?? "").join("");
    const revWord = selWord.split("").reverse().join("");
    const matched =
      words.find(
        (w) => (w === selWord || w === revWord) && !foundWords.includes(w)
      ) ?? null;

    if (!matched) {
      triggerHaptic(30);
      playSound("error");
      gridShakeControls.start({
        x: [0, -7, 7, -5, 5, -2, 2, 0],
        transition: { duration: 0.4, ease: "easeOut" },
      });
      return;
    }

    setSubmitting(true);
    const newFoundWords = [...foundWords, matched];
    try {
      const resp = await fetch(`/api/puzzles/${puzzleId}/word_search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: matched,
          cells: cells.map((c) => ({ row: c.row, col: c.col })),
          allFoundWords: newFoundWords,
          ...(warzMode && { warzMode: true }),
          ...(dailyMode && { dailyMode: true }),
        }),
      });
      const data = await resp.json();
      if (data.valid) {
        const canonicalCells = findWordInGrid(matched, grid) ?? cells;
        setFoundState((prev) => ({
          foundWords: newFoundWords,
          foundWordCells: new Map(prev.foundWordCells).set(matched, canonicalCells),
        }));
        triggerHaptic([12, 30, 12]);
        playSound(data.allFound ? "success" : "pop");
        setFlashWord(matched);
        setTimeout(() => setFlashWord(null), 1200);
        const poppedKeys = canonicalCells.map(serializeCoord);
        setPoppingCells((prev) => new Set([...prev, ...poppedKeys]));
        setTimeout(() => {
          setPoppingCells((prev) => {
            const next = new Set(prev);
            poppedKeys.forEach((k) => next.delete(k));
            return next;
          });
        }, 450);
        revealDefinition(matched, words.indexOf(matched) % WORD_COLORS.length);
        if (data.allFound) {
          setGameStatus("won");
          triggerHaptic([20, 40, 20]);
          onSolved?.();
        }
      }
    } catch {}
    setSubmitting(false);
  }

  // ── Pointer helpers ─────────────────────────────────────────────────────────

  function cellFromPoint(x: number, y: number, allowNearest = false): CellCoord | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (el) {
      const r = Number(el.dataset.wsRow);
      const c = Number(el.dataset.wsCol);
      if (!isNaN(r) && !isNaN(c)) {
        return { row: r, col: c };
      }
    }

    const gridEl = gridRef.current;
    if (!gridEl || grid.length === 0) return null;

    const gridRect = gridEl.getBoundingClientRect();
    const hitSlop = 18;
    if (
      x < gridRect.left - hitSlop ||
      x > gridRect.right + hitSlop ||
      y < gridRect.top - hitSlop ||
      y > gridRect.bottom + hitSlop
    ) {
      return null;
    }

    const firstCell = gridEl.querySelector('[data-ws-row="0"][data-ws-col="0"]') as HTMLElement | null;
    if (!firstCell) return null;

    const firstRect = firstCell.getBoundingClientRect();
    const stepX = firstRect.width + 3;
    const stepY = firstRect.height + 3;
    const rawRow = Math.round((y - firstRect.top) / stepY);
    const rawCol = Math.round((x - firstRect.left) / stepX);

    if (!allowNearest) {
      if (rawRow < 0 || rawRow >= grid.length) return null;
      const rowLen = grid[rawRow]?.length ?? 0;
      if (rawCol < 0 || rawCol >= rowLen) return null;
    }

    const clampedRow = Math.max(0, Math.min(grid.length - 1, rawRow));
    const rowLen = grid[clampedRow]?.length ?? gridSize;
    const clampedCol = Math.max(0, Math.min(Math.max(0, rowLen - 1), rawCol));
    return { row: clampedRow, col: clampedCol };
  }

  function queuePointerMove(x: number, y: number) {
    queuedPointRef.current = { x, y };
    if (moveRafRef.current !== null) return;
    moveRafRef.current = requestAnimationFrame(() => {
      moveRafRef.current = null;
      const point = queuedPointRef.current;
      queuedPointRef.current = null;
      if (!point) return;
      const cell = cellFromPoint(point.x, point.y, true);
      if (cell) extendDrag(cell.row, cell.col);
    });
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const cell = cellFromPoint(e.clientX, e.clientY);
    if (!cell) return;
    startDrag(cell.row, cell.col);
    pointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    e.preventDefault();
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== null && e.pointerId !== pointerIdRef.current) return;
    if (!isDraggingRef.current) return;
    e.preventDefault();
    queuePointerMove(e.clientX, e.clientY);
  }

  async function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== null && e.pointerId !== pointerIdRef.current) return;
    if (moveRafRef.current !== null) {
      cancelAnimationFrame(moveRafRef.current);
      moveRafRef.current = null;
    }
    const cell = cellFromPoint(e.clientX, e.clientY, true);
    if (cell) extendDrag(cell.row, cell.col);
    pointerIdRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    await endDrag();
  }

  function handlePointerCancel(e: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== null && e.pointerId !== pointerIdRef.current) return;
    pointerIdRef.current = null;
    isDraggingRef.current = false;
    dragStartRef.current = null;
    directionLockRef.current = null;
    setSelection([]);
  }

  // Responsive cell size: allow tighter cells for larger grids on small screens.
  // Subtracts: grid inner padding (10px*2=20px) + outer container padding (~16px) + cell gaps.
  const minCellPx = gridSize >= 18 ? 10 : gridSize >= 15 ? 12 : 14;
  const viewportCap = gridSize >= 18 ? "98vw" : "96vw";
  const cellSz = `clamp(${minCellPx}px, calc((min(${viewportCap}, 480px) - 36px - ${(gridSize - 1) * 3}px) / ${gridSize}), 40px)`;
  const longestWordLen = words.reduce((max, w) => Math.max(max, w.length), 0);
  const compactWordGrid = isUltraNarrow && words.length >= 10 && longestWordLen <= 14;

  return (
    <>
      {showIntro && <WordTroveIntroModal onClose={dismissIntro} />}
      {showHelp && <HowToPlayModal onClose={() => setShowHelp(false)} onShowIntro={() => setShowIntro(true)} />}
      {definitionModal && (
        <WordDefinitionModal
          word={definitionModal.word}
          color={WORD_COLORS[definitionModal.colorIdx]}
          status={definitionModal.status}
          data={definitionModal.data}
          onDismiss={() => setDefinitionModal(null)}
        />
      )}
      <div
        data-skin={skin._key ?? "default"}
        style={{
          position: "relative",
          borderRadius: "1rem",
          overflow: "hidden",
          width: "100%",
          maxWidth: "100vw",
        }}
      >
        {/* Animated skin backgrounds */}
        {(skin._key === "lava" || skin._key === "skin_lava") && <LavaBackground />}
        {(skin._key === "galaxy" || skin._key === "skin_galaxy") && <GalaxyBackground />}
        {(skin._key === "ice" || skin._key === "skin_ice" || skin._key === "christmas" || skin._key === "skin_christmas") && <IceBackground />}
        {(skin._key === "neon" || skin._key === "skin_neon") && <NeonBackground />}
        {(skin._key === "retro" || skin._key === "skin_retro") && <RetroBackground />}
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
          style={{ position: "relative", zIndex: 1, overflowX: "hidden", fontFamily: skin.tileFontFamily !== "inherit" ? skin.tileFontFamily : "'Clear Sans', 'Helvetica Neue', Arial, sans-serif" }}
      >
        {/* Header */}
        <div className="text-center w-full px-4">
          <h2
            className="text-2xl sm:text-3xl font-black tracking-[0.2em] mb-1"
            style={{
              backgroundImage: "linear-gradient(135deg, #818cf8, #c084fc, #f472b6)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 12px rgba(129,140,248,0.4))",
            }}
          >
            WORD TROVE
          </h2>
          <p className="text-xs font-medium" style={{ color: "#e2e8f0", textShadow: "0 1px 6px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.9)" }}>
            {foundWords.length} / {words.length} words found
          </p>
          {showRestoreNotice && (
            <div
              className="mt-2 inline-flex items-center rounded-md px-3 py-1 text-[11px] font-semibold"
              style={{
                background: "rgba(34,197,94,0.14)",
                border: "1px solid rgba(34,197,94,0.45)",
                color: "#86efac",
                textShadow: "none",
              }}
            >
              Progress restored from your last session
            </div>
          )}
        </div>

        {gameStatus === "won" && (
          <div
            className="px-6 py-3 rounded-xl font-bold text-lg text-center"
            style={{
              background: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(34,197,94,0.5)",
              color: "#4ade80",
            }}
          >
            🎉 All {words.length} words found!
          </div>
        )}

        {/* Grid + word list */}
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-start w-full max-w-2xl px-1 sm:px-2">
          {/* Letter grid */}
          <motion.div
            ref={gridRef}
            animate={gridShakeControls}
            className="flex-shrink-0 mx-auto sm:mx-0"
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: 3,
              touchAction: "none",
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              borderRadius: "0.75rem",
              padding: "10px",
              width: "fit-content",
              maxWidth: "100%",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
          >
            {/* Connecting trail line — a smooth stroke through the letters you're
                currently dragging across, redrawn every time the selection changes. */}
            {trailPoints.length > 1 && (
              <svg
                className="pointer-events-none"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", zIndex: 1 }}
              >
                <motion.polyline
                  points={trailPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke={skin.boardBorder}
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ filter: `drop-shadow(0 0 6px ${skin.boardBorder})` }}
                  initial={false}
                  animate={{ opacity: 0.85 }}
                />
              </svg>
            )}

            {grid.map((row, ri) => (
              <div key={ri} style={{ display: "flex", gap: 3 }}>
                {row.map((letter, ci) => {
                  const key = serializeCoord({ row: ri, col: ci });
                  const colorIdx = cellColorMap.get(key);
                  const isSelected = selectedSet.has(key);
                  const isFound = colorIdx !== undefined;
                  const isPopping = poppingCells.has(key);
                  const color = isFound ? WORD_COLORS[colorIdx] : null;

                  return (
                    <motion.div
                      key={ci}
                      data-ws-row={ri}
                      data-ws-col={ci}
                      className="flex items-center justify-center font-black rounded"
                      animate={{
                        scale: isPopping ? [1, 1.35, 1] : isSelected ? 1.14 : 1,
                        y: isSelected ? -3 : 0,
                      }}
                      transition={
                        isPopping
                          ? { duration: 0.45, ease: "easeOut", times: [0, 0.4, 1] }
                          : { type: "spring", stiffness: 500, damping: 22 }
                      }
                      style={{
                        position: "relative",
                        zIndex: 2,
                        width: cellSz,
                        height: cellSz,
                        fontSize: `clamp(0.45rem, 2.4vw, 0.875rem)`,
                        cursor: gameStatus === "playing" ? "crosshair" : "default",
                        background: isSelected
                          ? skin.accentActive
                          : isFound
                          ? color!.bg
                          : skin.tileBg,
                        border: isSelected
                          ? `2px solid ${skin.boardBorder}`
                          : isFound
                          ? `2px solid ${color!.border}`
                          : `2px solid ${skin.tileBorder}`,
                        color: isSelected
                          ? "#ffffff"
                          : isFound
                          ? color!.text
                          : skin.tileText,
                        boxShadow: isSelected
                          ? `0 4px 14px -2px ${skin.boardBorder}, 0 0 0 3px ${skin.boardBorder}40`
                          : isFound
                          ? `0 0 6px ${color!.border}40`
                          : "none",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                      }}
                    >
                      {letter}
                    </motion.div>
                  );
                })}
              </div>
            ))}
          </motion.div>

          {/* Word list */}
          <div className="w-full sm:w-auto flex-1 flex flex-col gap-1.5 sm:gap-2 sm:min-w-[100px]">
            <p
              className="w-full text-[11px] sm:text-xs font-semibold tracking-[0.12em] mb-1"
              style={{ color: "#cbd5e1", textShadow: "0 1px 6px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.9)" }}
            >
              FIND THESE WORDS
            </p>
            <div
              className={compactWordGrid ? "w-full grid grid-cols-2 gap-1.5 sm:grid-cols-1 sm:gap-2" : "w-full flex flex-wrap sm:flex-col gap-1.5 sm:gap-2"}
            >
              {words.map((word, wi) => {
                const found = foundWords.includes(word);
                const colorIdx = wi % WORD_COLORS.length;
                const color = found ? WORD_COLORS[colorIdx] : null;
                const isFlashing = flashWord === word;

                return (
                  <motion.div
                    key={word}
                    className="px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-md sm:rounded-lg text-[11px] sm:text-sm font-semibold leading-tight"
                    animate={{ scale: isFlashing ? [1, 1.22, 1.06] : 1 }}
                    transition={
                      isFlashing
                        ? { duration: 0.4, ease: "easeOut", times: [0, 0.4, 1] }
                        : { type: "spring", stiffness: 420, damping: 14 }
                    }
                    style={{
                      width: compactWordGrid ? "100%" : undefined,
                      textAlign: compactWordGrid ? "center" : "left",
                      background: found ? color!.bg : skin.tileBg,
                      border: `1px solid ${found ? color!.border : "rgba(148,163,184,0.4)"}`,
                      color: found ? color!.text : "#cbd5e1",
                      textDecoration: found ? "line-through" : "none",
                      boxShadow: isFlashing ? `0 0 14px ${color!.border}` : "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {word}
                  </motion.div>
                );
              })}
            </div>
            {gameStatus === "playing" && (
              <>
                <button
                  onClick={useWordSearchHint}
                  disabled={hintTokens < 1}
                  className="w-full px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: hintTokens < 1 ? "rgba(255,107,107,0.1)" : "rgba(56,145,166,0.15)",
                    border: `1px solid ${hintTokens < 1 ? "rgba(255,107,107,0.5)" : "rgba(56,145,166,0.4)"}`,
                    color: hintTokens < 1 ? "#FF6B6B" : "#3891A6",
                  }}
                  title={hintTokens < 1 ? "No hint tokens — purchase from the Store" : `Use 1 hint token (${hintTokens} remaining)`}
                >
                  💡 {hintTokens < 1 ? "No Hint Tokens" : `Hint (${hintTokens} hint token${hintTokens !== 1 ? "s" : ""})`}{wsHintCount > 0 ? ` · used ${wsHintCount}` : ""}
                </button>
                {hintTokens < 1 && (
                  <a
                    href="/store"
                    className="block text-center text-xs font-semibold underline transition-opacity hover:opacity-80"
                    style={{ color: "#FDE74C" }}
                  >
                    Buy tokens →
                  </a>
                )}
</>
            )}
            <button
              onClick={() => setShowHelp(true)}
              className="w-full px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
              style={{ background: "rgba(253,231,76,0.08)", border: "1px solid rgba(253,231,76,0.3)", color: "#FDE74C" }}
            >
              ? How to play
            </button>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
