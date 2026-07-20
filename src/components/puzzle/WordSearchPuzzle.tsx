"use client";

import dynamic from "next/dynamic";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { usePuzzleSkin } from "@/hooks/usePuzzleSkin";
import {
  normalizePlayableWordSearch,
  normalizeWordList,
  snapWordSearchDirection,
  wordSearchCellsInLine,
  type WordSearchCell,
} from "@/lib/wordSearchCore";
import WordDefinitionModal, { type WordDefinitionData } from "@/components/puzzle/WordDefinitionModal";
import WordSearchControls from "@/components/puzzle/word-search/WordSearchControls";
import WordSearchWordDock from "@/components/puzzle/word-search/WordSearchWordDock";
import WordSearchWordList, { WordSearchDesktopWordList } from "@/components/puzzle/word-search/WordSearchWordList";
import { isHapticsEnabled, prefersReducedMotion } from "@/lib/juice";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import {
  restoreWordSearchProgress,
  wordSearchStorageKey,
  type WordSearchPersistenceScope,
} from "@/lib/wordSearchPersistence";

const LavaBackground = dynamic(() => import("@/components/LavaBackground"), { ssr: false });
const GalaxyBackground = dynamic(() => import("@/components/GalaxyBackground"), { ssr: false });
const IceBackground = dynamic(() => import("@/components/IceBackground"), { ssr: false });
const NeonBackground = dynamic(() => import("@/components/NeonBackground"), { ssr: false });
const RetroBackground = dynamic(() => import("@/components/RetroBackground"), { ssr: false });

export type WordSearchStatus = "loading" | "playing" | "completing" | "completion-pending" | "won" | "error";

export interface WordSearchPresentationState {
  status: WordSearchStatus;
  foundCount: number;
  totalWords: number;
  selectionLength: number;
  selectedText: string;
  wordListOpen: boolean;
  definitionOpen: boolean;
  hintPending: boolean;
}

export interface WordSearchPuzzleHandle {
  openInstructions(): void;
  focusBoard(): void;
  openWordList(): void;
  closeWordList(): void;
  requestHint(): void;
}

export interface WordSearchCompletionResult {
  success: boolean;
  error?: string;
}

interface Props {
  puzzleId: string;
  wordSearchData: Record<string, unknown>;
  onSolved?: () => void | Promise<void>;
  onComplete?: () => Promise<WordSearchCompletionResult>;
  onPresentationChange?: (state: WordSearchPresentationState) => void;
  displayMode?: "standalone" | "app-shell";
  alreadySolved?: boolean;
  warzMode?: boolean;
  dailyMode?: boolean;
  persistenceScope?: WordSearchPersistenceScope;
  dailyDayNumber?: number;
  puzzleInstanceId?: string;
  hintTokens?: number;
  onHintUsed?: () => Promise<boolean>;
}

type DefinitionState = {
  word: string;
  colorIdx: number;
  status: "loading" | "found" | "not-found";
  data?: WordDefinitionData;
  final?: boolean;
};

const WORD_COLORS = [
  { bg: "rgba(34,197,94,.28)", border: "#22c55e", text: "#86efac" },
  { bg: "rgba(59,130,246,.28)", border: "#3b82f6", text: "#93c5fd" },
  { bg: "rgba(234,179,8,.28)", border: "#eab308", text: "#fde047" },
  { bg: "rgba(239,68,68,.28)", border: "#ef4444", text: "#fca5a5" },
  { bg: "rgba(168,85,247,.28)", border: "#a855f7", text: "#d8b4fe" },
  { bg: "rgba(244,114,182,.28)", border: "#f472b6", text: "#fbcfe8" },
  { bg: "rgba(20,184,166,.28)", border: "#14b8a6", text: "#5eead4" },
  { bg: "rgba(249,115,22,.28)", border: "#f97316", text: "#fdba74" },
];

const keyOf = ({ row, col }: WordSearchCell) => `${row},${col}`;
const sameCell = (a: WordSearchCell | null, b: WordSearchCell) => Boolean(a && a.row === b.row && a.col === b.col);

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const returnRef = useRef<HTMLElement | null>(null);
  useBodyScrollLock();
  useEffect(() => {
    returnRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => ref.current?.focus());
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || !ref.current) return;
      const focusable = Array.from(ref.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)?.focus(); }
      if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
    };
    addEventListener("keydown", key);
    return () => { cancelAnimationFrame(frame); removeEventListener("keydown", key); returnRef.current?.focus(); };
  }, [onClose]);
  return (
    <div className="word-search-dialog-layer" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="word-search-dialog">
        <header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="Close">×</button></header>
        {children}
      </div>
    </div>
  );
}

