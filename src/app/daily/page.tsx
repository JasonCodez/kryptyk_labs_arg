"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import DailyIntroCard from "@/components/onboarding/DailyIntroCard";

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

/* Discovery roles (Phase 8.2A): playable daily cards share the brand primary
   accent; The Debrief is the one "featured/special" card and uses the brand
   accent orange. Gold is reserved for streaks and the reset countdown;
   success green marks completion only. */
type CardRole = "primary" | "accent";

const ROLE_VAR: Record<CardRole, string> = {
  primary: "var(--pw-brand-primary)",
  accent: "var(--pw-brand-accent)",
};

const CARDS: { key: keyof DailySummary; slug: string; title: string; emoji: string; signInRequired: boolean }[] = [
  { key: "word", slug: "word", title: "Hidden Word", emoji: "🔤", signInRequired: false },
  { key: "sudoku", slug: "sudoku", title: "Sudoku", emoji: "🔢", signInRequired: true },
  { key: "crossword", slug: "crossword", title: "Crossword", emoji: "📰", signInRequired: true },
  { key: "word_search", slug: "word-search", title: "Word Trove", emoji: "🔍", signInRequired: true },
  { key: "jigsaw", slug: "jigsaw", title: "Jigsaw", emoji: "🧩", signInRequired: true },
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

/** Shared elevated-card shell — neutral navy surface; the accent appears only
 * as a corner glow + border emphasis on playable cards. Completed cards keep a
 * quiet success border; dim (locked / not-ready) cards stay fully neutral. */
function cardShellStyle(role: CardRole, state: "available" | "completed" | "dim"): React.CSSProperties {
  const accent = ROLE_VAR[role];
  const surface = "linear-gradient(160deg, var(--pw-surface-2), var(--pw-surface-1) 70%)";
  if (state === "dim") {
    return { border: "1px solid var(--pw-border-subtle)", background: surface, textDecoration: "none" };
  }
  if (state === "completed") {
    return {
      border: "1px solid var(--pw-success-border)",
      background: surface,
      textDecoration: "none",
    };
  }
  return {
    border: `1px solid color-mix(in srgb, ${accent} 33%, transparent)`,
    background: `radial-gradient(220px 140px at 100% 0%, color-mix(in srgb, ${accent} 15%, transparent), transparent 65%), ${surface}`,
    boxShadow: `0 0 20px -10px ${accent}`,
    textDecoration: "none",
  };
}

export default function DailyHubPage() {
  const { data: session, status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === "authenticated";
  const onboardingUserId = session?.user
    ? (session.user as { id?: string }).id || session.user.email || "guest"
    : null;
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
        // Ambient brand glow over neutral navy — mirrors the app body treatment.
        background:
          "radial-gradient(1300px 800px at 15% -10%, color-mix(in srgb, var(--pw-brand-primary) 12%, transparent), transparent 62%), radial-gradient(1100px 700px at 90% 0%, color-mix(in srgb, var(--pw-brand-secondary) 8%, transparent), transparent 58%), var(--pw-bg-base)",
        minHeight: "100vh",
      }}
    >
      <main className="pt-24 pb-16 flex flex-col items-center px-3">
        <div className="w-full max-w-5xl mt-6 mb-6 text-center">
          <p className="text-xs font-bold tracking-[0.18em] uppercase" style={{ color: "var(--pw-brand-primary)" }}>Daily Puzzles</p>
          <h1 className="text-3xl font-black tracking-tight mt-1" style={{ color: "var(--pw-text-primary)" }}>Six fresh puzzles, every day</h1>
          {/* Gold = the daily reset/reward role. */}
          <p className="text-xs font-mono mt-2 font-bold" style={{ color: "var(--pw-brand-secondary)", textShadow: "0 0 14px color-mix(in srgb, var(--pw-brand-secondary) 40%, transparent)" }}>
            Resets in {countdown}
          </p>
        </div>

        {isAuthenticated && onboardingUserId && <DailyIntroCard userId={onboardingUserId} />}

        {loading ? (
          <div className="flex items-center gap-2 mt-16" role="status" style={{ color: "var(--pw-brand-primary)" }}>
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden />
            <span className="text-sm">Loading today&apos;s puzzles…</span>
          </div>
        ) : (
          <div className="w-full max-w-5xl grid gap-4 grid-cols-1 min-[430px]:grid-cols-2 md:grid-cols-3">
            {CARDS.map(({ key, slug, title, emoji, signInRequired }) => {
              const entry = summary?.[key];
              const locked = signInRequired && !isAuthenticated;
              const notReady = !!entry && !entry.available;
              const completed = !!entry?.completedToday;
              const streak = entry?.streak ?? 0;
              const state = locked || notReady ? "dim" : completed ? "completed" : "available";
              return (
                <Link
                  key={key}
                  href={`/daily/${slug}`}
                  className={`pw-bevel pw-press rounded-2xl p-5 min-h-[44px] flex flex-col gap-3 relative overflow-hidden shadow-skeu-raised-sm${state === "available" ? " hover:-translate-y-0.5" : ""}`}
                  style={cardShellStyle("primary", state)}
                >
                  <span className="game-gloss-overlay" aria-hidden style={{ opacity: 0.5 }} />
                  <div className="flex items-center justify-between">
                    <span className="text-3xl select-none" aria-hidden>{locked ? "🔒" : emoji}</span>
                    {completed && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--pw-success-surface)", color: "var(--pw-success)", border: "1px solid var(--pw-success-border)" }}>
                        ✓ Done
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 className="font-bold text-lg" style={{ color: "var(--pw-text-primary)" }}>{title}</h2>
                    {entry?.dayNumber ? (
                      <p className="text-xs" style={{ color: "var(--pw-text-muted)" }}>#{entry.dayNumber}</p>
                    ) : null}
                  </div>

                  {locked ? (
                    <p className="text-xs mt-auto" style={{ color: "var(--pw-text-secondary)" }}>Sign in to play</p>
                  ) : notReady ? (
                    <p className="text-xs mt-auto" style={{ color: "var(--pw-text-secondary)" }}>Not ready yet — check back soon</p>
                  ) : (
                    <div className="mt-auto flex items-center justify-between gap-2 text-xs font-semibold">
                      <span style={{ color: completed ? "var(--pw-text-secondary)" : "var(--pw-brand-primary)" }}>
                        {completed ? "View result" : "Play now"} →
                      </span>
                      {streak > 0 && (
                        <span
                          className="px-2 py-0.5 rounded-full"
                          style={{ background: "color-mix(in srgb, var(--pw-brand-secondary) 14%, transparent)", color: "var(--pw-brand-secondary)" }}
                          aria-label={`${streak} day streak`}
                        >
                          🔥 {streak}
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}

            {/* The Debrief — separate system (no dayNumber/streak), so rendered by hand rather
                than through CARDS. Brand accent (orange) marks it as the featured/investigative special. */}
            <Link
              href="/debrief"
              className={`pw-bevel pw-press rounded-2xl p-5 min-h-[44px] flex flex-col gap-3 relative overflow-hidden shadow-skeu-raised-sm${isAuthenticated && !debriefCompleted ? " hover:-translate-y-0.5" : ""}`}
              style={cardShellStyle("accent", !isAuthenticated ? "dim" : debriefCompleted ? "completed" : "available")}
            >
              <span className="game-gloss-overlay" aria-hidden style={{ opacity: 0.5 }} />
              <div className="flex items-center justify-between">
                <span className="text-3xl select-none" aria-hidden>{!isAuthenticated ? "🔒" : "🔍"}</span>
                {debriefCompleted && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--pw-success-surface)", color: "var(--pw-success)", border: "1px solid var(--pw-success-border)" }}>
                    ✓ Done
                  </span>
                )}
              </div>
              <div>
                <h2 className="font-bold text-lg" style={{ color: "var(--pw-text-primary)" }}>The Debrief</h2>
              </div>

              {!isAuthenticated ? (
                <p className="text-xs mt-auto" style={{ color: "var(--pw-text-secondary)" }}>Sign in to play</p>
              ) : debriefCompleted ? (
                <p className="text-xs mt-auto" style={{ color: "var(--pw-text-muted)" }}>Come back tomorrow for a new case</p>
              ) : (
                <div className="mt-auto flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--pw-brand-accent)" }}>
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
