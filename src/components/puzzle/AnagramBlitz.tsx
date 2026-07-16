"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { useReducedMotion } from "framer-motion";
import Pressable from "@/components/juice/Pressable";
import { confettiBurstAt } from "@/components/juice/particles";
import { juice, prefersReducedMotion } from "@/lib/juice";
import { usePuzzleSkin } from "@/hooks/usePuzzleSkin";
import AnagramLetterTray from "@/components/puzzle/anagram/AnagramLetterTray";
import AnagramAnswerSlots from "@/components/puzzle/anagram/AnagramAnswerSlots";
import AnagramControls from "@/components/puzzle/anagram/AnagramControls";

const LavaBackground = dynamic(() => import("@/components/LavaBackground"), { ssr: false });
const GalaxyBackground = dynamic(() => import("@/components/GalaxyBackground"), { ssr: false });
const IceBackground = dynamic(() => import("@/components/IceBackground"), { ssr: false });
const NeonBackground = dynamic(() => import("@/components/NeonBackground"), { ssr: false });
const RetroBackground = dynamic(() => import("@/components/RetroBackground"), { ssr: false });

export type AnagramStatus = "ready" | "playing" | "won" | "lost";

export interface AnagramPresentationState {
  status: AnagramStatus;
  timeLeftMs: number;
  solvedCount: number;
  totalWords: number;
  currentWordNumber: number;
  currentWordLength: number;
}

export interface AnagramFailureResult {
  solvedCount: number;
  totalWords: number;
  elapsedSeconds: number;
  missedAnswers: string[];
}

export interface AnagramBlitzHandle {
  openInstructions: () => void;
  resetGame: () => void;
  focusGame: () => void;
}

export interface AnagramTile {
  id: string;
  letter: string;
}

export interface AnagramWordEntry {
  id: string;
  answer: string;
  scrambled: AnagramTile[];
}

interface AnagramBlitzProps {
  puzzleId: string;
  anagramData: Record<string, unknown>;
  alreadySolved?: boolean;
  onSolved?: (elapsedSeconds: number) => void;
  onFailed?: (result: AnagramFailureResult) => void;
  onPresentationChange?: (state: AnagramPresentationState) => void;
  displayMode?: "standalone" | "app-shell";
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number) {
  let value = seed || 1;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function canScrambleDiffer(answer: string): boolean {
  return new Set(answer).size > 1;
}

function stableScramble(answer: string, entryId: string): AnagramTile[] {
  const tiles = answer.split("").map((letter, index) => ({ id: `${entryId}-tile-${index}`, letter }));
  const random = seededRandom(hashSeed(entryId));
  const shuffled = [...tiles];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  if (canScrambleDiffer(answer) && shuffled.map((tile) => tile.letter).join("") === answer) {
    const swapIndex = shuffled.findIndex((tile, index) => index > 0 && tile.letter !== shuffled[0].letter);
    if (swapIndex > 0) [shuffled[0], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[0]];
  }
  return shuffled;
}

export function buildAnagramWordEntries(puzzleId: string, rawWords: unknown): AnagramWordEntry[] {
  if (!Array.isArray(rawWords)) return [];
  return rawWords.flatMap((rawWord, index) => {
    const answer = String(rawWord).toUpperCase().replace(/[^A-Z]/g, "");
    if (!answer) return [];
    const id = `${puzzleId}-word-${index}`;
    return [{ id, answer, scrambled: stableScramble(answer, id) }];
  });
}

function shuffledUnusedOrder(order: string[], usedIds: ReadonlySet<string>): string[] {
  const availablePositions = order.flatMap((id, index) => usedIds.has(id) ? [] : [index]);
  if (availablePositions.length < 2) return order;
  const availableIds = availablePositions.map((index) => order[index]);
  for (let index = availableIds.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [availableIds[index], availableIds[swapIndex]] = [availableIds[swapIndex], availableIds[index]];
  }
  const unchanged = availableIds.every((id, index) => id === order[availablePositions[index]]);
  if (unchanged) availableIds.push(availableIds.shift()!);
  const next = [...order];
  availablePositions.forEach((position, index) => { next[position] = availableIds[index]; });
  return next;
}

function formatTime(timeLeftMs: number): string {
  const safeMs = Math.max(0, timeLeftMs);
  if (safeMs <= 10_000 && safeMs > 0) return `${(safeMs / 1000).toFixed(1)}s`;
  const totalSeconds = Math.ceil(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function AnagramHelpDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], [tabindex]:not([tabindex="-1"])'
      ) ?? []).filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.requestAnimationFrame(() => restoreFocusRef.current?.focus());
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="anagram-help-layer" onPointerDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <div
        ref={dialogRef}
        className="anagram-help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="anagram-help-title"
      >
        <div className="anagram-help-heading">
          <h2 id="anagram-help-title">How to Play Anagram Blitz</h2>
          <Pressable ref={closeRef} type="button" className="anagram-help-close" aria-label="Close help" onClick={onClose}>×</Pressable>
        </div>
        <div className="anagram-help-copy">
          <p>Build each answer by tapping its scrambled letter tiles. Tap an answer tile or press Backspace to return it.</p>
          <p>Use Shuffle to rearrange unused letters. Pass moves the current word to the back of the queue.</p>
          <p>A hardware keyboard can enter letters, erase with Backspace or Delete, and submit with Enter.</p>
          <p><strong>The Blitz timer continues while Help is open.</strong></p>
        </div>
        <Pressable type="button" className="anagram-help-confirm" onClick={onClose}>Got it</Pressable>
      </div>
    </div>,
    document.body
  );
}