const WordSearchPuzzleInner = forwardRef<WordSearchPuzzleHandle, Props>(function WordSearchPuzzleInner({
  puzzleId,
  wordSearchData,
  onSolved,
  onComplete,
  onPresentationChange,
  displayMode = "standalone",
  alreadySolved = false,
  warzMode = false,
  dailyMode = false,
  persistenceScope,
  dailyDayNumber,
  hintTokens = 0,
  onHintUsed,
}, ref) {
  const normalized = useMemo(() => normalizePlayableWordSearch(wordSearchData.grid, wordSearchData.words), [wordSearchData.grid, wordSearchData.words]);
  const { grid, words, placements, signature } = normalized;
  const size = grid.length;
  const effectiveScope = persistenceScope ?? (warzMode ? "none" : dailyMode ? "daily" : "catalog");
  const storageKey = wordSearchStorageKey(effectiveScope, puzzleId, dailyDayNumber);
  const skin = usePuzzleSkin();
  const reduceMotion = Boolean(useReducedMotion() || prefersReducedMotion());
  const boardRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const desktopListRef = useRef<HTMLElement>(null);
  const pointerRef = useRef<number | null>(null);
  const dragStartRef = useRef<WordSearchCell | null>(null);
  const draggingRef = useRef(false);
  const selectionRef = useRef<WordSearchCell[]>([]);
  const directionRef = useRef<{ dr: number; dc: number } | null>(null);
  const queuedPointRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const geometryRef = useRef<{ board: DOMRect; cells: Map<string, DOMRect> } | null>(null);
  const foundRef = useRef<string[]>([]);
  const completionRef = useRef(false);
  const completionRecordedRef = useRef(false);
  const catalogCompletionCommittedRef = useRef(false);
  const completionHandoffPendingRef = useRef(false);
  const finalDefinitionPendingRef = useRef(false);
  const solvedHandoffRef = useRef(false);
  const hintRef = useRef(false);
  const activeCellRef = useRef<WordSearchCell>({ row: 0, col: 0 });
  const keyboardSelectingRef = useRef(false);
  const tapStartRef = useRef<WordSearchCell | null>(null);
  const lastPresentationRef = useRef("");
  const definitionQueueRef = useRef<DefinitionState[]>([]);
  const definitionRef = useRef<DefinitionState | null>(null);
  const gridShake = useAnimationControls();

  const restore = useMemo(() => restoreWordSearchProgress({
    storage: typeof window === "undefined" ? null : localStorage,
    scope: effectiveScope,
    puzzleId,
    dailyDayNumber,
    signature,
    placeableWords: words,
    alreadySolved,
  }), [alreadySolved, dailyDayNumber, effectiveScope, puzzleId, signature, words]);

  const [foundWords, setFoundWords] = useState<string[]>(restore.found);
  const [hintedWords, setHintedWords] = useState<Set<string>>(new Set(restore.hinted));
  const [selection, setSelectionState] = useState<WordSearchCell[]>([]);
  const [tapAnchor, setTapAnchor] = useState<WordSearchCell | null>(null);
  const [activeCell, setActiveCell] = useState<WordSearchCell>({ row: 0, col: 0 });
  const [status, setStatus] = useState<WordSearchStatus>(() => !size || !words.length ? "error" : "loading");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hintPending, setHintPending] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [wordListOpen, setWordListOpen] = useState(false);
  const [definition, setDefinition] = useState<DefinitionState | null>(null);
  const [flashWord, setFlashWord] = useState<string | null>(null);
  const [poppingCells, setPoppingCells] = useState<Set<string>>(new Set());
  const [trail, setTrail] = useState<Array<{ x: number; y: number }>>([]);
  const [zoom, setZoom] = useState(1);
  const [pageVisible, setPageVisible] = useState(true);
  const [catalogLoadAttempt, setCatalogLoadAttempt] = useState(0);
  const [geometryVersion, setGeometryVersion] = useState(0);

  foundRef.current = foundWords;
  definitionRef.current = definition;
  const foundSet = useMemo(() => new Set(foundWords), [foundWords]);
  const selectedSet = useMemo(() => new Set(selection.map(keyOf)), [selection]);
  const selectedText = selection.map(({ row, col }) => grid[row]?.[col] ?? "").join("");

  const setSelection = useCallback((cells: WordSearchCell[]) => {
    selectionRef.current = cells;
    setSelectionState(cells);
  }, []);

  const measureBoard = useCallback(() => {
    const board = boardRef.current;
    const viewport = viewportRef.current;
    if (!board || !viewport || !size) return;
    const gap = size >= 18 ? 1 : 2;
    let cell: number;
    if (typeof window !== "undefined" && window.innerWidth < 540) {
      const boardChrome = 6 + 6 + 1 + 1; // board's left/right padding + left/right border
      const available = Math.max(180, viewport.clientWidth);
      cell = Math.max(12, Math.floor((available - boardChrome - gap * (size - 1)) / size));
    } else {
      const available = Math.max(180, Math.min(viewport.clientWidth, viewport.clientHeight || viewport.clientWidth));
      const padding = 12;
      cell = Math.max(size > 18 ? 24 : 14, Math.floor((available - padding * 2 - gap * (size - 1)) / size));
    }
    board.style.setProperty("--word-search-cell", `${cell}px`);
    board.style.setProperty("--word-search-gap", `${gap}px`);
    const cells = new Map<string, DOMRect>();
    board.querySelectorAll<HTMLElement>("[data-ws-row]").forEach((element) => cells.set(`${element.dataset.wsRow},${element.dataset.wsCol}`, element.getBoundingClientRect()));
    geometryRef.current = { board: board.getBoundingClientRect(), cells };
    setGeometryVersion((value) => value + 1);
  }, [size]);

  useLayoutEffect(() => {
    measureBoard();
    const observer = new ResizeObserver(measureBoard);
    if (viewportRef.current) observer.observe(viewportRef.current);
    if (boardRef.current) observer.observe(boardRef.current);
    const viewport = viewportRef.current;
    viewport?.addEventListener("scroll", measureBoard, { passive: true });
    return () => {
      observer.disconnect();
      viewport?.removeEventListener("scroll", measureBoard);
    };
  }, [measureBoard]);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(measureBoard);
    return () => cancelAnimationFrame(frame);
  }, [measureBoard, zoom]);

  useLayoutEffect(() => {
    const geometry = geometryRef.current;
    if (!geometry || selection.length < 2) { setTrail([]); return; }
    setTrail(selection.flatMap((cell) => {
      const rect = geometry.cells.get(keyOf(cell));
      return rect ? [{
        x: (rect.left - geometry.board.left + rect.width / 2) / zoom,
        y: (rect.top - geometry.board.top + rect.height / 2) / zoom,
      }] : [];
    }));
  }, [geometryVersion, selection, zoom]);

  useEffect(() => {
    if (alreadySolved || effectiveScope === "none" || typeof window === "undefined") return;
    try { if (!localStorage.getItem("wordTroveIntroSeen")) setShowIntro(true); } catch {}
  }, [alreadySolved, effectiveScope]);

  useEffect(() => {
    const updateVisibility = () => setPageVisible(document.visibilityState !== "hidden");
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    if (status !== "loading") return;
    if (effectiveScope === "catalog") return;
    if (alreadySolved && effectiveScope !== "none") {
      setStatus("won");
      return;
    }
    if (effectiveScope === "daily" && foundWords.length === words.length) {
      completionHandoffPendingRef.current = true;
      completionRecordedRef.current = false;
      completionRef.current = false;
      solvedHandoffRef.current = false;
      setError("All words are restored. Retry Completion to record today's result.");
      setStatus("completion-pending");
      return;
    }
    setStatus("playing");
  }, [alreadySolved, effectiveScope, foundWords.length, status, words.length]);

  useEffect(() => {
    if (alreadySolved || !storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ version: 3, signature, foundWords, hintedWords: [...hintedWords] })); } catch {}
  }, [alreadySolved, foundWords, hintedWords, signature, storageKey]);

  useEffect(() => {
    if (effectiveScope !== "catalog" || !puzzleId) return;
    let cancelled = false;
    void fetch(`/api/puzzles/${puzzleId}/word_search`, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Progress could not be restored.");
      const data = await response.json();
      const server = normalizeWordList(data.foundWords ?? []).filter((word) => placements.has(word));
      if (cancelled) return;
      // A successful catalog read is authoritative. Local state remains the
      // offline fallback, but cannot claim words the server has not validated.
      setFoundWords(server);
      setHintedWords((previous) => new Set([...previous].filter((word) => server.includes(word))));
      setError("");
      if (data.repairRequired) {
        catalogCompletionCommittedRef.current = false;
        completionRef.current = false;
        completionRecordedRef.current = false;
        completionHandoffPendingRef.current = true;
        finalDefinitionPendingRef.current = false;
        solvedHandoffRef.current = false;
        setError("Every word is saved, but completion still needs to be committed.");
        setStatus("completion-pending");
      } else if (data.allFound) {
        catalogCompletionCommittedRef.current = true;
        completionRecordedRef.current = true;
        solvedHandoffRef.current = true;
        setStatus("won");
      } else {
        catalogCompletionCommittedRef.current = false;
        completionRef.current = false;
        completionRecordedRef.current = false;
        completionHandoffPendingRef.current = false;
        finalDefinitionPendingRef.current = false;
        solvedHandoffRef.current = false;
        setStatus("playing");
      }
    }).catch((cause) => {
      if (cancelled) return;
      setError(cause instanceof Error ? cause.message : "Progress could not be restored.");
      setStatus("error");
    });
    return () => { cancelled = true; };
  }, [catalogLoadAttempt, effectiveScope, placements, puzzleId]);

  useEffect(() => {
    const state: WordSearchPresentationState = { status, foundCount: foundWords.length, totalWords: words.length, selectionLength: selection.length, selectedText, wordListOpen, definitionOpen: Boolean(definition), hintPending };
    const signatureValue = JSON.stringify(state);
    if (signatureValue !== lastPresentationRef.current) {
      lastPresentationRef.current = signatureValue;
      onPresentationChange?.(state);
    }
  }, [definition, foundWords.length, hintPending, onPresentationChange, selectedText, selection.length, status, wordListOpen, words.length]);

  const haptic = useCallback((pattern: number | number[]) => {
    if (isHapticsEnabled() && typeof navigator.vibrate === "function") navigator.vibrate(pattern);
  }, []);

  const fetchDefinition = useCallback(async (word: string, colorIdx: number): Promise<DefinitionState> => {
    try {
      const response = await fetch(`/api/dictionary/define?word=${encodeURIComponent(word)}`);
      const json = await response.json();
      return json.found ? { word, colorIdx, status: "found", data: { phonetic: json.phonetic, audioUrl: json.audioUrl, partOfSpeech: json.partOfSpeech, definition: json.definition, example: json.example } } : { word, colorIdx, status: "not-found" };
    } catch { return { word, colorIdx, status: "not-found" }; }
  }, []);

  const showNextDefinition = useCallback(() => {
    if (definitionRef.current) return;
    const next = definitionQueueRef.current.shift();
    if (!next) return;
    definitionRef.current = next;
    setDefinition(next);
  }, []);

  const queueDefinition = useCallback((word: string, final = false) => {
    const colorIdx = words.indexOf(word) % WORD_COLORS.length;
    const pending: DefinitionState = { word, colorIdx, status: "loading", final };
    definitionQueueRef.current.push(pending);
    window.setTimeout(showNextDefinition, reduceMotion ? 0 : final ? 520 : 320);
    void fetchDefinition(word, colorIdx).then((result) => {
      const resolved = { ...result, final };
      const queuedIndex = definitionQueueRef.current.indexOf(pending);
      if (queuedIndex >= 0) definitionQueueRef.current[queuedIndex] = resolved;
      if (definitionRef.current === pending) {
        definitionRef.current = resolved;
        setDefinition(resolved);
      }
    });
  }, [fetchDefinition, reduceMotion, showNextDefinition, words]);

  const openDefinition = useCallback((word: string) => {
    if (!foundRef.current.includes(word)) return;
    const pending: DefinitionState = { word, colorIdx: words.indexOf(word) % WORD_COLORS.length, status: "loading" };
    definitionRef.current = pending;
    setDefinition(pending);
    void fetchDefinition(word, pending.colorIdx).then((resolved) => {
      if (definitionRef.current !== pending) return;
      definitionRef.current = resolved;
      setDefinition(resolved);
    });
  }, [fetchDefinition, words]);

  const celebrateWord = useCallback((word: string, cells: WordSearchCell[], hinted = false, final = false) => {
    setFoundWords((previous) => previous.includes(word) ? previous : [...previous, word]);
    if (hinted) setHintedWords((previous) => new Set(previous).add(word));
    if (final) finalDefinitionPendingRef.current = true;
    haptic([12, 30, 12]);
    setFlashWord(word);
    const keys = cells.map(keyOf);
    setPoppingCells((previous) => new Set([...previous, ...keys]));
    window.setTimeout(() => { setFlashWord(null); setPoppingCells((previous) => { const next = new Set(previous); keys.forEach((key) => next.delete(key)); return next; }); }, reduceMotion ? 80 : 500);
    // A competitive Warz round must never be interrupted by the definition modal — it fully
    // covers the board and blocks the next selection, which would cost real time in a timed
    // match. Outside Warz, only the final word opens automatically — earlier finds stay
    // available on demand via openDefinition (tapping the word in the word list) so a run of
    // quick finds doesn't force a sequence of full-screen interruptions.
    if (!warzMode && final) queueDefinition(word, final);
  }, [haptic, queueDefinition, reduceMotion, warzMode]);

  const finishCompletionHandoff = useCallback(async () => {
    if (!onComplete || completionRef.current) return;
    completionRef.current = true;
    setStatus("completing");
    setError("");
    try {
      if (effectiveScope === "catalog" && !catalogCompletionCommittedRef.current) {
        const response = await fetch(`/api/puzzles/${puzzleId}/word_search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reconcile_completion" }),
        });
        const reconciliation = await response.json();
        if (!response.ok || !reconciliation.completionCommitted) {
          throw new Error(reconciliation.error || "Completion could not be committed.");
        }
        catalogCompletionCommittedRef.current = true;
      }
      const result = await onComplete();
      if (!result.success) {
        setStatus("completion-pending");
        setError(result.error || "Completion could not be recorded.");
        completionRef.current = false;
        return;
      }
      completionRecordedRef.current = true;
      completionHandoffPendingRef.current = false;
      completionRef.current = false;
      if (finalDefinitionPendingRef.current) return;
      if (solvedHandoffRef.current) return;
      solvedHandoffRef.current = true;
      setStatus("won");
      await onSolved?.();
    } catch {
      setStatus("completion-pending"); setError("Completion could not be recorded. Check your connection and retry."); completionRef.current = false;
    }
  }, [effectiveScope, onComplete, onSolved, puzzleId]);

  const dismissDefinition = useCallback(() => {
    const wasFinal = Boolean(definition?.final);
    definitionRef.current = null;
    setDefinition(null);
    if (wasFinal) {
      finalDefinitionPendingRef.current = false;
      if (completionRecordedRef.current && !solvedHandoffRef.current) {
        solvedHandoffRef.current = true;
        setStatus("won");
        void onSolved?.();
      } else if (completionHandoffPendingRef.current && !dailyMode) {
        void finishCompletionHandoff();
      }
    }
    requestAnimationFrame(showNextDefinition);
  }, [dailyMode, definition?.final, finishCompletionHandoff, onSolved, showNextDefinition]);

  const submitSelection = useCallback(async (cells: WordSearchCell[]) => {
    if (cells.length < 2 || status !== "playing" || submitting) return;
    const forward = cells.map(({ row, col }) => grid[row]?.[col] ?? "").join("");
    const reverse = [...forward].reverse().join("");
    const word = words.find((item) => !foundRef.current.includes(item) && (item === forward || item === reverse));
    if (!word) {
      haptic(30);
      void gridShake.start(reduceMotion ? { opacity: [1, .6, 1], transition: { duration: .16 } } : { x: [0, -6, 6, -3, 3, 0], transition: { duration: .28 } });
      return;
    }
    const nextWords = [...foundRef.current, word];
    const canonicalCells = placements.get(word) ?? cells;
    if (warzMode) {
      celebrateWord(word, canonicalCells);
      if (nextWords.length === words.length) { setStatus("won"); onSolved?.(); }
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/puzzles/${puzzleId}/word_search`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ word, cells, allFoundWords: nextWords, ...(dailyMode && { dailyMode: true }) }) });
      const data = await response.json();
      if (!response.ok || !data.valid) throw new Error(data.error || "That word could not be saved.");
      if (!dailyMode && (!data.persisted || (data.allFound && !data.completionCommitted))) {
        throw new Error("That word could not be durably saved. Please try it again.");
      }
      if (!dailyMode && data.completionCommitted) catalogCompletionCommittedRef.current = true;
      celebrateWord(word, canonicalCells, false, Boolean(data.allFound));
      if (data.allFound) {
        completionHandoffPendingRef.current = true;
        setStatus("completing");
        if (dailyMode) await finishCompletionHandoff();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That word could not be saved.");
    } finally { setSubmitting(false); }
  }, [celebrateWord, dailyMode, finishCompletionHandoff, grid, gridShake, haptic, onSolved, placements, puzzleId, reduceMotion, status, submitting, warzMode, words]);

  const requestHint = useCallback(async () => {
    if (status !== "playing" || hintRef.current || hintTokens < 1) return;
    const candidates = words.filter((word) => !foundRef.current.includes(word) && placements.has(word));
    if (!candidates.length) { setError("No placeable words remain for a hint."); return; }
    hintRef.current = true;
    setHintPending(true);
    setError("");
    try {
      if (onHintUsed && !(await onHintUsed())) return;
      const word = candidates[Math.floor(Math.random() * candidates.length)];
      const cells = placements.get(word);
      if (!cells) { setError("The hinted word could not be located."); return; }
      if (warzMode) celebrateWord(word, cells, true);
      else {
        const nextWords = [...foundRef.current, word];
        const response = await fetch(`/api/puzzles/${puzzleId}/word_search`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ word, cells, allFoundWords: nextWords, ...(dailyMode && { dailyMode: true }) }) });
        const data = await response.json();
        if (!response.ok || !data.valid) throw new Error(data.error || "The hint was consumed, but the word could not be saved.");
        if (!dailyMode && (!data.persisted || (data.allFound && !data.completionCommitted))) {
          throw new Error("The hinted word could not be durably saved. Please retry it.");
        }
        if (!dailyMode && data.completionCommitted) catalogCompletionCommittedRef.current = true;
        celebrateWord(word, cells, true, Boolean(data.allFound));
        if (data.allFound) {
          completionHandoffPendingRef.current = true;
          setStatus("completing");
          if (dailyMode) await finishCompletionHandoff();
        }
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The hint could not be applied."); }
    finally { hintRef.current = false; setHintPending(false); }
  }, [celebrateWord, dailyMode, finishCompletionHandoff, hintTokens, onHintUsed, placements, puzzleId, status, warzMode, words]);

  const focusBoard = useCallback(() => {
    (boardRef.current?.querySelector<HTMLElement>('[data-active="true"]') ?? boardRef.current)?.focus();
  }, []);

  const openAppropriateWordList = useCallback(() => {
    const desktopList = desktopListRef.current;
    if (desktopList && desktopList.getClientRects().length > 0 && getComputedStyle(desktopList).display !== "none") {
      desktopList.focus();
      return;
    }
    setWordListOpen(true);
  }, []);

  useImperativeHandle(ref, () => ({
    openInstructions: () => setShowHelp(true),
    focusBoard,
    openWordList: openAppropriateWordList,
    closeWordList: () => setWordListOpen(false),
    requestHint: () => { void requestHint(); },
  }), [focusBoard, openAppropriateWordList, requestHint]);

  const cellFromPoint = useCallback((x: number, y: number, nearest = false): WordSearchCell | null => {
    const geometry = geometryRef.current;
    if (!geometry) return null;
    let best: { cell: WordSearchCell; distance: number } | null = null;
    geometry.cells.forEach((rect, key) => {
      const [row, col] = key.split(",").map(Number);
      const dx = Math.max(rect.left - x, 0, x - rect.right);
      const dy = Math.max(rect.top - y, 0, y - rect.bottom);
      const distance = Math.hypot(dx, dy);
      if (!best || distance < best.distance) best = { cell: { row, col }, distance };
    });
    const hit = best as { cell: WordSearchCell; distance: number } | null;
    return hit && hit.distance <= (nearest ? 24 : 12) ? hit.cell : null;
  }, []);

  const extendDrag = useCallback((cell: WordSearchCell) => {
    const start = dragStartRef.current;
    if (!start || !draggingRef.current) return;
    const dr = cell.row - start.row, dc = cell.col - start.col;
    directionRef.current = Math.max(Math.abs(dr), Math.abs(dc)) >= 2 ? snapWordSearchDirection(dr, dc) : null;
    const direction = directionRef.current;
    if (!direction) { setSelection(wordSearchCellsInLine(start, cell)); return; }
    const maxRowSteps = direction.dr > 0 ? size - 1 - start.row : direction.dr < 0 ? start.row : Number.POSITIVE_INFINITY;
    const columns = grid[0]?.length ?? size;
    const maxColSteps = direction.dc > 0 ? columns - 1 - start.col : direction.dc < 0 ? start.col : Number.POSITIVE_INFINITY;
    const rawSteps = direction.dr !== 0 ? Math.round(dr / direction.dr) : Math.round(dc / direction.dc);
    const steps = Math.max(0, Math.min(maxRowSteps, maxColSteps, rawSteps));
    const target = { row: start.row + direction.dr * steps, col: start.col + direction.dc * steps };
    setSelection(wordSearchCellsInLine(start, target));
  }, [grid, setSelection, size]);

  const cancelSelection = useCallback(() => {
    draggingRef.current = false; dragStartRef.current = null; tapStartRef.current = null; directionRef.current = null; pointerRef.current = null; setSelection([]); setTapAnchor(null); keyboardSelectingRef.current = false;
  }, [setSelection]);

  const lineToTappedCell = useCallback((tapStart: WordSearchCell, tapped: WordSearchCell) => {
    const dr = tapped.row - tapStart.row, dc = tapped.col - tapStart.col;
    const direction = snapWordSearchDirection(dr, dc);
    const columns = grid[0]?.length ?? size;
    const maxRowSteps = direction?.dr ? (direction.dr > 0 ? size - 1 - tapStart.row : tapStart.row) : Number.POSITIVE_INFINITY;
    const maxColSteps = direction?.dc ? (direction.dc > 0 ? columns - 1 - tapStart.col : tapStart.col) : Number.POSITIVE_INFINITY;
    const steps = Math.max(0, Math.min(maxRowSteps, maxColSteps, Math.max(Math.abs(dr), Math.abs(dc))));
    const tapEnd = direction ? { row: tapStart.row + direction.dr * steps, col: tapStart.col + direction.dc * steps } : tapped;
    return wordSearchCellsInLine(tapStart, tapEnd);
  }, [grid, size]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (pointerRef.current !== null && pointerRef.current !== event.pointerId) { cancelSelection(); return; }
    const cell = cellFromPoint(event.clientX, event.clientY);
    if (!cell || status !== "playing" || submitting) return;
    pointerRef.current = event.pointerId; dragStartRef.current = tapStartRef.current ?? cell; draggingRef.current = true; directionRef.current = null; activeCellRef.current = cell; setActiveCell(cell); setSelection(tapStartRef.current ? lineToTappedCell(tapStartRef.current, cell) : [cell]);
    event.currentTarget.setPointerCapture?.(event.pointerId); event.preventDefault();
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerRef.current !== event.pointerId || !draggingRef.current) return;
    event.preventDefault(); queuedPointRef.current = { x: event.clientX, y: event.clientY };
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => { rafRef.current = null; const point = queuedPointRef.current; if (point) { const cell = cellFromPoint(point.x, point.y, true); if (cell) extendDrag(cell); } });
  };
  const onPointerUp = async (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerRef.current !== event.pointerId) return;
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    const cell = cellFromPoint(event.clientX, event.clientY, true);
    // Released outside the board and outside the nearest-cell tolerance — cancel the whole
    // gesture rather than submitting whatever selection was last valid before going off-board.
    if (!cell) { cancelSelection(); return; }
    extendDrag(cell);
    const cells = selectionRef.current; draggingRef.current = false; pointerRef.current = null; dragStartRef.current = null; directionRef.current = null; setSelection([]);
    if (cells.length === 1) {
      const tapped = cells[0];
      if (!tapStartRef.current) { tapStartRef.current = tapped; setSelection([tapped]); setTapAnchor(tapped); return; }
      if (sameCell(tapStartRef.current, tapped)) { tapStartRef.current = null; setTapAnchor(null); return; }
      const tapCells = lineToTappedCell(tapStartRef.current, tapped);
      tapStartRef.current = null;
      setTapAnchor(null);
      await submitSelection(tapCells);
      return;
    }
    tapStartRef.current = null;
    setTapAnchor(null);
    await submitSelection(cells);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") return;
    if (event.key.toLowerCase() === "w" && !keyboardSelectingRef.current) { event.preventDefault(); openAppropriateWordList(); return; }
    if (event.key.toLowerCase() === "h" && !keyboardSelectingRef.current) { event.preventDefault(); setShowHelp(true); return; }
    if (event.key === "Escape") { event.preventDefault(); cancelSelection(); return; }
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (!keyboardSelectingRef.current) { tapStartRef.current = null; setTapAnchor(null); keyboardSelectingRef.current = true; dragStartRef.current = activeCellRef.current; setSelection([activeCellRef.current]); }
      else { const cells = selectionRef.current; keyboardSelectingRef.current = false; dragStartRef.current = null; setSelection([]); void submitSelection(cells); }
      return;
    }
    const movement: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const delta = movement[event.key]; if (!delta) return;
    event.preventDefault();
    const current = activeCellRef.current;
    const next = { row: Math.max(0, Math.min(size - 1, current.row + delta[0])), col: Math.max(0, Math.min((grid[0]?.length ?? size) - 1, current.col + delta[1])) };
    activeCellRef.current = next;
    setActiveCell(next); if (keyboardSelectingRef.current) setSelection(wordSearchCellsInLine(dragStartRef.current ?? current, next));
  };

  const cellColors = useMemo(() => {
    const map = new Map<string, number>();
    foundWords.forEach((word) => (placements.get(word) ?? []).forEach((cell) => map.set(keyOf(cell), words.indexOf(word) % WORD_COLORS.length)));
    return map;
  }, [foundWords, placements, words]);

  const canZoom = size > 18;
  const selectedBackground = (() => {
    const key = skin._key;
    if (key === "lava" || key === "skin_lava") return <LavaBackground />;
    if (key === "galaxy" || key === "skin_galaxy") return <GalaxyBackground />;
    if (["ice", "skin_ice", "christmas", "skin_christmas"].includes(key ?? "")) return <IceBackground />;
    if (key === "neon" || key === "skin_neon") return <NeonBackground />;
    if (key === "retro" || key === "skin_retro") return <RetroBackground />;
    return null;
  })();

  return (
    <div className="word-search-root" data-testid="word-search-root" data-display-mode={displayMode} data-status={status} data-grid-size={size} data-skin={skin._key ?? "default"}>
      {pageVisible && selectedBackground}
      <div className="word-search-scrim" aria-hidden style={{ background: skin.backdropScrim }} />
      {showIntro && <Dialog title="More than a word search" onClose={() => { setShowIntro(false); try { localStorage.setItem("wordTroveIntroSeen", "1"); } catch {} }}><p>Every word you find unlocks its real definition, turning each puzzle into a quick vocabulary discovery. Tap a found word in the word list any time to explore it.</p><p>Your final find opens its definition automatically, with pronunciation, part of speech, examples, and audio when available.</p><button type="button" onClick={() => { setShowIntro(false); try { localStorage.setItem("wordTroveIntroSeen", "1"); } catch {} }}>Start searching</button></Dialog>}
      {showHelp && <Dialog title="How to play Word Trove" onClose={() => setShowHelp(false)}><p>Find every listed word in a straight line. Words may run horizontally, vertically, diagonally, forwards, or backwards.</p><p>Drag from the first letter to the last, or tap a start letter and then tap the end letter. A marked start letter is waiting for your second tap; tap it again to cancel. You can also use the arrow keys and Space or Enter. Press W for the word list and H for help.</p><p>Found words unlock their definitions — open the word list and tap any found word to read it.</p><button type="button" onClick={() => { setShowHelp(false); setShowIntro(true); }}>Why Word Trove?</button><button type="button" onClick={() => setShowHelp(false)}>Got it</button></Dialog>}
      {definition && <WordDefinitionModal word={definition.word} color={WORD_COLORS[definition.colorIdx]} status={definition.status} data={definition.data} onDismiss={dismissDefinition} />}
      <WordSearchWordList open={wordListOpen} words={words} foundWords={foundSet} onClose={() => setWordListOpen(false)} onOpenDefinition={openDefinition} />

      <div className="word-search-game-surface">
        {displayMode === "standalone" && <header className="word-search-standalone-header"><div><h2>WORD TROVE</h2><p>{foundWords.length} / {words.length} found</p></div><button type="button" onClick={() => setShowHelp(true)}>Help</button></header>}
        {status === "won" && <div className="word-search-success" role="status">🎉 All {words.length} words found!</div>}
        {status === "completing" && <div className="word-search-message" role="status">Saving completion…</div>}
        {error && <div className="word-search-error" role="alert">
          {error}
          {status === "completion-pending" && <button type="button" onClick={() => void finishCompletionHandoff()}>Retry Completion</button>}
          {status === "error" && !dailyMode && <button type="button" onClick={() => { setStatus("loading"); setCatalogLoadAttempt((value) => value + 1); }}>Retry Restore</button>}
        </div>}

        <div className="word-search-play-layout">
          <div ref={viewportRef} className="word-search-board-viewport" data-zoomed={zoom > 1 || undefined}>
            <motion.div
              ref={boardRef}
              role="grid"
              aria-label={`Word Trove letter grid, ${size} rows by ${grid[0]?.length ?? 0} columns`}
              aria-rowcount={size}
              aria-colcount={grid[0]?.length ?? 0}
              tabIndex={-1}
              className="word-search-board"
              style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
              animate={gridShake}
              onKeyDown={onKeyDown}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={cancelSelection}
            >
              {trail.length > 1 && <svg className="word-search-trail" aria-hidden><polyline points={trail.map(({ x, y }) => `${x},${y}`).join(" ")} /></svg>}
              {grid.map((row, rowIndex) => (
                <div role="row" className="word-search-row" key={rowIndex}>
                  {row.map((letter, colIndex) => {
                    const cell = { row: rowIndex, col: colIndex };
                    const key = keyOf(cell); const colorIndex = cellColors.get(key); const found = colorIndex !== undefined; const selected = selectedSet.has(key); const active = sameCell(activeCell, cell); const hinted = [...hintedWords].some((word) => placements.get(word)?.some((item) => sameCell(item, cell))); const isTapAnchor = sameCell(tapAnchor, cell);
                    return <motion.div
                      role="gridcell"
                      key={key}
                      data-ws-row={rowIndex}
                      data-ws-col={colIndex}
                      data-found={found || undefined}
                      data-hinted={hinted || undefined}
                      data-selected={selected || undefined}
                      data-active={active || undefined}
                      data-tap-anchor={isTapAnchor || undefined}
                      tabIndex={active ? 0 : -1}
                      aria-selected={selected}
                      aria-label={`Row ${rowIndex + 1}, column ${colIndex + 1}, letter ${letter}${found ? ", found word" : ""}${isTapAnchor ? ", start selected; tap another letter to finish" : ""}`}
                      className="word-search-cell"
                      onFocus={() => { activeCellRef.current = cell; setActiveCell(cell); }}
                      animate={reduceMotion ? undefined : { scale: poppingCells.has(key) ? [1, 1.25, 1] : selected ? 1.08 : 1 }}
                      style={found ? { "--word-color-bg": WORD_COLORS[colorIndex].bg, "--word-color-border": WORD_COLORS[colorIndex].border, "--word-color-text": WORD_COLORS[colorIndex].text } as React.CSSProperties : undefined}
                    >{letter}</motion.div>;
                  })}
                </div>
              ))}
            </motion.div>
          </div>

          <WordSearchWordDock foundCount={foundWords.length} totalWords={words.length} selectedText={selectedText} onOpenWordList={openAppropriateWordList} showProgress={displayMode !== "app-shell"} />
          <WordSearchControls hintTokens={hintTokens} hintPending={hintPending} disabled={status !== "playing"} canZoom={canZoom} zoomed={zoom > 1} onHint={() => void requestHint()} onZoomIn={() => setZoom((value) => Math.min(2, value + .25))} onZoomOut={() => setZoom((value) => Math.max(1, value - .25))} onResetZoom={() => setZoom(1)} />
          <WordSearchDesktopWordList ref={desktopListRef} words={words} foundWords={foundSet} onOpenDefinition={openDefinition} onEscape={focusBoard} />
        </div>
        {flashWord && <span className="word-search-live" aria-live="polite">Found {flashWord}</span>}
      </div>
    </div>
  );
});

const WordSearchPuzzle = forwardRef<WordSearchPuzzleHandle, Props>(function WordSearchPuzzle(props, ref) {
  const normalized = normalizePlayableWordSearch(props.wordSearchData.grid, props.wordSearchData.words);
  const scope = props.persistenceScope ?? (props.warzMode ? "none" : props.dailyMode ? "daily" : "catalog");
  const identity = [scope, props.dailyDayNumber ?? "", props.puzzleId, normalized.signature, props.puzzleInstanceId ?? ""].join(":");
  return <WordSearchPuzzleInner key={identity} {...props} ref={ref} />;
});

export default WordSearchPuzzle;
