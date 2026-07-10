"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  validateLogicGridPuzzleData,
  type LogicGridCategoryNormalized,
} from "@/lib/logicGridCore";

interface LogicGridPuzzleProps {
  puzzleId: string;
  logicGridData: Record<string, unknown>;
  alreadySolved: boolean;
  onSolved: (elapsedSeconds?: number) => void;
}

type CellMark = "check" | "cross";
type CellMarks = Record<string, CellMark>;

const CARD_BG = "rgba(255,255,255,0.03)";
const BORDER = "rgba(255,255,255,0.1)";
const TEAL = "#3891A6";
const GOLD = "#FDE74C";
const SUCCESS = "#38D399";
const DANGER = "#EF4444";
const MUTED = "#8b8b95";
const TEXT = "#F5F5F5";

/** Canonical cell key: the category earlier in `categories` is always first. */
function cellKey(catIdA: string, entryA: string, catIdB: string, entryB: string): string {
  return `${catIdA}::${entryA}::${catIdB}::${entryB}`;
}

function nextMark(current: CellMark | undefined): CellMark | undefined {
  if (current === undefined) return "check";
  if (current === "check") return "cross";
  return undefined;
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

  const [cellMarks, setCellMarks] = useState<CellMarks>({});
  const [crossedClues, setCrossedClues] = useState<Set<number>>(new Set());
  const [solved, setSolved] = useState(alreadySolved);
  const [submitting, setSubmitting] = useState(false);
  const [mismatchedCategories, setMismatchedCategories] = useState<string[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);

  const hydratedRef = useRef(false);
  const startTimeRef = useRef(Date.now());
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate saved scratch-grid state on mount.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/puzzles/${puzzleId}/logic-grid`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setCellMarks((data.cellMarks ?? {}) as CellMarks);
      })
      .catch(() => {})
      .finally(() => {
        hydratedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [puzzleId]);

  // Debounced autosave of scratch state.
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
    }, 800);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [cellMarks, puzzleId]);

  if (!validation.valid || !validation.normalized) {
    return (
      <div
        style={{
          padding: 24,
          borderRadius: 12,
          border: `1px solid ${DANGER}55`,
          background: `${DANGER}0a`,
          color: TEXT,
        }}
      >
        Invalid logic grid puzzle data.
      </div>
    );
  }

  const { intro, categories, clues } = validation.normalized;
  const primary = categories[0];
  const others = categories.slice(1);

  // Derive the final answer straight from the primary-vs-other block's ✓ marks.
  const derivedAnswer: Record<string, Record<string, string>> = {};
  let isComplete = true;
  for (const primaryEntry of primary.entries) {
    const row: Record<string, string> = {};
    for (const other of others) {
      const checked = other.entries.filter(
        (entry) => cellMarks[cellKey(primary.id, primaryEntry, other.id, entry)] === "check"
      );
      if (checked.length === 1) {
        row[other.id] = checked[0];
      } else {
        isComplete = false;
      }
    }
    derivedAnswer[primaryEntry] = row;
  }

  function setMark(catIdA: string, entryA: string, catIdB: string, entryB: string, mark: CellMark | undefined) {
    setCellMarks((prev) => {
      const next = { ...prev };
      const key = cellKey(catIdA, entryA, catIdB, entryB);
      if (mark === undefined) {
        delete next[key];
      } else {
        next[key] = mark;
      }

      // Setting a check clears every other cell in this cell's row/column, within this pair only.
      if (mark === "check") {
        for (const other of categoriesByIdEntries(categories, catIdB)?.entries ?? []) {
          if (other === entryB) continue;
          const k = cellKey(catIdA, entryA, catIdB, other);
          if (next[k] !== "check") next[k] = "cross";
        }
        for (const other of categoriesByIdEntries(categories, catIdA)?.entries ?? []) {
          if (other === entryA) continue;
          const k = cellKey(catIdA, other, catIdB, entryB);
          if (next[k] !== "check") next[k] = "cross";
        }
      }

      return next;
    });
  }

  function handleCellClick(catIdA: string, entryA: string, catIdB: string, entryB: string) {
    if (solved) return;
    const key = cellKey(catIdA, entryA, catIdB, entryB);
    setMark(catIdA, entryA, catIdB, entryB, nextMark(cellMarks[key]));
  }

  function toggleClue(index: number) {
    setCrossedClues((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleSubmit() {
    if (!isComplete || submitting || solved) return;
    setSubmitting(true);
    setMismatchedCategories([]);
    try {
      const res = await fetch(`/api/puzzles/${puzzleId}/logic-grid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ answer: derivedAnswer }),
      });
      const data = await res.json();
      if (!res.ok) return;

      if (data.correct) {
        setSolved(true);
        setShowCelebration(true);
        const elapsedSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
        setTimeout(() => {
          setShowCelebration(false);
          onSolved(elapsedSeconds);
        }, 1800);
      } else {
        setMismatchedCategories((data.mismatchedCategories ?? []) as string[]);
      }
    } catch {
      // network hiccup — leave the grid as-is, the player can retry
    } finally {
      setSubmitting(false);
    }
  }

  const mismatchedNames = mismatchedCategories
    .map((id) => categories.find((c) => c.id === id)?.name)
    .filter(Boolean);

  // One reusable block per row-category: k=0 is the primary-vs-everyone block, k=1..N-2 are the
  // staircase blocks among the remaining non-primary categories.
  const blocks = categories.slice(0, -1).map((rowCategory, k) => ({
    rowCategory,
    colCategories: categories.slice(k + 1),
  }));

  return (
    <div style={{ color: TEXT, position: "relative" }}>
      {showCelebration && <LogicGridCelebration />}

      {solved && (
        <div
          className="mb-6 p-4 rounded-lg border"
          style={{ backgroundColor: `${SUCCESS}1a`, borderColor: SUCCESS, color: TEXT }}
        >
          🧠 You already solved this case!
        </div>
      )}

      {intro && (
        <div
          style={{
            padding: "18px 20px",
            borderRadius: 12,
            border: `1px solid ${TEAL}45`,
            background: `linear-gradient(135deg, rgba(56,145,166,0.08), rgba(0,0,0,0.2))`,
            marginBottom: 20,
            position: "relative",
          }}
        >
          <div style={{ position: "absolute", top: 8, left: 8, width: 14, height: 14, borderTop: `2px solid ${TEAL}80`, borderLeft: `2px solid ${TEAL}80` }} />
          <div style={{ position: "absolute", bottom: 8, right: 8, width: 14, height: 14, borderBottom: `2px solid ${TEAL}80`, borderRight: `2px solid ${TEAL}80` }} />
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "#d6d6da", margin: 0 }}>{intro}</p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Clue list */}
        <div style={{ flex: "0 0 auto", width: "100%", maxWidth: 340 }}>
          <div style={{ borderRadius: 12, border: `1px solid ${BORDER}`, background: CARD_BG, padding: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, marginBottom: 12 }}>
              Clues
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {clues.map((clue, i) => {
                const crossed = crossedClues.has(i);
                return (
                  <label
                    key={i}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      cursor: "pointer",
                      opacity: crossed ? 0.45 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={crossed}
                      onChange={() => toggleClue(i)}
                      style={{ marginTop: 3, accentColor: TEAL }}
                    />
                    <span
                      style={{
                        fontSize: 13,
                        lineHeight: 1.5,
                        textDecoration: crossed ? "line-through" : "none",
                      }}
                    >
                      {i + 1}. {clue}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Elimination grid */}
        <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
          {blocks.map(({ rowCategory, colCategories }) => (
            <CategoryGridBlock
              key={rowCategory.id}
              rowCategory={rowCategory}
              colCategories={colCategories}
              cellMarks={cellMarks}
              onCellClick={handleCellClick}
              disabled={solved}
            />
          ))}

          {mismatchedNames.length > 0 && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 10,
                border: `1px solid ${DANGER}55`,
                background: `${DANGER}0f`,
                fontSize: 13,
              }}
            >
              Not quite — double-check your work on: <strong>{mismatchedNames.join(", ")}</strong>
            </div>
          )}

          {!solved && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isComplete || submitting}
              style={{
                alignSelf: "flex-start",
                padding: "12px 28px",
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 14,
                color: isComplete ? "#0a0a0a" : MUTED,
                backgroundColor: isComplete ? GOLD : "rgba(255,255,255,0.06)",
                border: `1px solid ${isComplete ? GOLD : BORDER}`,
                cursor: isComplete && !submitting ? "pointer" : "not-allowed",
                transition: "all 0.2s",
              }}
            >
              {submitting ? "Checking…" : isComplete ? "Submit Solution" : "Complete the grid above to submit"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function categoriesByIdEntries(
  categories: LogicGridCategoryNormalized[],
  id: string
): LogicGridCategoryNormalized | undefined {
  return categories.find((c) => c.id === id);
}

function CategoryGridBlock({
  rowCategory,
  colCategories,
  cellMarks,
  onCellClick,
  disabled,
}: {
  rowCategory: LogicGridCategoryNormalized;
  colCategories: LogicGridCategoryNormalized[];
  cellMarks: CellMarks;
  onCellClick: (catIdA: string, entryA: string, catIdB: string, entryB: string) => void;
  disabled: boolean;
}) {
  const cellSize = 40;
  const headerColWidth = 120;

  const cellStyle: CSSProperties = {
    width: cellSize,
    height: cellSize,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRight: `1px solid ${BORDER}`,
    borderBottom: `1px solid ${BORDER}`,
    fontSize: 16,
    userSelect: "none",
  };

  return (
    <div style={{ borderRadius: 12, border: `1px solid ${BORDER}`, background: CARD_BG, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "inline-block", minWidth: "100%" }}>
          {/* Category group header row */}
          <div style={{ display: "flex" }}>
            <div style={{ width: headerColWidth, flexShrink: 0, position: "sticky", left: 0, zIndex: 2, background: "#0c0c12" }} />
            {colCategories.map((cat) => (
              <div
                key={cat.id}
                style={{
                  width: cellSize * cat.entries.length,
                  flexShrink: 0,
                  textAlign: "center",
                  padding: "8px 4px",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: TEAL,
                  borderBottom: `1px solid ${BORDER}`,
                  borderLeft: `1px solid ${BORDER}`,
                }}
              >
                {cat.name}
              </div>
            ))}
          </div>

          {/* Entry header row */}
          <div style={{ display: "flex" }}>
            <div
              style={{
                width: headerColWidth,
                flexShrink: 0,
                padding: "6px 10px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: GOLD,
                display: "flex",
                alignItems: "center",
                position: "sticky",
                left: 0,
                zIndex: 2,
                background: "#0c0c12",
                borderBottom: `1px solid ${BORDER}`,
              }}
            >
              {rowCategory.name}
            </div>
            {colCategories.map((cat) =>
              cat.entries.map((entry) => (
                <div
                  key={`${cat.id}:${entry}`}
                  style={{
                    width: cellSize,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                    padding: "4px 2px 6px",
                    fontSize: 10,
                    lineHeight: 1.15,
                    textAlign: "center",
                    color: "#c8c8d0",
                    borderBottom: `1px solid ${BORDER}`,
                    borderLeft: `1px solid ${BORDER}`,
                    writingMode: entry.length > 8 ? "vertical-rl" : undefined,
                    height: 60,
                  }}
                  title={entry}
                >
                  {entry}
                </div>
              ))
            )}
          </div>

          {/* Body rows */}
          {rowCategory.entries.map((rowEntry) => (
            <div key={rowEntry} style={{ display: "flex" }}>
              <div
                style={{
                  width: headerColWidth,
                  flexShrink: 0,
                  padding: "0 10px",
                  fontSize: 12,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  height: cellSize,
                  position: "sticky",
                  left: 0,
                  zIndex: 1,
                  background: "#0c0c12",
                  borderBottom: `1px solid ${BORDER}`,
                }}
                title={rowEntry}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rowEntry}</span>
              </div>
              {colCategories.map((cat) =>
                cat.entries.map((colEntry) => {
                  const key = cellKey(rowCategory.id, rowEntry, cat.id, colEntry);
                  const mark = cellMarks[key];
                  return (
                    <div
                      key={key}
                      onClick={() => onCellClick(rowCategory.id, rowEntry, cat.id, colEntry)}
                      style={{
                        ...cellStyle,
                        cursor: disabled ? "default" : "pointer",
                        color: mark === "check" ? SUCCESS : mark === "cross" ? "#6b6b72" : "transparent",
                        background: mark === "check" ? `${SUCCESS}14` : "transparent",
                      }}
                    >
                      {mark === "check" ? "✓" : mark === "cross" ? "✕" : "·"}
                    </div>
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

// Deterministic pseudo-random spread (coprime-multiplier offsets per index) rather than
// Math.random() — computed once at module load so the celebration component stays pure
// during render, while still looking scattered.
const CONFETTI_COLORS = [SUCCESS, GOLD, TEAL, "#a78bfa"];
const CONFETTI_PIECES = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  left: (i * 47) % 100,
  delay: ((i * 13) % 60) / 100,
  duration: 1.4 + ((i * 29) % 120) / 100,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  size: 6 + ((i * 17) % 80) / 10,
}));

function LogicGridCelebration() {
  const pieces = CONFETTI_PIECES;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 12500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(2,2,2,0.75)",
        backdropFilter: "blur(2px)",
      }}
    >
      <style>{`
        @keyframes lg-confetti-fall {
          0%   { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(420px) rotate(540deg); opacity: 0; }
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {pieces.map((p) => (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: `${p.left}%`,
              top: 0,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              borderRadius: p.id % 2 === 0 ? "50%" : 2,
              animation: `lg-confetti-fall ${p.duration}s ${p.delay}s ease-in forwards`,
            }}
          />
        ))}
      </div>
      <div
        style={{
          padding: "32px 40px",
          borderRadius: 16,
          border: `1px solid ${SUCCESS}55`,
          background: "#0c0c12",
          textAlign: "center",
          boxShadow: `0 0 60px ${SUCCESS}30`,
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 8 }}>🧠</div>
        <p style={{ fontSize: 20, fontWeight: 800, color: TEXT, margin: 0 }}>Case Solved!</p>
      </div>
    </div>
  );
}
