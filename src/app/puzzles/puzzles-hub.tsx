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
        // Ambient brand glow over neutral navy — mirrors the app body treatment.
        background:
          "radial-gradient(1300px 800px at 15% -10%, color-mix(in srgb, var(--pw-brand-primary) 12%, transparent), transparent 62%), radial-gradient(1100px 700px at 90% 0%, color-mix(in srgb, var(--pw-brand-secondary) 8%, transparent), transparent 58%), var(--pw-bg-base)",
      }}
      className="min-h-screen"
    >
      <div className="pt-24 pb-8 md:pb-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl md:text-5xl font-bold mb-4" style={{ color: "var(--pw-text-primary)" }}>Campaigns</h1>
          <p style={{ color: "var(--pw-text-secondary)" }}>
            Every puzzle type is its own campaign. Pick one and work through it start to finish.
          </p>
        </div>
      </div>

      <div className="px-4 py-6 md:py-12 max-w-7xl mx-auto">
        {summaries.length === 0 ? (
          <div className="text-center py-20">
            <p style={{ color: "var(--pw-text-primary)" }} className="text-lg mb-2">No campaigns available yet</p>
            <p style={{ color: "var(--pw-text-secondary)" }} className="text-sm mb-6">New puzzle campaigns are on the way — try today&apos;s daily puzzles in the meantime.</p>
            <Link
              href="/daily"
              className="inline-block px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: "var(--pw-brand-primary)", color: "var(--pw-text-on-primary)" }}
            >
              Play Daily Puzzles
            </Link>
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
                  className="group pw-surface pw-bevel pw-press relative overflow-hidden p-5 min-h-[44px] transition-all duration-300 hover:scale-[1.02] block shadow-skeu-raised-sm"
                  style={{
                    borderColor: complete ? "var(--pw-success-border)" : "var(--pw-border-default)",
                    borderWidth: "1px",
                  }}
                >
                  <span className="game-gloss-overlay" aria-hidden style={{ opacity: 0.5 }} />
                  <div className="relative">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-3xl" aria-hidden>{TYPE_ICONS[s.puzzleType] || "🧩"}</span>
                    {/* Complete beats the gated/open classification; gated
                        campaigns carry the accent (attention) chip, open sets
                        the primary chip. */}
                    <span
                      className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded"
                      style={
                        complete
                          ? { backgroundColor: "var(--pw-success-surface)", color: "var(--pw-success)", border: "1px solid var(--pw-success-border)" }
                          : s.gated
                            ? { backgroundColor: "color-mix(in srgb, var(--pw-brand-accent) 15%, transparent)", color: "var(--pw-brand-accent-light)" }
                            : { backgroundColor: "color-mix(in srgb, var(--pw-brand-primary) 15%, transparent)", color: "var(--pw-brand-primary-light)" }
                      }
                    >
                      {complete ? "✓ Complete" : s.gated ? "Campaign" : "Open Set"}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold mb-1" style={{ color: "var(--pw-text-primary)" }}>{getPuzzleTypeLabel(s.puzzleType)}</h3>
                  <p className="text-xs font-semibold mb-3" style={{ color: "var(--pw-text-secondary)" }}>
                    {s.solved} of {s.total} cleared
                  </p>
                  <div
                    className="h-1.5 w-full rounded-full overflow-hidden"
                    role="progressbar"
                    aria-label={`${getPuzzleTypeLabel(s.puzzleType)} progress`}
                    aria-valuemin={0}
                    aria-valuemax={s.total}
                    aria-valuenow={s.solved}
                    style={{ background: "rgba(255,255,255,0.08)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: complete ? "var(--pw-success)" : "var(--pw-brand-primary)",
                        boxShadow: pct > 0 ? `0 0 8px color-mix(in srgb, ${complete ? "var(--pw-success)" : "var(--pw-brand-primary)"} 40%, transparent)` : undefined,
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
