"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Navbar from "@/components/Navbar";

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

export default function DailyHubPage() {
  const { status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === "authenticated";
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState("00:00:00");

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

  return (
    <div style={{ backgroundColor: "#020202", minHeight: "100vh" }}>
      <Navbar />

      <main className="pt-24 pb-16 flex flex-col items-center px-3">
        <div className="w-full max-w-5xl mt-6 mb-6 text-center">
          <p className="text-xs font-bold tracking-[0.18em] uppercase" style={{ color: "#3891A6" }}>Daily Puzzles</p>
          <h1 className="text-white text-3xl font-black tracking-tight mt-1">Five fresh puzzles, every day</h1>
          <p className="text-xs font-mono mt-2" style={{ color: "#FDE74C" }}>Resets in {countdown}</p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 mt-16" style={{ color: "#3891A6" }}>
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading today&apos;s puzzles…</span>
          </div>
        ) : (
          <div className="w-full max-w-5xl grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {CARDS.map(({ key, slug, title, emoji, signInRequired }) => {
              const entry = summary?.[key];
              const locked = signInRequired && !isAuthenticated;
              return (
                <Link
                  key={key}
                  href={`/daily/${slug}`}
                  className="rounded-2xl p-5 flex flex-col gap-3 transition-transform hover:-translate-y-0.5"
                  style={{
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)",
                    textDecoration: "none",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-3xl select-none">{emoji}</span>
                    {entry?.completedToday && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(56,211,153,0.15)", color: "#38D399" }}>
                        ✓ Done
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-lg">{title}</h2>
                    {entry?.dayNumber ? (
                      <p className="text-xs" style={{ color: "#666" }}>#{entry.dayNumber}</p>
                    ) : null}
                  </div>

                  {locked ? (
                    <p className="text-xs mt-auto" style={{ color: "#AB9F9D" }}>Sign in to play</p>
                  ) : entry && !entry.available ? (
                    <p className="text-xs mt-auto" style={{ color: "#AB9F9D" }}>Not ready yet — check back soon</p>
                  ) : (
                    <div className="mt-auto flex items-center gap-2 text-xs font-semibold" style={{ color: "#FDE74C" }}>
                      🔥 {entry?.streak ?? 0} day streak
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
