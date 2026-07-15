"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────
type TrackPuzzle = {
  id: string;
  title: string;
  description: string | null;
  difficulty: string;
  points: number | null;
  trackOrder: number;
  concepts: string[];
  solved: boolean;
  attempted: boolean;
};

type Track = {
  name: string;
  icon: string;
  description: string;
  totalCount: number;
  completedCount: number;
  puzzles: TrackPuzzle[];
};

// ─── Color helpers ───────────────────────────────────────────────────────────
const trackBg = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes("html"))             return "from-amber-950/60 to-slate-900/80 border-amber-800/40";
  if (n.includes("css"))              return "from-sky-950/60 to-slate-900/80 border-sky-800/40";
  if (n.includes("js") || n.includes("javascript") || n.includes("dom") || n.includes("async"))
                                      return "from-yellow-950/60 to-slate-900/80 border-yellow-800/40";
  if (n.includes("typescript"))       return "from-blue-950/60 to-slate-900/80 border-blue-800/40";
  if (n.includes("python"))           return "from-green-950/60 to-slate-900/80 border-green-800/40";
  return "from-slate-900/60 to-slate-900/80 border-slate-700/40";
};

const trackAccent = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes("html"))             return "#f59e0b";
  if (n.includes("css"))              return "#38bdf8";
  if (n.includes("js") || n.includes("javascript") || n.includes("dom") || n.includes("async"))
                                      return "#fbbf24";
  if (n.includes("typescript"))       return "#60a5fa";
  if (n.includes("python"))           return "#34d399";
  return "#3891A6";
};

const difficultyColor = (d: string): string => {
  switch (d?.toLowerCase()) {
    case "easy":    return "text-emerald-400 bg-emerald-900/40 border-emerald-700/40";
    case "hard":    return "text-red-400 bg-red-900/40 border-red-700/40";
    case "extreme": return "text-purple-400 bg-purple-900/40 border-purple-700/40";
    default:        return "text-yellow-400 bg-yellow-900/40 border-yellow-700/40"; // medium
  }
};

const conceptPill = (tag: string): string => {
  const t = tag.toLowerCase();
  if (t.startsWith("html"))  return "bg-amber-900/50 text-amber-300 border-amber-700/40";
  if (t.startsWith("css") || t.includes("flex") || t.includes("grid") || t.includes("layout"))
                             return "bg-sky-900/50 text-sky-300 border-sky-700/40";
  if (t.startsWith("js") || t.startsWith("javascript") || t.includes("dom"))
                             return "bg-yellow-900/50 text-yellow-300 border-yellow-700/40";
  if (t.startsWith("typescript") || t.startsWith("ts"))
                             return "bg-blue-900/50 text-blue-300 border-blue-700/40";
  if (t.startsWith("python"))return "bg-green-900/50 text-green-300 border-green-700/40";
  return "bg-slate-700/50 text-slate-300 border-slate-600/40";
};

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ completed, total, accent }: { completed: number; total: number; accent: string }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{completed}/{total} completed</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: accent }}
        />
      </div>
    </div>
  );
}

