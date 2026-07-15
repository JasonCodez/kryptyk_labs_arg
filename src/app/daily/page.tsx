"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

type DailySummaryEntry = {
  dayNumber: number;
  completedToday: boolean;
  streak: number;
  available: boolean;
};

type DailySummary = {
  word: DailySummaryEntry;
  sudoku: DailySummaryEntry;
  crossword: DailySummaryEntry;
  word_search: DailySummaryEntry;
  jigsaw: DailySummaryEntry;
};

type Accent = "teal" | "gold" | "violet";

const ACCENT_HEX: Record<Accent, string> = {
  teal: "#3D7FFF",
  gold: "#FFC94A",
  violet: "#B24BF3",
};

const CARDS: { key: keyof DailySummary; slug: string; title: string; emoji: string; signInRequired: boolean; accent: Accent }[] = [
  { key: "word", slug: "word", title: "Hidden Word", emoji: "🔤", signInRequired: false, accent: "teal" },
  { key: "sudoku", slug: "sudoku", title: "Sudoku", emoji: "🔢", signInRequired: true, accent: "gold" },
  { key: "crossword", slug: "crossword", title: "Crossword", emoji: "📰", signInRequired: true, accent: "violet" },
  { key: "word_search", slug: "word-search", title: "Word Trove", emoji: "🔍", signInRequired: true, accent: "teal" },
  { key: "jigsaw", slug: "jigsaw", title: "Jigsaw", emoji: "🧩", signInRequired: true, accent: "gold" },
];

function getCountdown(): string {
  const now = new Date();
  const next = new Date();
  next.setUTCHours(24, 0, 0, 0);
  const diff = Math.max(0, next.getTime() - now.getTime());
  const hh = String(Math.floor(diff / 3_600_000)).padStart(2, "0");
  const mm = String(Math.floor((diff % 3_600_000) / 60_000)).padStart(2, "0");
  const ss = String(Math.floor((diff % 60_000) / 1_000)).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/** Shared elevated-card shell — gradient surface + accent corner glow + beveled corner,
 * matching the treatment used across puzzles/leaderboards/dashboard. */
function cardShellStyle(accent: Accent, dim: boolean): React.CSSProperties {
  const hex = ACCENT_HEX[accent];
  return {
    border: `1px solid ${dim ? "rgba(255,255,255,0.08)" : `${hex}55`}`,
    background: dim
      ? "linear-gradient(160deg, var(--pw-surface-hi), var(--pw-surface) 70%)"
      : `radial-gradient(220px 140px at 100% 0%, ${hex}26, transparent 65%), linear-gradient(160deg, var(--pw-surface-hi), var(--pw-surface) 70%)`,
    boxShadow: dim ? undefined : `0 0 20px -10px ${hex}`,
    textDecoration: "none",
  };
}

export default function DailyHubPage() {
  const { status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === "authenticated";
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState("00:00:00");
  // The Debrief lives on its own system (WitnessResult, not the shared dailyPuzzleRecord/streak
  // infra the other five cards use) so its completion status is fetched separately.
  const [debriefCompleted, setDebriefCompleted] = useState(false);

  useEffect(() => {
    setCountdown(getCountdown());
    const id = window.setInterval(() => setCountdown(getCountdown()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/daily/summary", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/debrief/today", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setDebriefCompleted(!!data.completed);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      style={{
        background:
          "radial-gradient(1300px 800px at 15% -10%, rgba(178,75,243,0.2), transparent 62%), radial-gradient(1100px 700px at 90% 0%, rgba(255,201,74,0.12), transparent 58%), radial-gradient(1000px 650px at 50% 100%, rgba(46,217,145,0.09), transparent 60%), #10121F",
        minHeight: "100vh",
      }}
    >
      <main className="pt-24 pb-16 flex flex-col items-center px-3">
        <div className="w-full max-w-5xl mt-6 mb-6 text-center">
          <p className="text-xs font-bold tracking-[0.18em] uppercase" style={{ color: "#3D7FFF" }}>Daily Puzzles</p>
          <h1 className="text-white text-3xl font-black tracking-tight mt-1">Six fresh puzzles, every day</h1>
          <p className="text-xs font-mono mt-2 font-bold" style={{ color: "#FFC94A", textShadow: "0 0 14px rgba(255,201,74,0.4)" }}>
            Resets in {countdown}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 mt-16" style={{ color: "#3D7FFF" }}>
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading today&apos;s puzzles…</span>
          </div>
        ) : (
          <div className="w-full max-w-5xl grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {CARDS.map(({ key, slug, title, emoji, signInRequired, accent }) => {
              const entry = summary?.[key];
              const locked = signInRequired && !isAuthenticated;
              const notReady = !!entry && !entry.available;
              return (
                <Link
                  key={key}
                  href={`/daily/${slug}`}
                  className="pw-bevel pw-press rounded-2xl p-5 flex flex-col gap-3 hover:-translate-y-0.5"
                  style={cardShellStyle(accent, locked || notReady)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-3xl select-none">{emoji}</span>
                    {entry?.completedToday && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(46,217,145,0.15)", color: "#2ED991", boxShadow: "0 0 8px rgba(46,217,145,0.3)" }}>
                        ✓ Done
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-lg">{title}</h2>
                    {entry?.dayNumber ? (
                      <p className="text-xs" style={{ color: "#5B6483" }}>#{entry.dayNumber}</p>
                    ) : null}
                  </div>

                  {locked ? (
                    <p className="text-xs mt-auto" style={{ color: "#8891AC" }}>Sign in to play</p>
                  ) : notReady ? (
                    <p className="text-xs mt-auto" style={{ color: "#8891AC" }}>Not ready yet — check back soon</p>
                  ) : (
                    <div className="mt-auto flex items-center gap-2 text-xs font-semibold" style={{ color: ACCENT_HEX[accent] }}>
                      🔥 {entry?.streak ?? 0} day streak
                    </div>
                  )}
                </Link>
              );
            })}

            {/* The Debrief — separate system (no dayNumber/streak), so rendered by hand rather
                than through CARDS. Violet to match its "featured/special" treatment on the dashboard. */}
            <Link
              href="/debrief"
              className="pw-bevel pw-press rounded-2xl p-5 flex flex-col gap-3 hover:-translate-y-0.5"
              style={cardShellStyle("violet", !isAuthenticated)}
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl select-none">🔍</span>
                {debriefCompleted && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(46,217,145,0.15)", color: "#2ED991", boxShadow: "0 0 8px rgba(46,217,145,0.3)" }}>
                    ✓ Done
                  </span>
                )}
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">The Debrief</h2>
              </div>

              {!isAuthenticated ? (
                <p className="text-xs mt-auto" style={{ color: "#8891AC" }}>Sign in to play</p>
              ) : debriefCompleted ? (
                <p className="text-xs mt-auto" style={{ color: "#5B6483" }}>Come back tomorrow for a new case</p>
              ) : (
                <div className="mt-auto flex items-center gap-2 text-xs font-semibold" style={{ color: "#B24BF3" }}>
                  🕵️ Read the report →
                </div>
              )}
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
