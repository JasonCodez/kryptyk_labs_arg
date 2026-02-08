"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import FilterBar from "@/components/puzzle/FilterBar";
import { StarRating } from "@/components/puzzle/StarRating";
import Navbar from "@/components/Navbar";
import { detectWebGLSupport } from "@/lib/webglSupport";

interface Puzzle {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  rarity?: string;
  order: number;
  pointsReward?: number;
  createdAt?: string;
  completionCount?: number;
  attemptCount?: number;
  puzzleType?: string;
  escapeRoom?: { id: string; roomTitle?: string; roomDescription?: string } | null;
  // server-reported escape-room lockout state
  escapeRoomFailed?: boolean;
  escapeRoomFailedReason?: string | null;
  // server-reported detective-case lockout state
  detectiveCaseFailed?: boolean;
  detectiveCaseFailedReason?: string | null;
  category: {
    id: string;
    name: string;
  };
  userProgress?: Array<{
    id: string;
    solved: boolean;
    attempts: number;
  }>;
  isTeamPuzzle?: boolean;
  // locally-annotated fields
  failed?: boolean;
  failedReason?: string | null;
  completedElapsedSeconds?: number | null;
}

interface RatingStats {
  puzzleId: string;
  averageRating: number;
  ratingCount: number;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  puzzleCount: number;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "#10B981",
  medium: "#F59E0B",
  hard: "#EF4444",
  extreme: "#3891A6",
};

const RARITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  common: { bg: "rgba(200, 200, 200, 0.1)", text: "#CCCCCC", border: "#CCCCCC" },
  uncommon: { bg: "rgba(76, 175, 80, 0.1)", text: "#4CAF50", border: "#4CAF50" },
  rare: { bg: "rgba(56, 145, 166, 0.1)", text: "#3891A6", border: "#3891A6" },
  epic: { bg: "rgba(124, 58, 237, 0.08)", text: "#7C3AED", border: "#7C3AED" },
  legendary: { bg: "rgba(255, 193, 7, 0.1)", text: "#FFC107", border: "#FFC107" },
};

const CATEGORY_ICONS: Record<string, string> = {
  sudoku: "🔢",
  logic: "🧠",
  crypto: "🔐",
  word: "🔤",
  riddle: "❓",
  math: "➗",
  spatial: "📐",
  pattern: "🔁",
  memory: "🧩",
  adventure: "🗺️",
  mystery: "🕵️‍♂️",
  stealth: "🕶️",
};

function getDisplayTitle(puzzle: any) {
  const puzzleTitle = typeof puzzle?.title === 'string' ? puzzle.title.trim() : '';
  const escapeTitle = typeof puzzle?.escapeRoom?.roomTitle === 'string' ? puzzle.escapeRoom.roomTitle.trim() : '';

  // Escape rooms should display their roomTitle even if the Puzzle row has a default fallback title.
  if (puzzle?.puzzleType === 'escape_room' && escapeTitle) return escapeTitle;
  if ((puzzleTitle === '' || puzzleTitle === 'Untitled Puzzle') && escapeTitle) return escapeTitle;

  const raw = (puzzle && (puzzle.title ?? puzzle.name ?? puzzle?.escapeRoom?.roomTitle)) as unknown;
  const title = typeof raw === 'string' ? raw.trim() : '';
  return title || 'Untitled Puzzle';
}

function getDisplayDescription(puzzle: any) {
  const raw = (puzzle && (puzzle.description ?? puzzle.summary ?? puzzle.content ?? puzzle?.escapeRoom?.roomDescription)) as unknown;
  const desc = typeof raw === 'string' ? raw.trim() : '';
  return desc || 'No description yet.';
}

function formatFailedReason(reason: string | null | undefined) {
  if (!reason) return null;
  if (reason === 'time_limit') return 'Time limit reached';
  if (reason === 'time_expired') return 'Time expired';
  if (reason === 'max_attempts') return 'Maximum submissions reached';
  if (reason === 'given_up') return 'Gave up';
  if (reason === 'incorrect_submission') return 'Wrong answer (case locked)';
  return 'Failed';
}

