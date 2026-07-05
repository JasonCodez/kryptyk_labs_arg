"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { getPuzzleTypeLabel } from "@/lib/puzzleTypeLabels";

const PUZZLE_TYPES: { value: string; label: string }[] = [
  { value: "", label: "All Types" },
  { value: "riddle", label: "Riddle" },
  { value: "general", label: "General" },
  { value: "math", label: "Math" },
  { value: "code_master", label: "Code" },
  { value: "word_crack", label: "Hidden Word" },
  { value: "crack_safe", label: "Safe Crack" },
  { value: "word_search", label: "Word Trove" },
  { value: "anagram_blitz", label: "Anagram" },
  { value: "blackout", label: "Declassify" },
  { value: "arg", label: "ARG" },
  { value: "detective_case", label: "Detective" },
  { value: "crime_rpg", label: "Crime Case" },
  { value: "parasite_code", label: "Parasite Code" },
  { value: "sudoku", label: "Sudoku" },
  { value: "jigsaw", label: "Jigsaw" },
  { value: "escape_room", label: "Escape Room" },
  { value: "jim_wyze_case", label: "Jim Wyze Case" },
  { value: "gridlock_file", label: "Gridlock File" },
];

const DIFFICULTIES = ["", "EASY", "MEDIUM", "HARD", "EXPERT"];

const DIFF_STYLE: Record<string, { bg: string; color: string }> = {
  EASY:   { bg: "rgba(16,185,129,0.12)", color: "#4ade80" },
  MEDIUM: { bg: "rgba(253,231,76,0.12)",  color: "#FDE74C" },
  HARD:   { bg: "rgba(239,68,68,0.12)",   color: "#f87171" },
  EXPERT: { bg: "rgba(56,145,166,0.15)",  color: "#3891A6" },
};

interface Puzzle {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  puzzleType: string;
  xpReward: number;
  solved: boolean;
  solveCount: number;
  category: { name: string } | null;
}

function SearchPageInner() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [type, setType] = useState(searchParams.get("type") ?? "");
  const [difficulty, setDifficulty] = useState(searchParams.get("difficulty") ?? "");
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback(async (query: string, puzzleType: string, diff: string) => {
    if (!query.trim() && !puzzleType && !diff) {
      setPuzzles([]);
      setTotal(0);
      setSearched(false);
      return;
    }
    setLoading(true);
    setError("");
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (puzzleType) params.set("type", puzzleType);
      if (diff) params.set("difficulty", diff);
      const res = await fetch(`/api/search?${params}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setPuzzles(data.puzzles ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search on input change
  useEffect(() => {
    const timer = setTimeout(() => doSearch(q, type, difficulty), 350);
    return () => clearTimeout(timer);
  }, [q, type, difficulty, doSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(q, type, difficulty);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#020202" }}>
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 pt-20 pb-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight mb-1" style={{ color: "#FDE74C" }}>
            PUZZLE SEARCH
          </h1>
          <p className="text-sm" style={{ color: "#9ca3af" }}>
            Find puzzles by name, type, or difficulty
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="space-y-3 mb-8">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 select-none">🔍</span>
            <input
              ref={inputRef}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search puzzles..."
              className="w-full pl-11 pr-4 py-3 rounded-xl text-white placeholder-gray-500 text-base"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                outline: "none",
              }}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Type filter */}
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm text-white"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
            >
              {PUZZLE_TYPES.map((t) => (
                <option key={t.value} value={t.value} style={{ background: "#020202" }}>
                  {t.label}
                </option>
              ))}
            </select>

            {/* Difficulty filter */}
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm text-white"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d} style={{ background: "#020202" }}>
                  {d || "All Difficulties"}
                </option>
              ))}
            </select>

            {(q || type || difficulty) && (
              <button
                type="button"
                onClick={() => { setQ(""); setType(""); setDifficulty(""); }}
                className="px-3 py-2 rounded-lg text-sm"
                style={{ color: "#9ca3af", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                Clear
              </button>
            )}
          </div>
        </form>

        {/* Results */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-20 rounded-xl animate-pulse"
                style={{ background: "rgba(255,255,255,0.04)", animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-12" style={{ color: "#f87171" }}>{error}</div>
        )}

        {!loading && searched && puzzles.length === 0 && !error && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-lg font-bold text-white mb-1">No puzzles found</p>
            <p className="text-sm" style={{ color: "#9ca3af" }}>
              Try different keywords or remove filters
            </p>
          </div>
        )}

        {!loading && puzzles.length > 0 && (
          <>
            <p className="text-sm mb-4" style={{ color: "#9ca3af" }}>
              {total} puzzle{total !== 1 ? "s" : ""} found
            </p>
            <div className="space-y-3">
              {puzzles.map((puzzle) => {
                const dStyle = DIFF_STYLE[puzzle.difficulty] ?? { bg: "rgba(255,255,255,0.05)", color: "#9ca3af" };
                return (
                  <Link
                    key={puzzle.id}
                    href={`/puzzles/${puzzle.id}`}
                    className="flex items-start justify-between p-4 rounded-xl transition-all hover:scale-[1.01]"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: puzzle.solved
                        ? "1px solid rgba(56,211,153,0.3)"
                        : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div className="flex-1 min-w-0 mr-4">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-white truncate">{puzzle.title}</span>
                        {puzzle.solved && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(56,211,153,0.15)", color: "#38D399" }}>
                            ✓ SOLVED
                          </span>
                        )}
                      </div>
                      <p className="text-sm truncate" style={{ color: "#9ca3af" }}>
                        {puzzle.description || "No description"}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: dStyle.bg, color: dStyle.color }}>
                          {puzzle.difficulty}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "#6b7280" }}>
                          {getPuzzleTypeLabel(puzzle.puzzleType ?? "")}
                        </span>
                        {puzzle.category && (
                          <span className="text-xs" style={{ color: "#6b7280" }}>
                            {puzzle.category.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold" style={{ color: "#FDE74C" }}>
                        +{puzzle.xpReward ?? 50} XP
                      </div>
                      <div className="text-xs mt-1" style={{ color: "#6b7280" }}>
                        {puzzle.solveCount} solves
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageInner />
    </Suspense>
  );
}
