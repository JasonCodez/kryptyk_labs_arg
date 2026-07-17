"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LoadingSpinner from "@/components/LoadingSpinner";
import { getPuzzleTypeLabel } from "@/lib/puzzleTypeLabels";

interface HubPuzzle {
  id: string;
  puzzleType?: string;
  isBossPuzzle?: boolean;
  userProgress?: Array<{ solved: boolean }>;
}

interface TypeSummary {
  puzzleType: string;
  total: number;
  solved: number;
  gated: boolean;
}

const TYPE_ICONS: Record<string, string> = {
  general: "🎯",
  riddle: "❓",
  math: "➗",
  jigsaw: "🧩",
  sudoku: "🔢",
  word_search: "🔍",
  word_crack: "💬",
  anagram_blitz: "🔀",
  crack_safe: "🔒",
  vault: "🗝️",
  escape_room: "🚪",
  jim_wyze_case: "🕵️",
  detective_case: "🕵️‍♂️",
  crime_rpg: "🚔",
  parasite_code: "🧬",
  gridlock_file: "🔐",
  blackout: "🕶️",
  code_master: "💻",
  arg: "🌐",
  logic_grid: "🧠",
};

function summarize(puzzles: HubPuzzle[]): TypeSummary[] {
  const byType = new Map<string, HubPuzzle[]>();
  for (const p of puzzles) {
    if (!p.puzzleType) continue;
    const list = byType.get(p.puzzleType);
    if (list) list.push(p);
    else byType.set(p.puzzleType, [p]);
  }

  const summaries: TypeSummary[] = [];
  for (const [puzzleType, group] of byType) {
    summaries.push({
      puzzleType,
      total: group.length,
      solved: group.filter((p) => p.userProgress?.[0]?.solved).length,
      gated: group.some((p) => p.isBossPuzzle),
    });
  }
  return summaries.sort((a, b) => getPuzzleTypeLabel(a.puzzleType).localeCompare(getPuzzleTypeLabel(b.puzzleType)));
}

export default function PuzzlesHub() {
  const { status } = useSession();
  const router = useRouter();
  const [summaries, setSummaries] = useState<TypeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }
    if (status === "authenticated") {
      fetch("/api/puzzles?limit=500")
        .then((res) => (res.ok ? res.json() : []))
        .then((data: HubPuzzle[]) => setSummaries(summarize(data)))
        .catch(() => setSummaries([]))
        .finally(() => setLoading(false));
    }
  }, [status, router]);

  if (status === "loading" || loading) {
    return <LoadingSpinner label="Loading campaigns…" size={180} />;
  }

  return (
    <div
      style={{
        background:
          "radial-gradient(1300px 800px at 15% -10%, rgba(139,61,255,0.2), transparent 62%), radial-gradient(1100px 700px at 90% 0%, rgba(255,201,60,0.12), transparent 58%), radial-gradient(1000px 650px at 50% 100%, rgba(62,217,122,0.09), transparent 60%), #170B26",
      }}
      className="min-h-screen"
    >
      <div className="pt-24 pb-8 md:pb-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">Campaigns</h1>
          <p style={{ color: "#EEF1FA" }}>
            Every puzzle type is its own campaign. Pick one and work through it start to finish.
          </p>
        </div>
      </div>

      <div className="px-4 py-6 md:py-12 max-w-7xl mx-auto">
        {summaries.length === 0 ? (
          <div className="text-center py-20">
            <p style={{ color: "#EEF1FA" }} className="text-lg">No campaigns available yet</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {summaries.map((s) => {
              const pct = s.total > 0 ? Math.round((s.solved / s.total) * 100) : 0;
              const complete = s.solved === s.total && s.total > 0;
              return (
                <Link
                  key={s.puzzleType}
                  href={`/puzzles/type/${s.puzzleType}`}
                  className="group pw-surface pw-bevel pw-press relative overflow-hidden p-5 transition-all duration-300 hover:scale-[1.02] block shadow-skeu-raised-sm"
                  style={{
                    borderColor: complete ? "rgba(255,201,60,0.4)" : "rgba(139,61,255,0.3)",
                    borderWidth: "1px",
                  }}
                >
                  <span className="game-gloss-overlay" aria-hidden style={{ opacity: 0.5 }} />
                  <div className="relative">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-3xl">{TYPE_ICONS[s.puzzleType] || "🧩"}</span>
                    <span
                      className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded"
                      style={{
                        backgroundColor: s.gated ? "rgba(255,201,60,0.15)" : "rgba(255,79,163,0.15)",
                        color: s.gated ? "#FFC93C" : "#FF4FA3",
                      }}
                    >
                      {s.gated ? "Campaign" : "Open Set"}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">{getPuzzleTypeLabel(s.puzzleType)}</h3>
                  <p className="text-xs font-semibold mb-3" style={{ color: "#8891AC" }}>
                    {s.solved} of {s.total} cleared
                  </p>
                  <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(139,61,255,0.12)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: complete
                          ? "#FFC93C"
                          : "linear-gradient(90deg, #8B3DFF, #FFC93C)",
                        boxShadow: pct > 0 ? "0 0 8px rgba(255,201,60,0.4)" : undefined,
                      }}
                    />
                  </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