export default function PuzzlesList({ initialCategory = "all" }: { initialCategory?: string }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredPuzzles, setFilteredPuzzles] = useState<Puzzle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("unsolved");
  const [sortBy, setSortBy] = useState<string>("order");
  const [sortOrder, setSortOrder] = useState<string>("asc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [totalUsers, setTotalUsers] = useState(0);
  const [ratingStats, setRatingStats] = useState<Record<string, RatingStats>>({})
  const [focusedPuzzleId, setFocusedPuzzleId] = useState<string | null>(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamModalMessage, setTeamModalMessage] = useState("");
  const [teamModalTitle, setTeamModalTitle] = useState("Notice");
  const [teamModalConfirmText, setTeamModalConfirmText] = useState<string>("OK");
  const [teamModalCancelText, setTeamModalCancelText] = useState<string | null>(null);
  const [teamModalConfirmAction, setTeamModalConfirmAction] = useState<(() => void) | null>(null);

  useEffect(function() {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    if (status === "authenticated") {
      fetchData();
    }
  }, [status, router]);

  // When arriving via hash (#puzzle-<id>), focus that puzzle card
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash || "";
    if (hash.startsWith("#puzzle-")) {
      const id = hash.replace("#puzzle-", "");
      if (id) {
        setFocusedPuzzleId(id);
        // Allow render to complete then scroll + highlight
        setTimeout(() => {
          const el = document.getElementById(`puzzle-${id}`);
          if (el) {
            try {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              el.classList.add("ring-4", "ring-yellow-400");
              // remove highlight after 3s
              setTimeout(() => {
                el.classList.remove("ring-4", "ring-yellow-400");
              }, 3000);
            } catch (e) {
              // ignore
            }
          }
        }, 300);
      }
    }
  }, []);

  // Also respond to future hash changes (client-side navigation without remount)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleHash = () => {
      const hash = window.location.hash || "";
      if (hash.startsWith("#puzzle-")) {
        const id = hash.replace("#puzzle-", "");
        if (id) {
          setFocusedPuzzleId(id);
          // Allow render to complete then scroll + highlight
          setTimeout(() => {
            const el = document.getElementById(`puzzle-${id}`);
            if (el) {
              try {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.classList.add("ring-4", "ring-yellow-400");
                setTimeout(() => {
                  el.classList.remove("ring-4", "ring-yellow-400");
                }, 3000);
              } catch (e) {
                // ignore
              }
            }
          }, 100);
        }
      } else {
        setFocusedPuzzleId(null);
      }
    };

    // run once and subscribe to future hash changes
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [puzzles, selectedCategory, selectedDifficulty, selectedStatus, searchQuery, sortBy, sortOrder]);

  // Which puzzles to display: either focus a single puzzle (via hash) or the filtered list
  const displayed = focusedPuzzleId ? puzzles.filter((p) => p.id === focusedPuzzleId) : filteredPuzzles;

  async function fetchData() {
    try {
      const [puzzlesRes, categoriesRes, usersRes] = await Promise.all([
        fetch(`/api/puzzles?limit=100`),
        fetch("/api/puzzle-categories"),
        fetch("/api/users/count"),
      ]);

      if (puzzlesRes.ok) {
        const puzzlesData = await puzzlesRes.json();
        // Annotate puzzles with local failed flag/reason (Sudoku) plus server-reported escape-room lockout.
        const annotated = puzzlesData.map((p: any) => {
          const escapeRoomFailed = p?.escapeRoomFailed === true;
          const detectiveCaseFailed = p?.detectiveCaseFailed === true;
          const baseFailedFlag = escapeRoomFailed || detectiveCaseFailed;
          const baseFailedReason: string | null = escapeRoomFailed
            ? (p?.escapeRoomFailedReason ?? null)
            : (detectiveCaseFailed ? (p?.detectiveCaseFailedReason ?? 'incorrect_submission') : null);
          let failedFlag = baseFailedFlag;
          let failedReason: string | null = baseFailedReason;
          let completedElapsedSeconds: number | null = null;
          try {
            if (typeof window !== 'undefined') {
              const raw = localStorage.getItem(`sudoku-failed:${p.id}`);
              if (raw) {
                failedFlag = true;
                try {
                  const parsed = JSON.parse(raw);
                  if (parsed && parsed.reason) failedReason = parsed.reason;
                } catch (e) {
                  // older format: timestamp only
                  failedReason = null;
                }
              }
              // read completion elapsed seconds if present
              const compRaw = localStorage.getItem(`sudoku-completed:${p.id}`);
              if (compRaw) {
                try {
                  const cp = JSON.parse(compRaw);
                  if (cp && typeof cp.elapsedSeconds === 'number') completedElapsedSeconds = cp.elapsedSeconds;
                } catch (e) {
                  // ignore
                }
              }
            }
          } catch (e) {
            failedFlag = baseFailedFlag;
            failedReason = baseFailedReason;
          }
          return { ...p, failed: failedFlag, failedReason, completedElapsedSeconds };
        });
        setPuzzles(annotated);
        
        // Fetch ratings for all puzzles
        const ratingsData: Record<string, RatingStats> = {};
        await Promise.all(
          puzzlesData.map(async (puzzle: Puzzle) => {
            try {
              const ratingRes = await fetch(
                `/api/puzzles/ratings-stats?puzzleId=${puzzle.id}`
              );
              if (ratingRes.ok) {
                const stats = await ratingRes.json();
                ratingsData[puzzle.id] = stats;
              }
            } catch (error) {
              console.error(`Failed to fetch ratings for puzzle ${puzzle.id}:`, error);
            }
          })
        );
        setRatingStats(ratingsData);
      }

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        const filteredCategories = (categoriesData || []).filter((c: any) => {
          const name = (c && c.name) ? String(c.name).toLowerCase().trim() : "";
          return name !== "team test";
        });
        setCategories(filteredCategories);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setTotalUsers(usersData.count || 0);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handlePuzzleClick(puzzle: Puzzle, opts?: { skipWebGLCheck?: boolean }) {
    const isEscapeRoom = puzzle?.puzzleType === 'escape_room' || !!puzzle?.escapeRoom;

    if (isEscapeRoom && !opts?.skipWebGLCheck) {
      const webgl = detectWebGLSupport();
      if (!webgl.available) {
        setTeamModalTitle('WebGL Unavailable');
        setTeamModalMessage(
          "Your browser doesn't currently have WebGL enabled/available. The escape room may run in compatibility mode (reduced visuals/performance). Continue anyway?"
        );
        setTeamModalConfirmText('Continue');
        setTeamModalCancelText('Cancel');
        setTeamModalConfirmAction(() => {
          return () => {
            void handlePuzzleClick(puzzle, { skipWebGLCheck: true });
          };
        });
        setShowTeamModal(true);
        return;
      }
    }

    if (isEscapeRoom && puzzle.escapeRoomFailed) {
      setTeamModalTitle('Locked');
      setTeamModalConfirmText('OK');
      setTeamModalCancelText(null);
      setTeamModalConfirmAction(null);
      setTeamModalMessage("You already failed this escape room. It is locked and cannot be replayed.");
      setShowTeamModal(true);
      return;
    }

    const isDetectiveCase = puzzle?.puzzleType === 'detective_case';
    if (isDetectiveCase && puzzle.detectiveCaseFailed) {
      setTeamModalTitle('Locked');
      setTeamModalConfirmText('OK');
      setTeamModalCancelText(null);
      setTeamModalConfirmAction(null);
      setTeamModalMessage("You already made an incorrect submission on this case. It is locked forever and cannot be retried.");
      setShowTeamModal(true);
      return;
    }

    // Non-team puzzles: go to puzzle page
    if (!puzzle.isTeamPuzzle) {
      router.push(`/puzzles/${puzzle.id}`);
      return;
    }

    // Team puzzle: verify team membership
    try {
      const res = await fetch(`/api/user/team-admin?puzzleId=${puzzle.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.teamId && (data.isMember || data.isAdmin)) {
          router.push(`/teams/${data.teamId}/lobby?puzzleId=${encodeURIComponent(puzzle.id)}`);
          return;
        }
      }
      setTeamModalTitle('Team Required');
      setTeamModalConfirmText('OK');
      setTeamModalCancelText(null);
      setTeamModalConfirmAction(null);
      setTeamModalMessage("You must be part of a team to start team puzzles.");
      setShowTeamModal(true);
    } catch (e) {
      setTeamModalTitle('Error');
      setTeamModalConfirmText('OK');
      setTeamModalCancelText(null);
      setTeamModalConfirmAction(null);
      setTeamModalMessage("Unable to verify team membership. Please try again later.");
      setShowTeamModal(true);
    }
  }

  function closeTeamModal() {
    setShowTeamModal(false);
    setTeamModalMessage("");
    setTeamModalTitle('Notice');
    setTeamModalConfirmText('OK');
    setTeamModalCancelText(null);
    setTeamModalConfirmAction(null);
  }

  function onTeamModalConfirm() {
    const action = teamModalConfirmAction;
    closeTeamModal();
    try {
      action?.();
    } catch {
      // ignore
    }
  }

  function applyFilters() {
    let filtered = puzzles;

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter((p) => p.category.id === selectedCategory);
    }

    // Filter by difficulty
    if (selectedDifficulty !== "all") {
      filtered = filtered.filter((p) => p.difficulty === selectedDifficulty);
    }

    // Filter by status
    if (selectedStatus !== "all") {
      if (selectedStatus === "solved") {
        filtered = filtered.filter((p) => p.userProgress && p.userProgress.length > 0 && p.userProgress[0].solved);
      } else if (selectedStatus === "in-progress") {
        filtered = filtered.filter(
          (p) =>
            p.userProgress &&
            p.userProgress.length > 0 &&
            !p.userProgress[0].solved &&
            (p.userProgress[0].attempts || 0) > 0
        );
      } else if (selectedStatus === "unsolved") {
        // Exclude puzzles that are marked as failed and only include truly unsolved puzzles
        filtered = filtered.filter(
          (p) =>
            p.failed !== true && (
              !p.userProgress ||
              p.userProgress.length === 0 ||
              (!p.userProgress[0]?.solved && (p.userProgress[0]?.attempts || 0) === 0)
            )
        );
      } else if (selectedStatus === "failed") {
        filtered = filtered.filter((p) => p.failed === true);
      }
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    if (sortBy === "points" && sortOrder === "desc") {
      filtered.sort((a, b) => (b.pointsReward || 0) - (a.pointsReward || 0));
    } else if (sortBy === "points" && sortOrder === "asc") {
      filtered.sort((a, b) => (a.pointsReward || 0) - (b.pointsReward || 0));
    } else if (sortBy === "difficulty") {
      const diffOrder: Record<string, number> = { easy: 1, medium: 2, hard: 3, extreme: 4 };
      filtered.sort((a, b) => {
        const orderA = diffOrder[a.difficulty.toLowerCase()] || 0;
        const orderB = diffOrder[b.difficulty.toLowerCase()] || 0;
        return sortOrder === "asc" ? orderA - orderB : orderB - orderA;
      });
    } else if (sortBy === "releaseDate") {
      filtered.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      });
    } else {
      filtered.sort((a, b) => a.order - b.order);
    }

    setFilteredPuzzles(filtered);
  }

  if (status === "loading" || loading) {
    return (
      <main className="min-h-screen" style={{ backgroundColor: '#020202' }}>
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <p style={{ color: '#FDE74C' }} className="text-lg">Loading puzzles...</p>
        </div>
      </main>
    );
  }

  return (
    <div style={{ backgroundColor: '#020202' }} className="min-h-screen">
      {/* Navigation */}
      <Navbar />

      {/* Header */}
      <div className="pt-24 pb-16 px-4" style={{ backgroundImage: 'linear-gradient(135deg, rgba(56, 145, 166, 0.1) 0%, rgba(253, 231, 76, 0.05) 100%)' }}>
        <div className="max-w-7xl mx-auto">
          <h1 className="text-5xl font-bold text-white mb-4">Puzzles</h1>
          <p style={{ color: '#DDDBF1' }}>Tackle challenges at your own pace. Win points solo or team up for collaborative solving</p>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-12 max-w-7xl mx-auto">
        {/* Search and Filters */}
        <div className="mb-12">
          {/* FilterBar Component */}
          <div>
            <FilterBar
              onSearch={setSearchQuery}
              onDifficultyChange={setSelectedDifficulty}
              onStatusChange={setSelectedStatus}
              onSortChange={(by, order) => {
                setSortBy(by);
                setSortOrder(order);
              }}
              currentSearch={searchQuery}
              currentDifficulty={selectedDifficulty}
              currentStatus={selectedStatus}
              currentSort={{ by: sortBy, order: sortOrder }}
            />
          </div>

          {/* Category Filters */}
          <div className="mt-6 mb-8">
            <h3 className="text-sm font-semibold mb-3" style={{ color: '#FDE74C' }}>CATEGORIES</h3>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedCategory === "all"
                    ? "scale-105"
                    : "opacity-70 hover:opacity-100"
                }`}
                style={{
                  backgroundColor: selectedCategory === "all" ? "#3891A6" : "rgba(56, 145, 166, 0.2)",
                  color: selectedCategory === "all" ? "#020202" : "#DDDBF1",
                }}
              >
                All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    selectedCategory === cat.id
                      ? "scale-105"
                      : "opacity-70 hover:opacity-100"
                  }`}
                  style={{
                    backgroundColor: selectedCategory === cat.id ? (cat.color || "#3891A6") : "rgba(56, 145, 166, 0.2)",
                    color: selectedCategory === cat.id ? "#020202" : "#DDDBF1",
                  }}
                >
                  <span className="mr-2">{cat.icon || CATEGORY_ICONS[cat.name.toLowerCase()] || '🧩'}</span>
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* View Mode Toggle and Results Count */}
          <div className="flex items-center justify-between mb-4">
            <p style={{ color: '#AB9F9D' }} className="text-sm">
              {filteredPuzzles.length} puzzle{filteredPuzzles.length !== 1 ? "s" : ""} found
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-all`}
                style={{
                  backgroundColor: viewMode === "grid" ? "#3891A6" : "rgba(56, 145, 166, 0.2)",
                  color: viewMode === "grid" ? "#020202" : "#DDDBF1",
                  boxShadow: viewMode === "grid" ? "0 0 0 2px #FDE74C" : "none",
                  opacity: viewMode === "grid" ? 1 : 0.6,
                }}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-all`}
                style={{
                  backgroundColor: viewMode === "list" ? "#3891A6" : "rgba(56, 145, 166, 0.2)",
                  color: viewMode === "list" ? "#020202" : "#DDDBF1",
                  boxShadow: viewMode === "list" ? "0 0 0 2px #FDE74C" : "none",
                  opacity: viewMode === "list" ? 1 : 0.6,
                }}
              >
                List
              </button>
            </div>
          </div>
        </div>

        {/* Puzzles Display */}
        {focusedPuzzleId && (
          <div className="mb-4">
            <button
              onClick={() => {
                setFocusedPuzzleId(null);
                // remove hash from URL
                try { history.replaceState(null, "", "/puzzles"); } catch (e) {}
              }}
              className="px-3 py-1 rounded bg-slate-700 text-white text-sm mb-4"
            >
              Show all puzzles
            </button>
          </div>
        )}
        {displayed.length === 0 ? (
          <div className="text-center py-20">
            <p style={{ color: '#DDDBF1' }} className="text-lg mb-2">No puzzles match your filters</p>
            <p style={{ color: '#AB9F9D' }} className="text-sm">Try adjusting your search or filters</p>
          </div>
          ) : viewMode === "grid" ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayed.map((puzzle, idx) => {
              const progress = puzzle.userProgress?.[0];
              // Treat puzzles with attempts >= 5 and not solved as 'failed'
              const status = progress?.solved
                ? "solved"
                : (puzzle as any).failed
                ? "failed"
                : (progress && (progress.attempts || 0) >= 5)
                ? "failed"
                : progress?.attempts
                ? "in-progress"
                : "unsolved";
              const statusConfig: Record<string, { color: string; label: string }> = {
                solved: { color: "#38D399", label: "✓ Solved" },
                "in-progress": { color: "#FDE74C", label: "~ In Progress" },
                failed: { color: "#EF4444", label: "✗ Failed" },
                unsolved: { color: "#AB9F9D", label: "○ Unsolved" },
              };

              if (status === 'solved') {
                return (
                  <Link
                    id={`puzzle-${puzzle.id}`}
                    key={puzzle.id}
                    href={`/puzzles/${puzzle.id}`}
                  className="group rounded-lg border p-6 transition-all duration-300"
                  style={{
                    backgroundColor: 'rgba(56, 145, 166, 0.08)',
                    borderColor: '#3891A6',
                    borderWidth: '1px',
                    opacity: 0.6,
                    cursor: 'not-allowed'
                  }}
                >
                  <div className="mb-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-xl font-bold text-white flex-1">{getDisplayTitle(puzzle)}</h3>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: puzzle.isTeamPuzzle ? 'rgba(124,58,237,0.12)' : 'rgba(56,201,153,0.12)', color: puzzle.isTeamPuzzle ? '#7C3AED' : '#38D399' }}>
                          {puzzle.isTeamPuzzle ? 'Team' : 'Solo'}
                        </span>
                        <div className="flex gap-2 flex-col items-end">
                        {puzzle.order && puzzle.order > 0 ? (
                          <span className="text-xs font-semibold px-2 py-1 rounded" style={{ backgroundColor: '#FDE74C', color: '#020202' }}>
                            #{puzzle.order}
                          </span>
                        ) : null}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs font-semibold" style={{ color: '#AB9F9D' }}>✓ Puzzle Complete</p>
                  </div>
                  <p className="text-sm mb-3" style={{ color: '#DDDBF1' }}>{getDisplayDescription(puzzle)}</p>
                  <div className="flex gap-2 flex-wrap mb-2">
                    <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'rgba(253, 231, 76, 0.2)', color: '#FDE74C' }}>
                      {puzzle.category?.name || 'General'}
                    </span>
                    <span className="text-xs px-2 py-1 rounded capitalize font-medium" style={{ backgroundColor: `${DIFFICULTY_COLORS[puzzle.difficulty]}20`, color: DIFFICULTY_COLORS[puzzle.difficulty] }}>
                      {puzzle.difficulty.charAt(0) + puzzle.difficulty.slice(1).toLowerCase()}
                    </span>
                    <span className="text-xs px-2 py-1 rounded font-medium" style={{ backgroundColor: `${statusConfig[status].color}20`, color: statusConfig[status].color }}>
                      {statusConfig[status].label}
                    </span>
                  </div>
                  <div className="mb-2">
                    <StarRating 
                      rating={ratingStats[puzzle.id]?.averageRating ?? 0}
                      size="sm"
                      ratingCount={ratingStats[puzzle.id]?.ratingCount}
                      showText={ratingStats[puzzle.id]?.averageRating > 0}
                    />
                    {(!ratingStats[puzzle.id] || ratingStats[puzzle.id].averageRating === 0) && (
                      <p style={{ color: '#AB9F9D' }} className="text-xs mt-1">No ratings yet</p>
                    )}
                  </div>
                    {puzzle.pointsReward && (
                    <div style={{ color: '#FDE74C' }} className="text-xs font-semibold mb-2">
                      ⭐ {puzzle.pointsReward} points
                    </div>
                  )}
                  {puzzle.completedElapsedSeconds != null && (
                    <div className="text-xs mt-2" style={{ color: '#AB9F9D' }}>
                      Completed in <span style={{ color: '#FDE74C', fontWeight: 700 }}>{Math.floor((puzzle.completedElapsedSeconds)/60).toString().padStart(2,'0')}:{(puzzle.completedElapsedSeconds%60).toString().padStart(2,'0')}</span>
                    </div>
                  )}
                </Link>
                );
              }

              if (status === 'failed') {
                return (
                  <div
                    id={`puzzle-${puzzle.id}`}
                    key={puzzle.id}
                    className="group rounded-lg border p-6 transition-all duration-300"
                    style={{
                      backgroundColor: 'rgba(170, 40, 40, 0.06)',
                      borderColor: '#EF4444',
                      borderWidth: '1px',
                      opacity: 0.6,
                      cursor: 'not-allowed'
                    }}
                  >
                    <div className="mb-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xl font-bold text-white flex-1">{getDisplayTitle(puzzle)}</h3>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: puzzle.isTeamPuzzle ? 'rgba(124,58,237,0.12)' : 'rgba(56,201,153,0.12)', color: puzzle.isTeamPuzzle ? '#7C3AED' : '#38D399' }}>
                            {puzzle.isTeamPuzzle ? 'Team' : 'Solo'}
                          </span>
                          <div className="flex gap-2 flex-col items-end">
                            {puzzle.order && puzzle.order > 0 ? (
                              <span className="text-xs font-semibold px-2 py-1 rounded" style={{ backgroundColor: '#FDE74C', color: '#020202' }}>
                                #{puzzle.order}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs font-semibold" style={{ color: '#AB9F9D' }}>✗ Puzzle Failed</p>
                      {puzzle.failedReason && (
                        <p className="text-sm mt-1" style={{ color: '#FFB4B4' }}>
                          Reason: {formatFailedReason(puzzle.failedReason) || 'Failed'}
                        </p>
                      )}
                    </div>
                    <p className="text-sm mb-3" style={{ color: '#DDDBF1' }}>{getDisplayDescription(puzzle)}</p>
                    <div className="flex gap-2 flex-wrap mb-2">
                      <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'rgba(253, 231, 76, 0.2)', color: '#FDE74C' }}>
                        {puzzle.category?.name || 'General'}
                      </span>
                      <span className="text-xs px-2 py-1 rounded capitalize font-medium" style={{ backgroundColor: `${DIFFICULTY_COLORS[puzzle.difficulty]}20`, color: DIFFICULTY_COLORS[puzzle.difficulty] }}>
                        {puzzle.difficulty.charAt(0) + puzzle.difficulty.slice(1).toLowerCase()}
                      </span>
                      <span className="text-xs px-2 py-1 rounded font-medium" style={{ backgroundColor: `${statusConfig[status].color}20`, color: statusConfig[status].color }}>
                        {statusConfig[status].label}
                      </span>
                    </div>
                    {puzzle.pointsReward && (
                      <div style={{ color: '#FDE74C' }} className="text-xs font-semibold mb-2">
                        ⭐ {puzzle.pointsReward} points
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div
                  id={`puzzle-${puzzle.id}`}
                  key={puzzle.id}
                  role="button"
                  onClick={() => handlePuzzleClick(puzzle)}
                  className="group rounded-lg border p-6 transition-all duration-300 hover:scale-105"
                  style={{
                    backgroundColor: 'rgba(56, 145, 166, 0.08)',
                    borderColor: '#3891A6',
                    borderWidth: '1px',
                    cursor: 'pointer'
                  }}
                >
                  <div className="mb-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-xl font-bold text-white flex-1">{getDisplayTitle(puzzle)}</h3>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: puzzle.isTeamPuzzle ? 'rgba(124,58,237,0.12)' : 'rgba(56,201,153,0.12)', color: puzzle.isTeamPuzzle ? '#7C3AED' : '#38D399' }}>
                          {puzzle.isTeamPuzzle ? 'Team' : 'Solo'}
                        </span>
                        <div className="flex gap-2 flex-col items-end">
                          {puzzle.order && puzzle.order > 0 ? (
                            <span className="text-xs font-semibold px-2 py-1 rounded" style={{ backgroundColor: '#FDE74C', color: '#020202' }}>
                              #{puzzle.order}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm mb-3" style={{ color: '#DDDBF1' }}>{getDisplayDescription(puzzle)}</p>
                    <div className="flex gap-2 flex-wrap mb-2">
                      <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'rgba(253, 231, 76, 0.2)', color: '#FDE74C' }}>
                        {puzzle.category?.name || 'General'}
                      </span>
                      <span className="text-xs px-2 py-1 rounded capitalize font-medium" style={{ backgroundColor: `${DIFFICULTY_COLORS[puzzle.difficulty]}20`, color: DIFFICULTY_COLORS[puzzle.difficulty] }}>
                        {puzzle.difficulty.charAt(0) + puzzle.difficulty.slice(1).toLowerCase()}
                      </span>
                      <span className="text-xs px-2 py-1 rounded font-medium" style={{ backgroundColor: `${statusConfig[status].color}20`, color: statusConfig[status].color }}>
                        {statusConfig[status].label}
                      </span>
                    </div>
                    <div className="mb-2">
                      <StarRating 
                        rating={ratingStats[puzzle.id]?.averageRating ?? 0}
                        size="sm"
                        ratingCount={ratingStats[puzzle.id]?.ratingCount}
                        showText={ratingStats[puzzle.id]?.averageRating > 0}
                      />
                      {(!ratingStats[puzzle.id] || ratingStats[puzzle.id].averageRating === 0) && (
                        <p style={{ color: '#AB9F9D' }} className="text-xs mt-1">No ratings yet</p>
                      )}
                    </div>
                    {puzzle.pointsReward && (
                      <div style={{ color: '#FDE74C' }} className="text-xs font-semibold mb-2">
                        ⭐ {puzzle.pointsReward} points
                      </div>
                    )}
                  </div>
                  <div className="mt-4 pt-4 space-y-2" style={{ borderTopColor: 'rgba(56, 145, 166, 0.2)', borderTopWidth: '1px' }}>
                    <span className="text-sm font-semibold transition-all block" style={{ color: '#3891A6' }}>
                      Solve Now →
                    </span>
                    <div className="space-y-1 text-xs">
                      <div style={{ color: '#DDDBF1' }}>
                        <span className="font-semibold" style={{ color: '#FDE74C' }}>
                          {totalUsers > 0 ? Math.round((puzzle.attemptCount || 0) / totalUsers * 100) : 0}%
                        </span>
                        {' have attempted'}
                      </div>
                      <div style={{ color: '#DDDBF1' }}>
                        <span className="font-semibold" style={{ color: '#38D399' }}>
                          {(puzzle.attemptCount || 0) > 0 ? Math.round((puzzle.completionCount || 0) / (puzzle.attemptCount || 1) * 100) : 0}%
                        </span>
                        {' of attempted completed'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((puzzle) => {
              const progress = puzzle.userProgress?.[0];
              const status = progress?.solved ? "solved" : puzzle.failed ? "failed" : progress?.attempts ? "in-progress" : "unsolved";
              const statusConfig: Record<string, { color: string; label: string }> = {
                solved: { color: "#38D399", label: "✓ Solved" },
                "in-progress": { color: "#FDE74C", label: "~ In Progress" },
                unsolved: { color: "#AB9F9D", label: "○ Unsolved" },
              };

              if (status === 'failed') {
                return (
                  <div
                    id={`puzzle-${puzzle.id}`}
                    key={puzzle.id}
                    className="group rounded-lg border p-4 transition-all duration-300 block"
                    style={{
                      backgroundColor: 'rgba(170, 40, 40, 0.04)',
                      borderColor: '#EF4444',
                      borderWidth: '1px',
                      opacity: 0.8,
                      cursor: 'not-allowed'
                    }}
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          {puzzle.order && puzzle.order > 0 ? (
                            <span className="text-xs font-semibold px-2 py-1 rounded whitespace-nowrap" style={{ backgroundColor: '#FDE74C', color: '#020202' }}>
                              #{puzzle.order}
                            </span>
                          ) : null}
                          <h3 className="text-lg font-bold text-white truncate">{getDisplayTitle(puzzle)}</h3>
                          <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: puzzle.isTeamPuzzle ? 'rgba(124,58,237,0.12)' : 'rgba(56,201,153,0.12)', color: puzzle.isTeamPuzzle ? '#7C3AED' : '#38D399' }}>
                            {puzzle.isTeamPuzzle ? 'Team' : 'Solo'}
                          </span>
                          <span className="text-xs font-semibold px-2 py-1 rounded whitespace-nowrap" style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#EF4444' }}>
                            ✗ Failed
                          </span>
                        </div>
                        <p className="text-sm mb-2 line-clamp-2" style={{ color: '#DDDBF1' }}>{getDisplayDescription(puzzle)}</p>
                        {puzzle.failedReason && (
                            <p className="text-sm mt-1" style={{ color: '#FFB4B4' }}>
                              Reason: {formatFailedReason(puzzle.failedReason) || 'Failed'}
                            </p>
                          )}
                      </div>
                      <div style={{ color: '#AB9F9D' }} className="text-lg font-semibold flex-shrink-0">
                        -
                      </div>
                    </div>
                  </div>
                );
              }

              return status === 'solved' ? (
                <div
                  id={`puzzle-${puzzle.id}`}
                  key={puzzle.id}
                  className="group rounded-lg border p-4 transition-all duration-300 block"
                  style={{
                    backgroundColor: 'rgba(56, 145, 166, 0.08)',
                    borderColor: '#3891A6',
                    borderWidth: '1px',
                    opacity: 0.6,
                    cursor: 'not-allowed'
                  }}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {puzzle.order && puzzle.order > 0 ? (
                          <span className="text-xs font-semibold px-2 py-1 rounded whitespace-nowrap" style={{ backgroundColor: '#FDE74C', color: '#020202' }}>
                            #{puzzle.order}
                          </span>
                        ) : null}
                        <h3 className="text-lg font-bold text-white truncate">{getDisplayTitle(puzzle)}</h3>
                        <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: puzzle.isTeamPuzzle ? 'rgba(124,58,237,0.12)' : 'rgba(56,201,153,0.12)', color: puzzle.isTeamPuzzle ? '#7C3AED' : '#38D399' }}>
                          {puzzle.isTeamPuzzle ? 'Team' : 'Solo'}
                        </span>
                        <span className="text-xs font-semibold px-2 py-1 rounded whitespace-nowrap" style={{ backgroundColor: 'rgba(56, 201, 153, 0.2)', color: '#38D399' }}>
                          ✓ Complete
                        </span>
                      </div>
                      <p className="text-sm mb-2 line-clamp-2" style={{ color: '#DDDBF1' }}>{getDisplayDescription(puzzle)}</p>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className="text-xs px-2 py-1 rounded whitespace-nowrap" style={{ backgroundColor: 'rgba(253, 231, 76, 0.2)', color: '#FDE74C' }}>
                          {puzzle.category?.name || 'General'}
                        </span>
                        <span className="text-xs px-2 py-1 rounded capitalize font-medium whitespace-nowrap" style={{ backgroundColor: `${DIFFICULTY_COLORS[puzzle.difficulty]}20`, color: DIFFICULTY_COLORS[puzzle.difficulty] }}>
                          {puzzle.difficulty.charAt(0) + puzzle.difficulty.slice(1).toLowerCase()}
                        </span>
                        <span className="text-xs px-2 py-1 rounded font-medium whitespace-nowrap" style={{ backgroundColor: `${statusConfig[status].color}20`, color: statusConfig[status].color }}>
                          {statusConfig[status].label}
                        </span>
                        {puzzle.pointsReward && (
                          <span className="text-xs px-2 py-1 rounded whitespace-nowrap" style={{ backgroundColor: 'rgba(253, 231, 76, 0.2)', color: '#FDE74C' }}>
                            ⭐ {puzzle.pointsReward} points
                          </span>
                        )}
                      </div>
                      <div className="mb-2">
                        <StarRating 
                          rating={ratingStats[puzzle.id]?.averageRating ?? 0}
                          size="sm"
                          ratingCount={ratingStats[puzzle.id]?.ratingCount}
                          showText={ratingStats[puzzle.id]?.averageRating > 0}
                        />
                        {(!ratingStats[puzzle.id] || ratingStats[puzzle.id].averageRating === 0) && (
                          <p style={{ color: '#AB9F9D' }} className="text-xs mt-1">No ratings yet</p>
                        )}
                      </div>
                      <div className="text-xs mt-2 space-y-1" style={{ color: '#DDDBF1' }}>
                        <div>
                          <span className="font-semibold" style={{ color: '#FDE74C' }}>
                            {totalUsers > 0 ? Math.round((puzzle.attemptCount || 0) / totalUsers * 100) : 0}%
                          </span>
                          {' have attempted'}
                        </div>
                        <div>
                          <span className="font-semibold" style={{ color: '#38D399' }}>
                            {(puzzle.attemptCount || 0) > 0 ? Math.round((puzzle.completionCount || 0) / (puzzle.attemptCount || 1) * 100) : 0}%
                          </span>
                          {' of attempted completed'}
                        </div>
                      </div>
                      {puzzle.completedElapsedSeconds != null && (
                        <div className="text-xs mt-2" style={{ color: '#AB9F9D' }}>
                          Completed in <span style={{ color: '#FDE74C', fontWeight: 700 }}>{Math.floor((puzzle.completedElapsedSeconds)/60).toString().padStart(2,'0')}:{(puzzle.completedElapsedSeconds%60).toString().padStart(2,'0')}</span>
                        </div>
                      )}
                    </div>
                    <div style={{ color: '#AB9F9D' }} className="text-lg font-semibold flex-shrink-0">
                      -
                    </div>
                  </div>
                </div>
                ) : (
                <div
                  id={`puzzle-${puzzle.id}`}
                  key={puzzle.id}
                  role="button"
                  onClick={() => handlePuzzleClick(puzzle)}
                  className="group rounded-lg border p-4 transition-all duration-300 hover:translate-x-2 block"
                  style={{
                    backgroundColor: 'rgba(56, 145, 166, 0.08)',
                    borderColor: '#3891A6',
                    borderWidth: '1px',
                    cursor: 'pointer'
                  }}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {puzzle.order && puzzle.order > 0 ? (
                          <span className="text-xs font-semibold px-2 py-1 rounded whitespace-nowrap" style={{ backgroundColor: '#FDE74C', color: '#020202' }}>
                            #{puzzle.order}
                          </span>
                        ) : null}
                        <h3 className="text-lg font-bold text-white truncate">{getDisplayTitle(puzzle)}</h3>
                        <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: puzzle.isTeamPuzzle ? 'rgba(124,58,237,0.12)' : 'rgba(56,201,153,0.12)', color: puzzle.isTeamPuzzle ? '#7C3AED' : '#38D399' }}>
                          {puzzle.isTeamPuzzle ? 'Team' : 'Solo'}
                        </span>
                      </div>
                      <p className="text-sm mb-2 line-clamp-2" style={{ color: '#DDDBF1' }}>{getDisplayDescription(puzzle)}</p>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className="text-xs px-2 py-1 rounded whitespace-nowrap" style={{ backgroundColor: 'rgba(253, 231, 76, 0.2)', color: '#FDE74C' }}>
                          {puzzle.category?.name || 'General'}
                        </span>
                        <span className="text-xs px-2 py-1 rounded capitalize font-medium whitespace-nowrap" style={{ backgroundColor: `${DIFFICULTY_COLORS[puzzle.difficulty]}20`, color: DIFFICULTY_COLORS[puzzle.difficulty] }}>
                          {puzzle.difficulty.charAt(0) + puzzle.difficulty.slice(1).toLowerCase()}
                        </span>
                        <span className="text-xs px-2 py-1 rounded font-medium whitespace-nowrap" style={{ backgroundColor: `${statusConfig[status].color}20`, color: statusConfig[status].color }}>
                          {statusConfig[status].label}
                        </span>
                        {puzzle.pointsReward && (
                          <span className="text-xs px-2 py-1 rounded whitespace-nowrap" style={{ backgroundColor: 'rgba(253, 231, 76, 0.2)', color: '#FDE74C' }}>
                            ⭐ {puzzle.pointsReward} points
                          </span>
                        )}
                      </div>
                      <div className="mb-2">
                        <StarRating 
                          rating={ratingStats[puzzle.id]?.averageRating ?? 0}
                          size="sm"
                          ratingCount={ratingStats[puzzle.id]?.ratingCount}
                          showText={ratingStats[puzzle.id]?.averageRating > 0}
                        />
                        {(!ratingStats[puzzle.id] || ratingStats[puzzle.id].averageRating === 0) && (
                          <p style={{ color: '#AB9F9D' }} className="text-xs mt-1">No ratings yet</p>
                        )}
                      </div>
                      <div className="text-xs mt-2" style={{ color: '#DDDBF1' }}>
                        <span className="font-semibold" style={{ color: '#FDE74C' }}>
                          {totalUsers > 0 ? Math.round((puzzle.completionCount || 0) / totalUsers * 100) : 0}%
                        </span>
                        {' of users have completed'}
                      </div>
                    </div>
                    <div style={{ color: '#3891A6' }} className="text-lg font-semibold flex-shrink-0">
                      →
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {showTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-60" onClick={closeTeamModal}></div>
          <div className="relative bg-[#0b0b0b] rounded-lg p-6 max-w-md mx-4" style={{ border: '1px solid rgba(253, 231, 76, 0.15)' }}>
            <h3 className="text-lg font-bold text-white mb-2">{teamModalTitle}</h3>
            <p style={{ color: '#DDDBF1' }} className="mb-4">{teamModalMessage}</p>
            <div className="flex justify-end gap-2">
              {teamModalCancelText && (
                <button
                  onClick={closeTeamModal}
                  className="px-4 py-2 rounded bg-transparent text-white font-semibold"
                  style={{ border: '1px solid rgba(221, 219, 241, 0.25)' }}
                >
                  {teamModalCancelText}
                </button>
              )}
              <button onClick={onTeamModalConfirm} className="px-4 py-2 rounded bg-[#3891A6] text-black font-semibold">{teamModalConfirmText}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
