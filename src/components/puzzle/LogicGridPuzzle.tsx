"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  validateLogicGridPuzzleData,
  type LogicGridCategoryNormalized,
} from "@/lib/logicGridCore";
import {
  applyLogicGridCellMark,
  deriveLogicGridState,
  getLogicGridCellKey,
  getNextLogicGridCellMark,
  normalizeLogicGridCellMarks,
  type LogicGridCellMark,
  type LogicGridCellMarks,
} from "@/lib/logicGridGame";
import { juice } from "@/lib/juice";
import { AnimatedCheck, SparkleBurst, confettiBurstAt } from "@/components/juice/particles";
import styles from "./LogicGridPuzzle.module.css";

interface LogicGridPuzzleProps {
  puzzleId: string;
  logicGridData: Record<string, unknown>;
  alreadySolved: boolean;
  onSolved: (elapsedSeconds?: number) => void;
}

interface HistoryState {
  past: LogicGridCellMarks[];
  present: LogicGridCellMarks;
  future: LogicGridCellMarks[];
}

const MAX_HISTORY = 100;
const AUTOSAVE_DELAY_MS = 800;
const CHAIN_MESSAGE_MS = 1500;
const MILESTONE_MESSAGE_MS = 2500;
const COMPLETION_HANDOFF_MS = 1800;

const MILESTONE_COPY: Record<number, string> = {
  25: "Case progress: 25%",
  50: "Half the case mapped",
  75: "The final connections are forming",
  100: "Grid complete — ready to submit",
};

type MobileTab = "clues" | "grid" | "case";