// ─── Puzzle level card ────────────────────────────────────────────────────────
function LevelCard({ puzzle, index, accent }: { puzzle: TrackPuzzle; index: number; accent: string }) {
  const isLocked = false; // All puzzles accessible — no hard gating
  const stateLabel = puzzle.solved
    ? "Solved"
    : puzzle.attempted
    ? "In Progress"
    : "Not Started";

  return (
    <Link
      href={`/puzzles/${puzzle.id}`}
      className={`group relative flex items-start gap-4 rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
        puzzle.solved
          ? "bg-emerald-950/30 border-emerald-700/40 hover:border-emerald-600/60"
          : puzzle.attempted
          ? "bg-slate-800/60 border-slate-600/60 hover:border-slate-500/80"
          : "bg-slate-900/50 border-slate-700/40 hover:border-slate-600/60"
      } ${isLocked ? "pointer-events-none opacity-50" : ""}`}
    >
      {/* Level number bubble */}
      <div
        className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold border-2 transition-colors"
        style={{
          borderColor: puzzle.solved ? "#10b981" : accent,
          color: puzzle.solved ? "#10b981" : accent,
          backgroundColor: "rgba(0,0,0,0.3)",
        }}
      >
        {puzzle.solved ? "✓" : index + 1}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-white truncate">{puzzle.title}</span>
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${difficultyColor(puzzle.difficulty)}`}
          >
            {puzzle.difficulty}
          </span>
          {puzzle.points && (
            <span className="text-xs text-slate-400">+{puzzle.points} pts</span>
          )}
        </div>

        {puzzle.description && (
          <p className="text-xs text-slate-400 mb-2 line-clamp-1">{puzzle.description}</p>
        )}

        {/* Concept pills */}
        {puzzle.concepts.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {puzzle.concepts.slice(0, 4).map((c) => (
              <span
                key={c}
                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs border ${conceptPill(c)}`}
              >
                {c}
              </span>
            ))}
            {puzzle.concepts.length > 4 && (
              <span className="text-xs text-slate-500">+{puzzle.concepts.length - 4} more</span>
            )}
          </div>
        )}
      </div>

      {/* State badge */}
      <div className="shrink-0 flex flex-col items-end gap-1">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            puzzle.solved
              ? "bg-emerald-900/50 text-emerald-400"
              : puzzle.attempted
              ? "bg-yellow-900/50 text-yellow-400"
              : "bg-slate-800 text-slate-500"
          }`}
        >
          {stateLabel}
        </span>
      </div>
    </Link>
  );
}

// ─── Track card ───────────────────────────────────────────────────────────────
function TrackCard({ track }: { track: Track }) {
  const [open, setOpen] = React.useState(false);
  const accent = trackAccent(track.name);
  const allDone = track.completedCount === track.totalCount && track.totalCount > 0;

  return (
    <div className={`rounded-2xl border bg-gradient-to-br overflow-hidden ${trackBg(track.name)}`}>
      {/* Track header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 px-6 py-5 text-left hover:bg-white/5 transition-colors"
      >
        <span className="text-3xl">{track.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-white">{track.name}</h2>
            {allDone && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-700/60 text-emerald-300 border border-emerald-600/40">
                🏆 Complete
              </span>
            )}
            <span className="text-xs text-slate-400 ml-auto">
              {open ? "▲ collapse" : "▼ see levels"}
            </span>
          </div>
          {track.description && (
            <p className="text-sm text-slate-400 mt-0.5">{track.description}</p>
          )}
          <ProgressBar completed={track.completedCount} total={track.totalCount} accent={accent} />
        </div>
      </button>

      {/* Puzzle list */}
      {open && (
        <div className="px-6 pb-6 space-y-3 border-t border-white/5 pt-4">
          {track.puzzles.map((p, i) => (
            <LevelCard key={p.id} puzzle={p} index={i} accent={accent} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LearningPathsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }
    if (status === "authenticated") {
      fetch("/api/learning-paths")
        .then((r) => r.json())
        .then((data) => {
          if (data.error) throw new Error(data.error);
          setTracks(data.tracks ?? []);
        })
        .catch((e) => setError(String(e.message ?? e)))
        .finally(() => setLoading(false));
    }
  }, [status, router]);

  // ── Global progress summary ──────────────────────────────────────────────
  const totalPuzzles    = tracks.reduce((s, t) => s + t.totalCount, 0);
  const solvedPuzzles   = tracks.reduce((s, t) => s + t.completedCount, 0);
  const tracksComplete  = tracks.filter((t) => t.completedCount === t.totalCount && t.totalCount > 0).length;
  const overallPct      = totalPuzzles > 0 ? Math.round((solvedPuzzles / totalPuzzles) * 100) : 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#020202" }}>
      <main className="max-w-4xl mx-auto px-4 pt-24 pb-12">
        {/* ── Page header ──────────────────────────────────────────── */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">👨‍💻</span>
            <h1 className="text-3xl font-bold text-white">Learning Paths</h1>
          </div>
          <p className="text-slate-400 mb-6">
            Master web development step by step — from HTML basics all the way to TypeScript and Python.
            Each puzzle teaches a concept; solve it to unlock the lesson summary.
          </p>

          {/* Overall progress card */}
          {!loading && !error && totalPuzzles > 0 && (
            <div
              className="rounded-xl border border-slate-700/60 bg-slate-900/60 px-6 py-4"
            >
              <div className="flex flex-wrap items-center gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold" style={{ color: "#3891A6" }}>{overallPct}%</p>
                  <p className="text-xs text-slate-400">Overall</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{solvedPuzzles}<span className="text-slate-500 text-base">/{totalPuzzles}</span></p>
                  <p className="text-xs text-slate-400">Puzzles Solved</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{tracksComplete}<span className="text-slate-500 text-base">/{tracks.length}</span></p>
                  <p className="text-xs text-slate-400">Tracks Complete</p>
                </div>
                <div className="flex-1 min-w-[160px]">
                  <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${overallPct}%`, backgroundColor: "#3891A6" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── States ───────────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#3891A6", borderTopColor: "transparent" }} />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-800/60 bg-red-950/30 px-6 py-5 text-red-300 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && tracks.length === 0 && (
          <div className="rounded-2xl px-8 py-16 text-center" style={{ border: "1px solid rgba(56,145,166,0.2)", background: "rgba(56,145,166,0.04)" }}>
            <p className="text-5xl mb-5">📚</p>
            <h2 className="text-2xl font-black text-white mb-3">Learning tracks, coming soon!</h2>
            <p className="text-sm leading-relaxed max-w-sm mx-auto" style={{ color: "#6B7280" }}>
              We're building structured tracks to help you level up — from beginner puzzles all the way to advanced challenges. Check back soon.
            </p>
          </div>
        )}

        {/* ── Track cards ──────────────────────────────────────────── */}
        {!loading && !error && tracks.length > 0 && (
          <div className="space-y-5">
            {tracks.map((track) => (
              <TrackCard key={track.name} track={track} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
