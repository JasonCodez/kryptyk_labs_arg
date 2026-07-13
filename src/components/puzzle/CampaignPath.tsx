"use client";

import { useState } from "react";
import Link from "next/link";

interface CampaignPuzzle {
  id: string;
  title: string;
  order: number;
  puzzleType?: string;
  isBossPuzzle?: boolean;
  locked?: boolean;
  createdAt?: string;
  userProgress?: Array<{ solved: boolean }>;
}

function getDisplayTitle(puzzle: CampaignPuzzle): string {
  const raw = typeof puzzle.title === "string" ? puzzle.title.trim() : "";
  return raw || "Untitled Puzzle";
}

/** Groups puzzles into sequential-unlock campaigns — one per puzzleType that has a boss
 * puzzle, matching the server-side gating in src/lib/puzzleProgression.ts. Types without a
 * boss puzzle stay ungated and are simply not campaigns. */
function groupIntoCampaigns(puzzles: CampaignPuzzle[]): Array<{ puzzleType: string; puzzles: CampaignPuzzle[] }> {
  const byType = new Map<string, CampaignPuzzle[]>();
  for (const puzzle of puzzles) {
    if (!puzzle.puzzleType) continue;
    const list = byType.get(puzzle.puzzleType);
    if (list) list.push(puzzle);
    else byType.set(puzzle.puzzleType, [puzzle]);
  }

  const campaigns: Array<{ puzzleType: string; puzzles: CampaignPuzzle[] }> = [];
  for (const [puzzleType, group] of byType) {
    if (!group.some((p) => p.isBossPuzzle)) continue;
    const sorted = [...group].sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });
    campaigns.push({ puzzleType, puzzles: sorted });
  }
  return campaigns;
}

function CampaignTrail({ puzzleType, puzzles }: { puzzleType: string; puzzles: CampaignPuzzle[] }) {
  const [showSolvedModal, setShowSolvedModal] = useState(false);
  const solvedCount = puzzles.filter((p) => p.userProgress?.[0]?.solved).length;
  const nextIndex = puzzles.findIndex((p) => !p.userProgress?.[0]?.solved && !p.locked);

  return (
    <div
      className="pw-surface pw-bevel p-5 sm:p-6 mb-6 relative overflow-hidden"
      style={{
        background:
          "radial-gradient(480px 220px at 20% 0%, rgba(178,75,243,0.14), transparent 60%), linear-gradient(165deg, var(--pw-surface-hi), var(--pw-surface) 60%)",
      }}
    >
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#5B6483" }}>
          <span style={{ color: "#EEF1FA" }}>Progress</span> — {solvedCount} of {puzzles.length} cleared
        </p>
      </div>

      <div className="flex items-start overflow-x-auto no-scrollbar pb-1" style={{ gap: 0 }}>
        {puzzles.map((puzzle, i) => {
          const solved = !!puzzle.userProgress?.[0]?.solved;
          const locked = !!puzzle.locked;
          const isNext = i === nextIndex;
          const lit = !locked; // reachable so far

          let borderColor = "#454E68";
          let bg = "var(--pw-ink-2)";
          let glyphColor = "#7E88A8";
          let boxShadow: string | undefined;
          let animClass = "";

          if (solved) {
            borderColor = "#FFC94A";
            bg = "linear-gradient(155deg, #FFC94A, #AD8932)";
            glyphColor = "#1a1206";
            boxShadow = "0 0 22px rgba(255,201,74,0.45)";
          } else if (isNext) {
            borderColor = "#B24BF3";
            bg = "var(--pw-surface-hi)";
            glyphColor = "#B24BF3";
            animClass = "pw-pulse-violet";
          }

          const nodeShape = puzzle.isBossPuzzle
            ? { clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)", size: 66 }
            : { clipPath: "circle(50%)", size: 58 };

          const node = (
            <div
              className={`flex items-center justify-center font-mono font-bold text-sm shrink-0 ${animClass}`}
              style={{
                width: nodeShape.size,
                height: nodeShape.size,
                clipPath: nodeShape.clipPath,
                border: `2px solid ${borderColor}`,
                background: bg,
                color: glyphColor,
                boxShadow,
              }}
            >
              {solved ? "✓" : puzzle.isBossPuzzle ? "◆" : locked ? "🔒" : i + 1}
            </div>
          );

          return (
            <div key={puzzle.id} className="flex flex-col items-center relative shrink-0" style={{ width: 110 }}>
              {i > 0 && (
                <div
                  className="absolute overflow-hidden"
                  style={{
                    top: 29,
                    left: -55,
                    width: 110,
                    height: 3,
                    background: lit ? "#FFC94A" : "#454E68",
                    boxShadow: lit ? "0 0 10px rgba(255,201,74,0.6)" : undefined,
                  }}
                >
                  {lit && solved && <div className="pw-bead-h" />}
                </div>
              )}
              {puzzle.locked ? (
                <div style={{ cursor: "not-allowed" }}>{node}</div>
              ) : solved ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setShowSolvedModal(true)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowSolvedModal(true); } }}
                  style={{ cursor: "pointer" }}
                >
                  {node}
                </div>
              ) : (
                <Link href={`/puzzles/${puzzle.id}`}>{node}</Link>
              )}
              <div className="mt-3 text-center px-1">
                <p className="text-xs font-semibold leading-tight" style={{ color: "#8891AC" }}>
                  {getDisplayTitle(puzzle)}
                </p>
                <p
                  className="text-[10px] uppercase tracking-wide mt-0.5 font-bold"
                  style={{ color: solved ? "#FFC94A" : isNext ? "#B24BF3" : "#5B6483" }}
                >
                  {solved ? "Cleared" : isNext ? "Up next" : puzzle.isBossPuzzle ? "Boss · Locked" : "Locked"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {showSolvedModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black opacity-60" onClick={() => setShowSolvedModal(false)}></div>
          <div className="relative pw-surface pw-bevel p-6 max-w-sm w-full" style={{ borderColor: "rgba(255,201,74,0.35)", borderWidth: "1px" }}>
            <h3 className="text-lg font-bold text-white mb-2">Already Completed</h3>
            <p style={{ color: "#EEF1FA" }} className="mb-4">
              You&apos;ve already completed and claimed the rewards for this puzzle.
            </p>
            <button
              onClick={() => setShowSolvedModal(false)}
              className="px-4 py-2 rounded font-semibold"
              style={{ backgroundColor: "#3D7FFF", color: "#0B0E1A" }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CampaignPath({ puzzles }: { puzzles: CampaignPuzzle[] }) {
  const campaigns = groupIntoCampaigns(puzzles);
  if (campaigns.length === 0) return null;

  return (
    <div>
      {campaigns.map((c) => (
        <CampaignTrail key={c.puzzleType} puzzleType={c.puzzleType} puzzles={c.puzzles} />
      ))}
    </div>
  );
}