function formatElapsed(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

function cellStateLabel(mark: LogicGridCellMark | undefined): "unknown" | "impossible" | "confirmed" {
  if (mark === "check") return "confirmed";
  if (mark === "cross") return "impossible";
  return "unknown";
}

function cellGlyph(mark: LogicGridCellMark | undefined): string {
  if (mark === "check") return "✓";
  if (mark === "cross") return "✕";
  return "·";
}

export default function LogicGridPuzzle({
  puzzleId,
  logicGridData,
  alreadySolved,
  onSolved,
}: LogicGridPuzzleProps) {
  const validation = useMemo(
    () => validateLogicGridPuzzleData(logicGridData, { requireSolution: false }),
    [logicGridData]
  );

  const categories: LogicGridCategoryNormalized[] = validation.normalized?.categories ?? [];
  const clues: string[] = validation.normalized?.clues ?? [];
  const intro: string = validation.normalized?.intro ?? "";

  const [history, setHistory] = useState<HistoryState>({ past: [], present: {}, future: [] });
  const [resolvedClues, setResolvedClues] = useState<Set<number>>(new Set());
  const [solved, setSolved] = useState(alreadySolved);
  const [submitting, setSubmitting] = useState(false);
  const [mismatchedCategories, setMismatchedCategories] = useState<string[] | null>(null);
  const [requestFailed, setRequestFailed] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);
  const [activeTab, setActiveTab] = useState<MobileTab>("grid");
  const [chainCount, setChainCount] = useState<number | null>(null);
  const [milestoneMessage, setMilestoneMessage] = useState<string | null>(null);
  const [sparkleTrigger, setSparkleTrigger] = useState(0);
  const [timerRunning, setTimerRunning] = useState(!alreadySolved);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isDesktopLayout, setIsDesktopLayout] = useState(false);

  const hydratedRef = useRef(false);
  const startTimeRef = useRef<number>(Date.now());
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chainTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const milestoneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const milestonesReachedRef = useRef<Set<number>>(new Set());
  const submitButtonRef = useRef<HTMLButtonElement | null>(null);

  const cellMarks = history.present;

  const derivedState = useMemo(
    () => deriveLogicGridState(categories, cellMarks),
    [categories, cellMarks]
  );

  // Hydrate saved scratch-grid state on mount. Does not create an Undo entry, does not fire
  // juice effects, and does not fire milestone messaging.
  useEffect(() => {
    if (!validation.valid) return;
    let cancelled = false;
    fetch(`/api/puzzles/${puzzleId}/logic-grid`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const safeMarks = normalizeLogicGridCellMarks(data?.cellMarks, categories);
        setHistory({ past: [], present: safeMarks, future: [] });
      })
      .catch(() => {
        if (!cancelled) setHistory({ past: [], present: {}, future: [] });
      })
      .finally(() => {
        if (!cancelled) hydratedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleId, validation.valid]);

  // Debounced autosave of scratch state (Undo/Redo changes flow through this too).
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      fetch(`/api/puzzles/${puzzleId}/logic-grid`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ cellMarks }),
      }).catch(() => {});
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [cellMarks, puzzleId]);

  // Elapsed timer — starts on mount with valid data, stops after a correct solve, never
  // runs when already solved.
  useEffect(() => {
    if (!validation.valid || !timerRunning) return;
    const id = setInterval(() => {
      setElapsedSeconds(Math.round((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [validation.valid, timerRunning]);

  useEffect(() => {
    return () => {
      if (chainTimeoutRef.current) clearTimeout(chainTimeoutRef.current);
      if (milestoneTimeoutRef.current) clearTimeout(milestoneTimeoutRef.current);
    };
  }, []);

  // The desktop three-column layout must show all three panels regardless of the mobile
  // tab selection. Browsers apply the `hidden` attribute's `display: none` as a UA-important
  // rule that no author stylesheet (even with !important) can override, so the panels'
  // `hidden` attribute itself must be conditioned on viewport width here in JS rather than
  // overridden in CSS.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktopLayout(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const triggerChainMessage = useCallback((count: number) => {
    setChainCount(count);
    if (chainTimeoutRef.current) clearTimeout(chainTimeoutRef.current);
    chainTimeoutRef.current = setTimeout(() => setChainCount(null), CHAIN_MESSAGE_MS);
  }, []);

  const checkMilestones = useCallback((beforePercent: number, afterPercent: number) => {
    for (const threshold of [25, 50, 75, 100]) {
      if (afterPercent >= threshold && beforePercent < threshold && !milestonesReachedRef.current.has(threshold)) {
        milestonesReachedRef.current.add(threshold);
        if (threshold !== 100) juice.unlock();
        setMilestoneMessage(MILESTONE_COPY[threshold]);
        setSparkleTrigger((s) => s + 1);
        if (milestoneTimeoutRef.current) clearTimeout(milestoneTimeoutRef.current);
        milestoneTimeoutRef.current = setTimeout(() => setMilestoneMessage(null), MILESTONE_MESSAGE_MS);
      }
    }
  }, []);

  const handleCellActivate = useCallback(
    (catIdA: string, entryA: string, catIdB: string, entryB: string) => {
      if (solved || submitting) return;
      const key = getLogicGridCellKey(categories, catIdA, entryA, catIdB, entryB);
      if (!key) return;

      const current = history.present[key];
      const next = getNextLogicGridCellMark(current);
      const result = applyLogicGridCellMark(categories, history.present, catIdA, entryA, catIdB, entryB, next);
      if (result.changedKeys.length === 0) return;

      const prevPresent = history.present;
      const beforePercent = derivedState.progressPercent;

      setHistory({
        past: [...history.past, prevPresent].slice(-MAX_HISTORY),
        present: result.marks,
        future: [],
      });

      if (next === "check") {
        juice.pop();
        if (result.autoEliminatedCount > 0) {
          triggerChainMessage(result.autoEliminatedCount);
        }
      } else {
        juice.tick();
      }

      const afterPercent = deriveLogicGridState(categories, result.marks).progressPercent;
      checkMilestones(beforePercent, afterPercent);
    },
    [categories, history, solved, submitting, derivedState.progressPercent, checkMilestones, triggerChainMessage]
  );

  const handleUndo = useCallback(() => {
    if (solved) return;
    setHistory((h) => {
      if (h.past.length === 0) return h;
      const prev = h.past[h.past.length - 1];
      return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future] };
    });
  }, [solved]);

  const handleRedo = useCallback(() => {
    if (solved) return;
    setHistory((h) => {
      if (h.future.length === 0) return h;
      const next = h.future[0];
      return { past: [...h.past, h.present].slice(-MAX_HISTORY), present: next, future: h.future.slice(1) };
    });
  }, [solved]);

  const canUndo = history.past.length > 0 && !solved;
  const canRedo = history.future.length > 0 && !solved;

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const isEditable =
      target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
    if (isEditable) return;

    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;

    const key = e.key.toLowerCase();
    if (key === "z" && e.shiftKey) {
      e.preventDefault();
      handleRedo();
    } else if (key === "z") {
      e.preventDefault();
      handleUndo();
    } else if (key === "y") {
      e.preventDefault();
      handleRedo();
    }
  }

  function toggleClue(index: number) {
    setResolvedClues((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    juice.tick();
  }

  async function handleSubmit() {
    if (!derivedState.complete || submitting || solved) return;
    setSubmitting(true);
    setMismatchedCategories(null);
    setRequestFailed(false);
    try {
      const res = await fetch(`/api/puzzles/${puzzleId}/logic-grid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ answer: derivedState.answer }),
      });

      let data: { correct?: boolean; mismatchedCategories?: string[] } | null = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || !data) {
        setRequestFailed(true);
        setShakeKey((k) => k + 1);
        juice.error();
        return;
      }

      if (data.correct) {
        const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
        setTimerRunning(false);
        setElapsedSeconds(elapsed);
        setSolved(true);
        juice.reward();
        confettiBurstAt(submitButtonRef.current);
        setShowCompletion(true);
        setTimeout(() => {
          setShowCompletion(false);
          onSolved(elapsed);
        }, COMPLETION_HANDOFF_MS);
      } else {
        setMismatchedCategories(data.mismatchedCategories ?? []);
        setShakeKey((k) => k + 1);
        juice.error();
      }
    } catch {
      setRequestFailed(true);
      setShakeKey((k) => k + 1);
      juice.error();
    } finally {
      setSubmitting(false);
    }
  }

  if (!validation.valid || !validation.normalized) {
    return (
      <div className={styles.loadError} role="alert">
        This logic case could not be loaded.
      </div>
    );
  }

  const blocks = categories.slice(0, -1).map((rowCategory, k) => ({
    rowCategory,
    colCategories: categories.slice(k + 1),
  }));

  const mismatchedNames = (mismatchedCategories ?? [])
    .map((id) => categories.find((c) => c.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  const visibleCaseRows = derivedState.caseRows.filter((row) => row.facts.length > 0);

  const submitLabel = submitting
    ? "Checking…"
    : derivedState.complete
    ? "Submit Solution"
    : "Confirm every relationship to submit";

  return (
    <div className={styles.wrapper} onKeyDown={handleKeyDown}>
      {showCompletion && (
        <div className={styles.completionOverlay} role="dialog" aria-modal="true" aria-label="Case solved">
          <div className={styles.completionCard}>
            <div className={styles.completionCheck}>
              <AnimatedCheck size={48} />
            </div>
            <p className={styles.completionTitle}>CASE SOLVED</p>
            <p className={styles.completionSubtitle}>Every connection accounted for.</p>
            <div className={styles.completionStats}>
              <span>Time {formatElapsed(elapsedSeconds)}</span>
              <span>{derivedState.confirmedFacts} facts confirmed</span>
            </div>
            <div className={styles.completionSparkleAnchor}>
              <SparkleBurst trigger={1} />
            </div>
          </div>
        </div>
      )}

      {solved && (
        <div className={styles.solvedBanner} role="status">
          🧠 You already solved this case!
        </div>
      )}

      {intro && <p className={styles.intro}>{intro}</p>}

      {/* Top status area */}
      <div className={styles.topBar}>
        <div className={styles.topBarHeading}>
          <p className={styles.eyebrow}>Logic Case</p>
          <p className={styles.factCount}>
            {derivedState.confirmedFacts} of {derivedState.totalFacts} facts confirmed
          </p>
        </div>

        <div className={styles.progressRow}>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={derivedState.progressPercent}
            aria-label="Case progress"
          >
            <div className={styles.progressFill} style={{ width: `${derivedState.progressPercent}%` }} />
          </div>
          <span className={styles.progressPercentLabel}>{derivedState.progressPercent}% solved</span>
        </div>

        <div className={styles.statsRow}>
          <span className={styles.timeStat}>Time {formatElapsed(elapsedSeconds)}</span>
          <div className={styles.historyControls}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={handleUndo}
              disabled={!canUndo}
              aria-label="Undo"
              title="Undo (Ctrl/Cmd+Z)"
            >
              ↶ Undo
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={handleRedo}
              disabled={!canRedo}
              aria-label="Redo"
              title="Redo (Ctrl/Cmd+Shift+Z)"
            >
              ↷ Redo
            </button>
          </div>
        </div>

        <p className={styles.instructionHint}>Tap: ✕ → ✓ → clear</p>

        <div className={styles.milestoneAnchor}>
          {milestoneMessage && (
            <p className={styles.milestoneMessage} role="status">
              {milestoneMessage}
            </p>
          )}
          <SparkleBurst trigger={sparkleTrigger} />
        </div>

        <div aria-live="polite" className={styles.chainLiveRegion}>
          {chainCount !== null && (
            <p className={styles.chainMessage}>
              Deduction chain
              <br />
              {chainCount} possibilities eliminated
            </p>
          )}
        </div>
      </div>

      {/* Mobile tab control */}
      <div className={styles.tabBar} role="tablist" aria-label="Logic case panels">
        {(
          [
            ["clues", "Clues"],
            ["grid", "Grid"],
            ["case", "Case Board"],
          ] as const
        ).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`logic-grid-tab-${tab}`}
            aria-selected={activeTab === tab}
            aria-controls={`logic-grid-panel-${tab}`}
            className={activeTab === tab ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => setActiveTab(tab)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.layout}>
        {/* Clue deck */}
        <div
          id="logic-grid-panel-clues"
          role="tabpanel"
          aria-labelledby="logic-grid-tab-clues"
          hidden={!isDesktopLayout && activeTab !== "clues"}
          data-active={activeTab === "clues"}
          className={`${styles.panel} ${styles.panelClues}`}
        >
          <div className={styles.clueDeckHeader}>
            <p className={styles.panelTitle}>Clues</p>
            <p className={styles.clueReviewCount}>
              {resolvedClues.size} of {clues.length} clues reviewed
            </p>
          </div>
          <div className={styles.clueList}>
            {clues.map((clue, i) => {
              const resolved = resolvedClues.has(i);
              return (
                <label
                  key={i}
                  className={resolved ? `${styles.clueCard} ${styles.clueCardResolved}` : styles.clueCard}
                >
                  <input
                    type="checkbox"
                    checked={resolved}
                    onChange={() => toggleClue(i)}
                    className={styles.clueCheckbox}
                    aria-label={`Mark clue ${i + 1} as reviewed`}
                  />
                  <span className={styles.clueBody}>
                    <span className={styles.clueNumber}>{i + 1}</span>
                    <span className={styles.clueText}>{clue}</span>
                    {resolved && <span className={styles.clueResolvedTag}>Resolved</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Deduction grid */}
        <div
          id="logic-grid-panel-grid"
          role="tabpanel"
          aria-labelledby="logic-grid-tab-grid"
          hidden={!isDesktopLayout && activeTab !== "grid"}
          data-active={activeTab === "grid"}
          className={`${styles.panel} ${styles.panelGrid}`}
        >
          <div className={styles.gridBlocks}>
            {blocks.map(({ rowCategory, colCategories }) => (
              <CategoryGridBlock
                key={rowCategory.id}
                categories={categories}
                rowCategory={rowCategory}
                colCategories={colCategories}
                cellMarks={cellMarks}
                onCellActivate={handleCellActivate}
                disabled={solved}
              />
            ))}
          </div>

          <div key={shakeKey} className={shakeKey > 0 ? `${styles.feedbackArea} pw-shake` : styles.feedbackArea}>
            {mismatchedNames.length > 0 && (
              <div className={styles.errorBanner} role="alert">
                <p className={styles.errorBannerTitle}>Not quite yet.</p>
                <p>
                  Review your connections for: <strong>{mismatchedNames.join(", ")}</strong>
                </p>
              </div>
            )}
            {requestFailed && (
              <div className={styles.errorBanner} role="alert">
                <p className={styles.errorBannerTitle}>The solution could not be checked.</p>
                <p>Your grid is safe—try again.</p>
              </div>
            )}
          </div>

          {!solved && (
            <button
              type="button"
              ref={submitButtonRef}
              onClick={handleSubmit}
              disabled={!derivedState.complete || submitting}
              className={styles.submitButton}
            >
              {submitLabel}
            </button>
          )}
        </div>

        {/* Case board */}
        <div
          id="logic-grid-panel-case"
          role="tabpanel"
          aria-labelledby="logic-grid-tab-case"
          hidden={!isDesktopLayout && activeTab !== "case"}
          data-active={activeTab === "case"}
          className={`${styles.panel} ${styles.panelCase}`}
        >
          <p className={styles.panelTitle}>Case Board</p>
          <p aria-live="polite" className={styles.caseFactCount}>
            {derivedState.confirmedFacts} confirmed fact{derivedState.confirmedFacts === 1 ? "" : "s"}
          </p>
          {visibleCaseRows.length === 0 ? (
            <p className={styles.caseEmpty}>
              No confirmed facts yet.
              <br />
              Place a ✓ in the grid to begin building the case.
            </p>
          ) : (
            <div className={styles.caseRows}>
              {visibleCaseRows.map((row) => (
                <div key={row.primaryEntry} className={styles.caseRow}>
                  <p className={styles.casePrimaryName}>{row.primaryEntry}</p>
                  {row.facts.map((fact) => (
                    <p key={fact.categoryId} className={styles.caseFact}>
                      {fact.categoryName}: <strong>{fact.value}</strong>
                    </p>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryGridBlock({
  categories,
  rowCategory,
  colCategories,
  cellMarks,
  onCellActivate,
  disabled,
}: {
  categories: LogicGridCategoryNormalized[];
  rowCategory: LogicGridCategoryNormalized;
  colCategories: LogicGridCategoryNormalized[];
  cellMarks: LogicGridCellMarks;
  onCellActivate: (catIdA: string, entryA: string, catIdB: string, entryB: string) => void;
  disabled: boolean;
}) {
  return (
    <div className={styles.gridBlock}>
      <div className={styles.gridScroll}>
        <div className={styles.gridInner}>
          {/* Category group header row */}
          <div className={styles.gridRow}>
            <div className={styles.gridCorner} />
            {colCategories.map((cat) => (
              <div
                key={cat.id}
                className={styles.categoryHeaderCell}
                style={{ width: 44 * cat.entries.length }}
              >
                {cat.name}
              </div>
            ))}
          </div>

          {/* Entry header row */}
          <div className={styles.gridRow}>
            <div className={styles.rowCategoryLabel}>{rowCategory.name}</div>
            {colCategories.map((cat) =>
              cat.entries.map((entry) => (
                <div key={`${cat.id}:${entry}`} className={styles.entryHeaderCell} title={entry}>
                  {entry}
                </div>
              ))
            )}
          </div>

          {/* Body rows */}
          {rowCategory.entries.map((rowEntry) => (
            <div key={rowEntry} className={styles.gridRow}>
              <div className={styles.rowLabelCell} title={rowEntry}>
                <span className={styles.rowLabelText}>{rowEntry}</span>
              </div>
              {colCategories.map((cat) =>
                cat.entries.map((colEntry) => {
                  const key = getLogicGridCellKey(categories, rowCategory.id, rowEntry, cat.id, colEntry);
                  const mark = key ? cellMarks[key] : undefined;
                  const state = cellStateLabel(mark);
                  const label = `${rowEntry} and ${colEntry}: ${state}`;
                  return (
                    <button
                      key={key ?? `${cat.id}:${colEntry}`}
                      type="button"
                      className={`${styles.cell} ${styles[`cell_${state}`]}`}
                      onClick={() => onCellActivate(rowCategory.id, rowEntry, cat.id, colEntry)}
                      disabled={disabled}
                      aria-label={label}
                      title={label}
                    >
                      {cellGlyph(mark)}
                    </button>
                  );
                })
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