const AnagramBlitz = forwardRef<AnagramBlitzHandle, AnagramBlitzProps>(function AnagramBlitz({
  puzzleId,
  anagramData,
  alreadySolved = false,
  onSolved,
  onFailed,
  onPresentationChange,
  displayMode = "standalone",
}, ref) {
  const entries = useMemo(() => buildAnagramWordEntries(puzzleId, anagramData.words), [anagramData.words, puzzleId]);
  const entryMap = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const totalTimeMs = Math.max(1, Number(anagramData.timeLimit ?? 60)) * 1000;
  const hint = anagramData.hint ? String(anagramData.hint) : null;
  const initialTrayOrders = useMemo(() => Object.fromEntries(entries.map((entry) => [entry.id, entry.scrambled.map((tile) => tile.id)])), [entries]);
  const skin = usePuzzleSkin();
  const reduceMotion = Boolean(useReducedMotion() || prefersReducedMotion());

  const [status, setStatus] = useState<AnagramStatus>(alreadySolved ? "won" : "ready");
  const [timeLeftMs, setTimeLeftMs] = useState(totalTimeMs);
  const [queueIds, setQueueIds] = useState<string[]>(alreadySolved ? [] : entries.map((entry) => entry.id));
  const [solvedEntryIds, setSolvedEntryIds] = useState<string[]>(alreadySolved ? entries.map((entry) => entry.id) : []);
  const [trayOrders, setTrayOrders] = useState<Record<string, string[]>>(initialTrayOrders);
  const [placedTileIds, setPlacedTileIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [recentTileId, setRecentTileId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const gameSurfaceRef = useRef<HTMLDivElement | null>(null);
  const completionTargetRef = useRef<HTMLDivElement | null>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deadlineRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const timeoutRefs = useRef<Set<number>>(new Set());
  const statusRef = useRef(status);
  const queueRef = useRef(queueIds);
  const solvedRef = useRef(solvedEntryIds);
  const placedRef = useRef(placedTileIds);
  const terminalGuardRef = useRef(alreadySolved);
  const solvedCallbackGuardRef = useRef(alreadySolved);
  const failedCallbackGuardRef = useRef(false);
  const onSolvedRef = useRef(onSolved);
  const onFailedRef = useRef(onFailed);
  const onPresentationChangeRef = useRef(onPresentationChange);
  const presentationSignatureRef = useRef("");

  const currentEntry = entryMap.get(queueIds[0] ?? "") ?? null;
  const currentTrayOrder = useMemo(
    () => currentEntry ? (trayOrders[currentEntry.id] ?? currentEntry.scrambled.map((tile) => tile.id)) : [],
    [currentEntry, trayOrders]
  );
  const currentTileMap = useMemo(() => new Map(currentEntry?.scrambled.map((tile) => [tile.id, tile]) ?? []), [currentEntry]);
  const trayTiles = currentTrayOrder.flatMap((tileId) => {
    const tile = currentTileMap.get(tileId);
    return tile ? [tile] : [];
  });
  const placedTiles = placedTileIds.flatMap((tileId) => {
    const tile = currentTileMap.get(tileId);
    return tile ? [tile] : [];
  });
  const placedSet = useMemo(() => new Set(placedTileIds), [placedTileIds]);

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { queueRef.current = queueIds; }, [queueIds]);
  useEffect(() => { solvedRef.current = solvedEntryIds; }, [solvedEntryIds]);
  useEffect(() => { placedRef.current = placedTileIds; }, [placedTileIds]);
  useEffect(() => { onSolvedRef.current = onSolved; }, [onSolved]);
  useEffect(() => { onFailedRef.current = onFailed; }, [onFailed]);
  useEffect(() => { onPresentationChangeRef.current = onPresentationChange; }, [onPresentationChange]);

  const clearTicker = useCallback(() => {
    if (tickerRef.current) clearInterval(tickerRef.current);
    tickerRef.current = null;
  }, []);

  const clearPendingTimeouts = useCallback(() => {
    timeoutRefs.current.forEach((timeout) => window.clearTimeout(timeout));
    timeoutRefs.current.clear();
  }, []);

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timeout = window.setTimeout(() => {
      timeoutRefs.current.delete(timeout);
      callback();
    }, delay);
    timeoutRefs.current.add(timeout);
  }, []);

  const focusGame = useCallback(() => {
    gameSurfaceRef.current?.focus({ preventScroll: true });
  }, []);

  const finishLoss = useCallback(() => {
    if (terminalGuardRef.current || statusRef.current !== "playing") return;
    terminalGuardRef.current = true;
    clearTicker();
    deadlineRef.current = null;
    statusRef.current = "lost";
    setStatus("lost");
    setTimeLeftMs(0);
    setFeedback(null);
    const solvedIds = new Set(solvedRef.current);
    if (!failedCallbackGuardRef.current) {
      failedCallbackGuardRef.current = true;
      onFailedRef.current?.({
        solvedCount: solvedIds.size,
        totalWords: entries.length,
        elapsedSeconds: Math.max(0, Math.round((Date.now() - (startedAtRef.current ?? Date.now())) / 1000)),
        missedAnswers: entries.filter((entry) => !solvedIds.has(entry.id)).map((entry) => entry.answer),
      });
    }
  }, [clearTicker, entries]);

  const syncClock = useCallback(() => {
    if (statusRef.current !== "playing" || terminalGuardRef.current || deadlineRef.current === null) return;
    const remaining = Math.max(0, deadlineRef.current - Date.now());
    setTimeLeftMs(remaining);
    if (remaining <= 0) finishLoss();
  }, [finishLoss]);

  useEffect(() => {
    if (status !== "playing" || terminalGuardRef.current) return;
    syncClock();
    tickerRef.current = setInterval(syncClock, 100);
    return clearTicker;
  }, [clearTicker, status, syncClock]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") syncClock();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [syncClock]);

  useEffect(() => () => {
    clearTicker();
    clearPendingTimeouts();
  }, [clearPendingTimeouts, clearTicker]);

  const resetGame = useCallback(() => {
    clearTicker();
    clearPendingTimeouts();
    deadlineRef.current = null;
    startedAtRef.current = null;
    terminalGuardRef.current = alreadySolved;
    solvedCallbackGuardRef.current = alreadySolved;
    failedCallbackGuardRef.current = false;
    const resetStatus: AnagramStatus = alreadySolved ? "won" : "ready";
    const resetQueue = alreadySolved ? [] : entries.map((entry) => entry.id);
    const resetSolved = alreadySolved ? entries.map((entry) => entry.id) : [];
    statusRef.current = resetStatus;
    queueRef.current = resetQueue;
    solvedRef.current = resetSolved;
    placedRef.current = [];
    setStatus(resetStatus);
    setTimeLeftMs(totalTimeMs);
    setQueueIds(resetQueue);
    setSolvedEntryIds(resetSolved);
    setTrayOrders(initialTrayOrders);
    setPlacedTileIds([]);
    setFeedback(null);
    setRecentTileId(null);
    setShowHelp(false);
  }, [alreadySolved, clearPendingTimeouts, clearTicker, entries, initialTrayOrders, totalTimeMs]);

  useImperativeHandle(ref, () => ({
    openInstructions: () => setShowHelp(true),
    resetGame,
    focusGame,
  }), [focusGame, resetGame]);

  const presentationState = useMemo<AnagramPresentationState>(() => ({
    status,
    timeLeftMs,
    solvedCount: solvedEntryIds.length,
    totalWords: entries.length,
    currentWordNumber: currentEntry ? Math.min(entries.length, solvedEntryIds.length + 1) : 0,
    currentWordLength: currentEntry?.answer.length ?? 0,
  }), [currentEntry, entries.length, solvedEntryIds.length, status, timeLeftMs]);

  useEffect(() => {
    const signature = [
      presentationState.status,
      Math.round(presentationState.timeLeftMs),
      presentationState.solvedCount,
      presentationState.totalWords,
      presentationState.currentWordNumber,
      presentationState.currentWordLength,
    ].join("|");
    if (signature === presentationSignatureRef.current) return;
    presentationSignatureRef.current = signature;
    onPresentationChangeRef.current?.(presentationState);
  }, [presentationState]);

  const handleStart = useCallback(() => {
    if (alreadySolved || entries.length === 0 || statusRef.current !== "ready") return;
    const now = Date.now();
    startedAtRef.current = now;
    deadlineRef.current = now + totalTimeMs;
    terminalGuardRef.current = false;
    statusRef.current = "playing";
    setTimeLeftMs(totalTimeMs);
    setStatus("playing");
    window.requestAnimationFrame(focusGame);
  }, [alreadySolved, entries.length, focusGame, totalTimeMs]);

  const setPlaced = useCallback((next: string[]) => {
    placedRef.current = next;
    setPlacedTileIds(next);
  }, []);

  const selectTile = useCallback((tileId: string) => {
    if (statusRef.current !== "playing" || feedback === "correct" || !currentEntry) return;
    const currentPlaced = placedRef.current;
    if (currentPlaced.includes(tileId) || currentPlaced.length >= currentEntry.answer.length) return;
    setPlaced([...currentPlaced, tileId]);
    setRecentTileId(tileId);
    window.requestAnimationFrame(focusGame);
  }, [currentEntry, feedback, focusGame, setPlaced]);

  const returnTile = useCallback((slotIndex: number) => {
    if (statusRef.current !== "playing" || feedback === "correct") return;
    const tileId = placedRef.current[slotIndex];
    if (!tileId) return;
    setPlaced(placedRef.current.filter((_, index) => index !== slotIndex));
    setRecentTileId(tileId);
    window.requestAnimationFrame(focusGame);
  }, [feedback, focusGame, setPlaced]);

  const handleBackspace = useCallback(() => {
    if (statusRef.current !== "playing" || feedback === "correct") return;
    const tileId = placedRef.current.at(-1);
    if (!tileId) return;
    setPlaced(placedRef.current.slice(0, -1));
    setRecentTileId(tileId);
  }, [feedback, setPlaced]);

  const handleShuffle = useCallback(() => {
    if (!currentEntry || statusRef.current !== "playing" || feedback === "correct") return;
    const usedIds = new Set(placedRef.current);
    setTrayOrders((current) => ({
      ...current,
      [currentEntry.id]: shuffledUnusedOrder(current[currentEntry.id] ?? currentEntry.scrambled.map((tile) => tile.id), usedIds),
    }));
    juice.whoosh();
    window.requestAnimationFrame(focusGame);
  }, [currentEntry, feedback, focusGame]);

  const handlePass = useCallback(() => {
    if (statusRef.current !== "playing" || feedback === "correct" || queueRef.current.length <= 1) return;
    const nextQueue = [...queueRef.current.slice(1), queueRef.current[0]];
    queueRef.current = nextQueue;
    setQueueIds(nextQueue);
    setPlaced([]);
    setFeedback(null);
    setRecentTileId(null);
    juice.whoosh();
    window.requestAnimationFrame(focusGame);
  }, [feedback, focusGame, setPlaced]);

  const finishWinAfterFeedback = useCallback(() => {
    statusRef.current = "won";
    setStatus("won");
    setFeedback(null);
    setPlaced([]);
    queueRef.current = [];
    setQueueIds([]);
    if (!solvedCallbackGuardRef.current) {
      solvedCallbackGuardRef.current = true;
      const elapsedSeconds = Math.max(0, Math.round((Date.now() - (startedAtRef.current ?? Date.now())) / 1000));
      schedule(() => onSolvedRef.current?.(elapsedSeconds), reduceMotion ? 80 : 240);
    }
  }, [reduceMotion, schedule, setPlaced]);

  const handleSubmit = useCallback(() => {
    if (statusRef.current !== "playing" || feedback === "correct" || !currentEntry) return;
    if (placedRef.current.length !== currentEntry.answer.length) return;
    const guess = placedRef.current.map((tileId) => currentTileMap.get(tileId)?.letter ?? "").join("");
    if (guess !== currentEntry.answer) {
      setFeedback("wrong");
      juice.error();
      schedule(() => setFeedback((current) => current === "wrong" ? null : current), reduceMotion ? 120 : 360);
      return;
    }

    setFeedback("correct");
    juice.success();
    const nextSolved = [...solvedRef.current, currentEntry.id];
    solvedRef.current = nextSolved;
    setSolvedEntryIds(nextSolved);
    const remainingQueue = queueRef.current.slice(1);
    const finalWord = remainingQueue.length === 0;

    if (finalWord) {
      terminalGuardRef.current = true;
      clearTicker();
      deadlineRef.current = null;
      juice.reward();
      confettiBurstAt(completionTargetRef.current, { particleCount: 42, spread: 78 });
      schedule(finishWinAfterFeedback, reduceMotion ? 180 : 650);
      return;
    }

    schedule(() => {
      if (terminalGuardRef.current || statusRef.current !== "playing") return;
      queueRef.current = remainingQueue;
      setQueueIds(remainingQueue);
      setPlaced([]);
      setFeedback(null);
      setRecentTileId(null);
      window.requestAnimationFrame(focusGame);
    }, reduceMotion ? 120 : 460);
  }, [clearTicker, currentEntry, currentTileMap, feedback, finishWinAfterFeedback, focusGame, reduceMotion, schedule, setPlaced]);

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") return;
    if (event.key === "Escape") {
      if (showHelp) {
        event.preventDefault();
        setShowHelp(false);
      }
      return;
    }
    if (statusRef.current !== "playing" || feedback === "correct" || !currentEntry) return;
    const target = event.target as HTMLElement;
    const interactiveTarget = target !== event.currentTarget && Boolean(target.closest("button, a, input, textarea, select"));
    if (event.key === "Enter") {
      if (interactiveTarget) return;
      event.preventDefault();
      handleSubmit();
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      handleBackspace();
      return;
    }
    if (!/^[a-zA-Z]$/.test(event.key)) return;
    event.preventDefault();
    const letter = event.key.toUpperCase();
    const usedIds = new Set(placedRef.current);
    const matchingTile = currentTrayOrder
      .map((tileId) => currentTileMap.get(tileId))
      .find((tile) => tile?.letter === letter && !usedIds.has(tile.id));
    if (matchingTile) selectTile(matchingTile.id);
  }, [currentEntry, currentTileMap, currentTrayOrder, feedback, handleBackspace, handleSubmit, selectTile, showHelp]);

  const timerPercent = totalTimeMs > 0 ? Math.max(0, Math.min(100, (timeLeftMs / totalTimeMs) * 100)) : 0;
  const urgent = status === "playing" && timeLeftMs <= 10_000;
  const missedEntries = entries.filter((entry) => !new Set(solvedEntryIds).has(entry.id));
  const rootStyle = {
    "--anagram-board-bg": skin.boardBg,
    "--anagram-board-border": skin.boardBorder,
    "--anagram-board-radius": skin.boardRadius,
    "--anagram-tile-bg": skin.tileBg,
    "--anagram-tile-border": skin.tileBorder,
    "--anagram-tile-text": skin.tileText,
    "--anagram-input-bg": skin.inputBg,
    "--anagram-input-border": skin.inputBorder,
    "--anagram-button-bg": skin.btnBg,
    "--anagram-button-text": skin.btnText,
  } as CSSProperties;

  return (
    <div
      className="anagram-root"
      data-display-mode={displayMode}
      data-status={status}
      data-reduced-motion={reduceMotion ? "true" : undefined}
      data-testid="anagram-root"
      style={rootStyle}
    >
      {(skin._key === "lava" || skin._key === "skin_lava") && <LavaBackground />}
      {(skin._key === "galaxy" || skin._key === "skin_galaxy") && <GalaxyBackground />}
      {(skin._key === "ice" || skin._key === "skin_ice" || skin._key === "christmas" || skin._key === "skin_christmas") && <IceBackground />}
      {(skin._key === "neon" || skin._key === "skin_neon") && <NeonBackground />}
      {(skin._key === "retro" || skin._key === "skin_retro") && <RetroBackground />}
      <div className="anagram-skin-scrim" style={{ background: skin.backdropScrim }} aria-hidden />

      <div
        ref={gameSurfaceRef}
        className="anagram-game-surface"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-label="Anagram Blitz game. Use letter keys to place tiles, Backspace or Delete to remove a tile, and Enter to submit."
        data-testid="anagram-game-surface"
      >
        {displayMode === "standalone" && (
          <div className="anagram-standalone-header">
            <div>
              <h2>Anagram Blitz</h2>
              <p>{solvedEntryIds.length} / {entries.length} solved</p>
            </div>
            <span aria-label={`Remaining time ${formatTime(timeLeftMs)}`}>{formatTime(timeLeftMs)}</span>
            <Pressable type="button" className="anagram-standalone-help" onClick={() => setShowHelp(true)}>Help</Pressable>
          </div>
        )}

        {entries.length === 0 ? (
          <div className="anagram-state-card anagram-error-state">
            <h2>Unable to start</h2>
            <p>This puzzle has no playable words configured.</p>
          </div>
        ) : alreadySolved ? (
          <div className="anagram-state-card">
            <span className="anagram-state-icon" aria-hidden>✓</span>
            <h2>Already solved</h2>
            <p>You already unscrambled every word in this Blitz.</p>
          </div>
        ) : status === "ready" ? (
          <div className="anagram-state-card anagram-ready-state">
            <span className="anagram-state-icon" aria-hidden>↻</span>
            <h2>Ready for the Blitz?</h2>
            <p>Build {entries.length} answer{entries.length === 1 ? "" : "s"} before {formatTime(totalTimeMs)} runs out.</p>
            {hint && <p className="anagram-hint">Hint: {hint}</p>}
            <Pressable type="button" className="anagram-start-button" cue="success" onClick={handleStart}>Start</Pressable>
            {displayMode === "standalone" && (
              <Pressable type="button" className="anagram-ready-help" onClick={() => setShowHelp(true)}>How to play</Pressable>
            )}
          </div>
        ) : status === "lost" ? (
          <div className="anagram-state-card anagram-result-state">
            <span className="anagram-state-icon" aria-hidden>⌛</span>
            <h2>{solvedEntryIds.length} / {entries.length} solved</h2>
            <p>Time ran out. Here are the answers still waiting:</p>
            <ul className="anagram-missed-list">
              {missedEntries.map((entry) => <li key={entry.id}>{entry.answer}</li>)}
            </ul>
            <Pressable type="button" className="anagram-start-button" onClick={resetGame}>Try Again</Pressable>
          </div>
        ) : status === "won" ? (
          <div className="anagram-state-card anagram-result-state" data-testid="anagram-win-state">
            <span className="anagram-state-icon" aria-hidden>✓</span>
            <h2>Perfect Blitz!</h2>
            <p>Every word unscrambled. Finalizing your result…</p>
          </div>
        ) : currentEntry ? (
          <div className="anagram-active-game" ref={completionTargetRef} data-testid="anagram-current-entry" data-entry-id={currentEntry.id}>
            <div className="anagram-timer-block" data-urgent={urgent ? "true" : undefined}>
              <div className="anagram-timer-labels">
                <span>Time remaining</span>
                <strong aria-label={`Remaining time ${formatTime(timeLeftMs)}`}>{formatTime(timeLeftMs)}</strong>
              </div>
              <div className="anagram-timer-track" role="progressbar" aria-label="Blitz time remaining" aria-valuemin={0} aria-valuemax={totalTimeMs} aria-valuenow={Math.round(timeLeftMs)}>
                <div className="anagram-timer-fill" style={{ width: `${timerPercent}%` }} />
              </div>
            </div>

            <div className="anagram-word-progress">
              <span>Word {Math.min(entries.length, solvedEntryIds.length + 1)} of {entries.length}</span>
              <div className="anagram-progress-dots" aria-label={`${solvedEntryIds.length} of ${entries.length} words solved`}>
                {entries.map((entry) => (
                  <span
                    key={entry.id}
                    data-solved={solvedEntryIds.includes(entry.id) ? "true" : undefined}
                    data-active={entry.id === currentEntry.id ? "true" : undefined}
                  />
                ))}
              </div>
            </div>

            <AnagramLetterTray
              tiles={trayTiles}
              placedTileIds={placedSet}
              disabled={feedback === "correct"}
              feedback={feedback}
              recentTileId={recentTileId}
              onSelect={selectTile}
            />
            <AnagramAnswerSlots
              length={currentEntry.answer.length}
              placedTiles={placedTiles}
              disabled={feedback === "correct"}
              feedback={feedback}
              recentTileId={recentTileId}
              onReturn={returnTile}
            />
            {hint && <p className="anagram-hint anagram-active-hint">Hint: {hint}</p>}
            <AnagramControls
              canPass={queueIds.length > 1}
              canSubmit={placedTileIds.length === currentEntry.answer.length}
              disabled={feedback === "correct"}
              onShuffle={handleShuffle}
              onPass={handlePass}
              onSubmit={handleSubmit}
            />
            <p className="anagram-feedback" aria-live="polite">
              {feedback === "correct" ? "Correct" : feedback === "wrong" ? "Not quite—try rearranging the tiles." : ""}
            </p>
          </div>
        ) : null}
      </div>
      {showHelp && <AnagramHelpDialog onClose={() => setShowHelp(false)} />}
    </div>
  );
});

export default AnagramBlitz;
