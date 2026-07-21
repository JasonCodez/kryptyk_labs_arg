"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import FilterBar from "@/components/puzzle/FilterBar";
import { detectWebGLSupport } from "@/lib/webglSupport";
import LoadingSpinner from "@/components/LoadingSpinner";
import { getPuzzleTypeLabel, getPuzzleTypeIcon } from "@/lib/puzzleTypeLabels";
import CampaignPath from "@/components/puzzle/CampaignPath";
import SolvedIconOverlay from "@/components/puzzle/SolvedIconOverlay";
import GameButton from "@/components/game-ui/GameButton";

interface Puzzle {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  rarity?: string;
  order: number;
  pointsReward?: number;
  xpReward?: number;
  createdAt?: string;
  completionCount?: number;
  attemptCount?: number;
  puzzleType?: string;
  escapeRoom?: { id: string; roomTitle?: string; roomDescription?: string } | null;
  // server-reported escape-room history state
  escapeRoomFailed?: boolean;
  escapeRoomFailedReason?: string | null;
  // server-reported detective-case lockout state
  detectiveCaseFailed?: boolean;
  detectiveCaseFailedReason?: string | null;
  // server-computed sequential-progression lock state
  locked?: boolean;
  unlocksAfterTitle?: string | null;
  isBossPuzzle?: boolean;
  category: {
    id: string;
    name: string;
  };
  userProgress?: Array<{
    id: string;
    solved: boolean;
    attempts: number;
    totalTimeSpent?: number | null;
  }>;
  isTeamPuzzle?: boolean;
  // locally-annotated fields
  failed?: boolean;
  failedReason?: string | null;
  averageRating?: number;
  ratingCount?: number;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  puzzleCount: number;
}

// Difficulty maps onto semantic tokens (extreme uses the brand accent orange —
// it's a spotlight, not an error). Values are CSS var references consumed via
// the arcade-card --accent custom property, so they stay in sync with globals.
const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "var(--pw-success)",
  medium: "var(--pw-warning)",
  hard: "var(--pw-error)",
  extreme: "var(--pw-brand-accent)",
};

const CATEGORY_ICONS: Record<string, string> = {
  // Seeded categories
  escape: "🚪",
  mystery: "🕵️‍♂️",
  // Admin-form categories
  general: "🎯",
  sudoku: "🔢",
  arg: "🌐",
  jigsaw: "🧩",
  puzzle: "🎲",
  challenge: "🏆",
  word_crack: "💬",
  gridlock_file: "🔐",
  word_search: "🔍",
  crossword: "✏️",
  anagram_blitz: "🔀",
  code_master: "💻",
  crack_safe: "🔒",
  detective_case: "🕵️",
  jim_wyze_case: "🕵️",
  logic_grid: "🧠",
  // Generic fallbacks
  logic: "🧠",
  crypto: "🔐",
  word: "🔤",
  riddle: "❓",
  math: "➗",
  spatial: "📐",
  pattern: "🔁",
  memory: "💭",
  adventure: "🗺️",
  stealth: "🕶️",
};

function formatCategoryName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getDisplayTitle(puzzle: Puzzle & { name?: unknown; summary?: unknown; content?: unknown }) {
  const puzzleTitle = typeof puzzle?.title === 'string' ? puzzle.title.trim() : '';
  const escapeTitle = typeof puzzle?.escapeRoom?.roomTitle === 'string' ? puzzle.escapeRoom.roomTitle.trim() : '';

  // Escape rooms should display their roomTitle even if the Puzzle row has a default fallback title.
  if ((puzzle?.puzzleType === 'escape_room' || puzzle?.puzzleType === 'jim_wyze_case') && escapeTitle) return escapeTitle;
  if ((puzzleTitle === '' || puzzleTitle === 'Untitled Puzzle') && escapeTitle) return escapeTitle;

  const raw = (puzzle && (puzzle.title ?? puzzle.name ?? puzzle?.escapeRoom?.roomTitle)) as unknown;
  const title = typeof raw === 'string' ? raw.trim() : '';
  return title || 'Untitled Puzzle';
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

interface PuzzleCardProps {
  puzzle: Puzzle;
  totalUsers: number;
  onCardClick: (p: Puzzle) => void;
  justCompletedId?: string | null;
}

type CardStatus = "solved" | "locked" | "failed" | "playable";

function getCardStatus(puzzle: Puzzle): CardStatus {
  const progress = puzzle.userProgress?.[0];
  if (progress?.solved) return "solved";
  if (puzzle.locked) return "locked";
  if (puzzle.failed) return "failed";
  return "playable";
}

function getStatusAccent(status: CardStatus, difficultyColor: string): string {
  if (status === "solved") return "var(--pw-success)";
  if (status === "locked") return "var(--pw-text-disabled)";
  if (status === "failed") return "var(--pw-error)";
  return difficultyColor;
}

function GridPuzzleCard({ puzzle, totalUsers, onCardClick, justCompletedId }: PuzzleCardProps) {
  const status = getCardStatus(puzzle);
  const diffColor = DIFFICULTY_COLORS[puzzle.difficulty] || 'var(--pw-text-secondary)';
  const accent = getStatusAccent(status, diffColor);
  const icon = getPuzzleTypeIcon(puzzle.puzzleType || 'general');
  const attemptedPct = totalUsers > 0 ? Math.round((puzzle.attemptCount || 0) / totalUsers * 100) : 0;
  const completedPct = (puzzle.attemptCount || 0) > 0 ? Math.round((puzzle.completionCount || 0) / (puzzle.attemptCount || 1) * 100) : 0;
  const clickable = status === 'solved' || status === 'playable';
  const flagText = status === 'solved' ? 'COMPLETED' : status === 'locked' ? '🔒' : status === 'failed' ? 'FAILED' : puzzle.difficulty.toUpperCase();

  const body = (
    <>
      {puzzle.order && puzzle.order > 0 ? <span className="pw-arcade-level">LVL {puzzle.order}</span> : null}
      <div className="pw-arcade-icon" style={{ '--accent': accent } as CSSProperties}>
        <span aria-hidden>{status === 'locked' ? '🔒' : icon}</span>
        <span className="pw-arcade-flag" style={{ background: accent }}>{flagText}</span>
        {puzzle.isBossPuzzle && <span className="pw-arcade-boss" aria-hidden title="Boss Puzzle">👑</span>}
        {status === 'solved' && <SolvedIconOverlay animateIn={puzzle.id === justCompletedId} />}
      </div>
      <h3 className="pw-arcade-title">{getDisplayTitle(puzzle)}</h3>
      <p className="pw-arcade-type">{getPuzzleTypeLabel(puzzle.puzzleType || 'general')} · {puzzle.isTeamPuzzle ? 'Team' : 'Solo'}</p>
      {status === 'locked' ? (
        <p className="pw-arcade-locked-msg">
          {puzzle.unlocksAfterTitle ? <>Complete &quot;{puzzle.unlocksAfterTitle}&quot; first</> : 'Complete the previous puzzle first'}
        </p>
      ) : (
        <>
          {status === 'failed' && puzzle.failedReason && (
            <p className="pw-arcade-failed-msg">{formatFailedReason(puzzle.failedReason)}</p>
          )}
          <div className="pw-arcade-loot">
            {puzzle.xpReward ? <span className="pw-arcade-chip pw-arcade-chip-gold">✦ {puzzle.xpReward} XP</span> : null}
            {puzzle.pointsReward ? <span className="pw-arcade-chip pw-arcade-chip-em">⭐ {puzzle.pointsReward}</span> : null}
          </div>
        </>
      )}
      <div className="pw-arcade-perf">
        <div><b>{status === 'locked' ? '—' : `${attemptedPct}%`}</b><small>Players attempted</small></div>
        <div><b>{status === 'locked' ? '—' : `${completedPct}%`}</b><small>Players completed</small></div>
      </div>
    </>
  );

  if (clickable) {
    return (
      <div
        id={`puzzle-${puzzle.id}`}
        role="button"
        tabIndex={0}
        onClick={() => onCardClick(puzzle)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCardClick(puzzle); } }}
        className="pw-arcade-card"
        style={{ '--accent': accent } as CSSProperties}
      >
        {body}
      </div>
    );
  }

  return (
    <div id={`puzzle-${puzzle.id}`} className="pw-arcade-card pw-arcade-card-inert" style={{ '--accent': accent } as CSSProperties}>
      {body}
    </div>
  );
}

function ListPuzzleCard({ puzzle, totalUsers, onCardClick, justCompletedId }: PuzzleCardProps) {
  const status = getCardStatus(puzzle);
  const diffColor = DIFFICULTY_COLORS[puzzle.difficulty] || 'var(--pw-text-secondary)';
  const accent = getStatusAccent(status, diffColor);
  const icon = getPuzzleTypeIcon(puzzle.puzzleType || 'general');
  const attemptedPct = totalUsers > 0 ? Math.round((puzzle.attemptCount || 0) / totalUsers * 100) : 0;
  const completedPct = (puzzle.attemptCount || 0) > 0 ? Math.round((puzzle.completionCount || 0) / (puzzle.attemptCount || 1) * 100) : 0;
  const clickable = status === 'solved' || status === 'playable';
  const flagText = status === 'solved' ? 'COMPLETED' : status === 'locked' ? '🔒' : status === 'failed' ? 'FAILED' : puzzle.difficulty.toUpperCase();

  const body = (
    <>
      <div className="pw-arcade-icon" style={{ '--accent': accent } as CSSProperties}>
        <span aria-hidden>{status === 'locked' ? '🔒' : icon}</span>
        <span className="pw-arcade-flag" style={{ background: accent }}>{flagText}</span>
        {puzzle.isBossPuzzle && <span className="pw-arcade-boss" aria-hidden title="Boss Puzzle">👑</span>}
        {status === 'solved' && <SolvedIconOverlay animateIn={puzzle.id === justCompletedId} size={18} />}
      </div>
      <div className="pw-arcade-row-body">
        <div className="pw-arcade-row-title-line">
          {puzzle.order && puzzle.order > 0 ? <span className="pw-arcade-level-inline">LVL {puzzle.order}</span> : null}
          <h3 className="pw-arcade-title">{getDisplayTitle(puzzle)}</h3>
        </div>
        <p className="pw-arcade-type">{getPuzzleTypeLabel(puzzle.puzzleType || 'general')} · {puzzle.isTeamPuzzle ? 'Team' : 'Solo'}</p>
        {status === 'locked' && (
          <p className="pw-arcade-locked-msg">
            {puzzle.unlocksAfterTitle ? <>Complete &quot;{puzzle.unlocksAfterTitle}&quot; first</> : 'Complete the previous puzzle first'}
          </p>
        )}
        {status === 'failed' && puzzle.failedReason && (
          <p className="pw-arcade-failed-msg">{formatFailedReason(puzzle.failedReason)}</p>
        )}
      </div>
      <div className="pw-arcade-row-side">
        {status !== 'locked' && (
          <div className="pw-arcade-loot">
            {puzzle.xpReward ? <span className="pw-arcade-chip pw-arcade-chip-gold">✦ {puzzle.xpReward} XP</span> : null}
            {puzzle.pointsReward ? <span className="pw-arcade-chip pw-arcade-chip-em">⭐ {puzzle.pointsReward}</span> : null}
          </div>
        )}
        <div className="pw-arcade-perf">
          <div><b>{status === 'locked' ? '—' : `${attemptedPct}%`}</b><small>Players attempted</small></div>
          <div><b>{status === 'locked' ? '—' : `${completedPct}%`}</b><small>Players completed</small></div>
        </div>
      </div>
    </>
  );

  if (clickable) {
    return (
      <div
        id={`puzzle-${puzzle.id}`}
        role="button"
        tabIndex={0}
        onClick={() => onCardClick(puzzle)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCardClick(puzzle); } }}
        className="pw-arcade-row"
        style={{ '--accent': accent } as CSSProperties}
      >
        {body}
      </div>
    );
  }

  return (
    <div id={`puzzle-${puzzle.id}`} className="pw-arcade-row pw-arcade-row-inert" style={{ '--accent': accent } as CSSProperties}>
      {body}
    </div>
  );
}

export default function PuzzlesList({ initialCategory = "all", puzzleType }: { initialCategory?: string; puzzleType?: string }) {
  const { status } = useSession();
  const router = useRouter();
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredPuzzles, setFilteredPuzzles] = useState<Puzzle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("order");
  const [sortOrder, setSortOrder] = useState<string>("asc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [totalUsers, setTotalUsers] = useState(0);
  
  const [focusedPuzzleId, setFocusedPuzzleId] = useState<string | null>(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamModalMessage, setTeamModalMessage] = useState("");
  const [teamModalTitle, setTeamModalTitle] = useState("Notice");
  const [teamModalConfirmText, setTeamModalConfirmText] = useState<string>("OK");
  const [teamModalCancelText, setTeamModalCancelText] = useState<string | null>(null);
  const [teamModalConfirmAction, setTeamModalConfirmAction] = useState<(() => void) | null>(null);
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null);

  useEffect(function() {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    if (status === "authenticated") {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, router, puzzleType]);

  // When arriving back from a puzzle the player just finished, play the checkmark pop-in
  // animation on that specific card's icon and scroll it into view. Read once then clear
  // the flag so a refresh/revisit doesn't replay it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const id = window.sessionStorage.getItem("pw:justCompletedPuzzleId");
      if (id) {
        window.sessionStorage.removeItem("pw:justCompletedPuzzleId");
        setJustCompletedId(id);
        setTimeout(() => {
          const el = document.getElementById(`puzzle-${id}`);
          if (el) {
            try {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            } catch {
              // ignore
            }
          }
        }, 300);
      }
    } catch {
      // ignore
    }
  }, []);

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
            } catch {
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
              } catch {
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
    // applyFilters is a plain function redefined every render, but every value it reads is
    // already listed below — adding the function itself would just re-run this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzles, selectedCategory, selectedDifficulty, selectedStatus, sortBy, sortOrder]);

  // Which puzzles to display: either focus a single puzzle (via hash) or the filtered list
  const displayed = focusedPuzzleId ? puzzles.filter((p) => p.id === focusedPuzzleId) : filteredPuzzles;

  async function fetchData() {
    try {
      const [puzzlesRes, categoriesRes, usersRes] = await Promise.all([
        fetch(`/api/puzzles?limit=500`),
        fetch("/api/puzzle-categories"),
        fetch("/api/users/count"),
      ]);

      if (puzzlesRes.ok) {
        const puzzlesData = await puzzlesRes.json();
        // Annotate puzzles with lockout state for puzzle types that remain permanently locked on failure.
        const annotated = puzzlesData.map((p: Puzzle) => {
          const detectiveCaseFailed = p?.detectiveCaseFailed === true;
          const baseFailedFlag = detectiveCaseFailed;
          const baseFailedReason: string | null = detectiveCaseFailed
            ? (p?.detectiveCaseFailedReason ?? 'incorrect_submission')
            : null;
          const failedFlag = baseFailedFlag;
          const failedReason: string | null = baseFailedReason;
          return { ...p, failed: failedFlag, failedReason };
        });
        // Hard-scope to this campaign's puzzle type when set — puzzles of other types never
        // enter state here, so there's no path for them to leak into this page's filters/search.
        const scoped = puzzleType ? annotated.filter((p: Puzzle) => p.puzzleType === puzzleType) : annotated;
        setPuzzles(scoped);

        // Ratings are now included in the puzzle list response — no separate fetch needed
      }

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        const filteredCategories = (categoriesData || []).filter((c: Category) => {
          const name = (c && c.name) ? String(c.name).toLowerCase().trim() : "";
          return name !== "team test" && (c.puzzleCount ?? 0) > 0;
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

  async function launchTeamPuzzle(puzzle: Puzzle) {
    try {
      const response = await fetch(`/api/user/team-admin?puzzleId=${encodeURIComponent(puzzle.id)}`);

      if (response.status === 401) {
        router.push('/auth/signin');
        return;
      }

      const teamInfo = (await response.json().catch(() => null)) as {
        isMember?: boolean;
        teamId?: string | null;
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(teamInfo?.error || response.statusText || 'Failed to verify team access.');
      }

      if (!teamInfo?.isMember || !teamInfo?.teamId) {
        setTeamModalTitle('Team Required');
        setTeamModalConfirmText('Go to Teams');
        setTeamModalCancelText('Cancel');
        setTeamModalConfirmAction(() => {
          return () => {
            router.push('/teams');
          };
        });
        setTeamModalMessage('This puzzle requires a team. Join or create a team first, then launch it from your team lobby.');
        setShowTeamModal(true);
        return;
      }

      router.push(`/teams/${teamInfo.teamId}/lobby?puzzleId=${encodeURIComponent(puzzle.id)}`);
    } catch (error) {
      console.error('Failed to launch team puzzle:', error);
      setTeamModalTitle('Unable to Launch');
      setTeamModalConfirmText('OK');
      setTeamModalCancelText(null);
      setTeamModalConfirmAction(null);
      setTeamModalMessage("We couldn't launch this team puzzle right now. Please try again.");
      setShowTeamModal(true);
    }
  }

  async function handlePuzzleClick(puzzle: Puzzle, opts?: { skipWebGLCheck?: boolean }) {
    const alreadySolved = !!(puzzle.userProgress && puzzle.userProgress.length > 0 && puzzle.userProgress[0].solved);
    if (alreadySolved) {
      setTeamModalTitle('Already Completed');
      setTeamModalConfirmText('OK');
      setTeamModalCancelText(null);
      setTeamModalConfirmAction(null);
      setTeamModalMessage("You've already completed and claimed the rewards for this puzzle.");
      setShowTeamModal(true);
      return;
    }

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

    if (puzzle?.puzzleType === 'jim_wyze_case') {
      router.push(`/puzzles/${puzzle.id}`);
      return;
    }

    // Non-team puzzles: go to puzzle page
    if (!puzzle.isTeamPuzzle) {
      router.push(`/puzzles/${puzzle.id}`);
      return;
    }

    await launchTeamPuzzle(puzzle);
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
    return <LoadingSpinner label="Loading puzzles…" size={180} />;
  }

  const teamModal = showTeamModal ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black opacity-60" onClick={closeTeamModal}></div>
      <div className="relative rounded-lg p-6 max-w-md mx-4 w-full max-h-[90vh] overflow-y-auto" style={{ background: 'var(--pw-bg-elevated)', border: '1px solid var(--pw-border-strong)' }}>
        <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--pw-text-primary)' }}>{teamModalTitle}</h3>
        <p style={{ color: 'var(--pw-text-secondary)' }} className="mb-4">{teamModalMessage}</p>
        <div className="flex justify-end gap-2">
          {teamModalCancelText && (
            <button
              onClick={closeTeamModal}
              className="px-4 py-2 rounded bg-transparent font-semibold"
              style={{ border: '1px solid var(--pw-border-strong)', color: 'var(--pw-text-primary)' }}
            >
              {teamModalCancelText}
            </button>
          )}
          <GameButton onClick={onTeamModalConfirm} variant="primary" size="sm">{teamModalConfirmText}</GameButton>
        </div>
      </div>
    </div>
  ) : null;

  // Campaign branch — a completely separate render path from the frozen flat
  // list below, so campaign-only presentation can never leak into it. The
  // route already scopes `puzzles` to this exact puzzleType (see fetchData).
  if (puzzleType) {
    return (
      <>
        <div
          style={{
            background:
              'radial-gradient(1300px 800px at 15% -10%, color-mix(in srgb, var(--pw-brand-primary) 12%, transparent), transparent 62%), radial-gradient(1100px 700px at 90% 0%, color-mix(in srgb, var(--pw-brand-secondary) 8%, transparent), transparent 58%), var(--pw-bg-base)',
            minHeight: '100vh',
          }}
        >
          <CampaignPath
            puzzleType={puzzleType}
            puzzles={puzzles}
            justCompletedId={justCompletedId}
            onActivatePuzzle={(puzzleId) => {
              const puzzle = puzzles.find((item) => item.id === puzzleId);
              if (puzzle) {
                void handlePuzzleClick(puzzle);
              }
            }}
          />
        </div>
        {teamModal}
      </>
    );
  }

  const visibleCategoryIds = new Set(puzzles.map((p) => p.category?.id).filter(Boolean));
  const visibleCategories = categories.filter((c) => visibleCategoryIds.has(c.id));

  return (
    <div
      style={{
        // Ambient brand glow over neutral navy — mirrors the app body treatment.
        background:
          'radial-gradient(1300px 800px at 15% -10%, color-mix(in srgb, var(--pw-brand-primary) 12%, transparent), transparent 62%), radial-gradient(1100px 700px at 90% 0%, color-mix(in srgb, var(--pw-brand-secondary) 8%, transparent), transparent 58%), var(--pw-bg-base)',
      }}
      className="min-h-screen"
    >
      {/* Header */}
      <div className="pt-24 pb-8 md:pb-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl md:text-5xl font-bold mb-4" style={{ color: 'var(--pw-text-primary)' }}>
            Puzzles
          </h1>
          <p style={{ color: 'var(--pw-text-secondary)' }}>
            Tackle challenges at your own pace. Win points solo or team up for collaborative solving
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 md:py-12 max-w-7xl mx-auto overflow-x-hidden">
        <div className="mb-6 md:mb-12">
          <div>
              <FilterBar
                onDifficultyChange={setSelectedDifficulty}
                onStatusChange={setSelectedStatus}
                onSortChange={(by, order) => {
                  setSortBy(by);
                  setSortOrder(order);
                }}
                currentDifficulty={selectedDifficulty}
                currentStatus={selectedStatus}
                currentSort={{ by: sortBy, order: sortOrder }}
              />
          </div>

          <div className="mt-6 mb-8">
              <h3 className="text-xs font-bold tracking-widest mb-3 uppercase" style={{ color: 'var(--pw-text-muted)' }}>Categories</h3>
              <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
                <div className="flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-x-visible sm:pb-0 no-scrollbar">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={`flex-none px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm sm:text-base font-medium transition-all ${
                    selectedCategory === "all"
                      ? "scale-105"
                      : "opacity-70 hover:opacity-100"
                  }`}
                  style={{
                    backgroundColor: selectedCategory === "all" ? "var(--pw-brand-primary)" : "color-mix(in srgb, var(--pw-brand-primary) 16%, transparent)",
                    color: selectedCategory === "all" ? "var(--pw-text-on-primary)" : "var(--pw-text-primary)",
                  }}
                >
                  All
                </button>
                {visibleCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex-none px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm sm:text-base font-medium transition-all ${
                      selectedCategory === cat.id
                        ? "scale-105"
                        : "opacity-70 hover:opacity-100"
                    }`}
                    style={{
                      // Category rows may carry their own admin-set color; the
                      // brand primary is the fallback.
                      backgroundColor: selectedCategory === cat.id ? (cat.color || "var(--pw-brand-primary)") : "color-mix(in srgb, var(--pw-brand-primary) 16%, transparent)",
                      color: selectedCategory === cat.id ? "var(--pw-text-on-primary)" : "var(--pw-text-primary)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span className="mr-1.5">{cat.icon || CATEGORY_ICONS[cat.name.toLowerCase()] || '🧩'}</span>
                    {formatCategoryName(cat.name)}
                  </button>
                ))}
                </div>
              </div>
            </div>

          {/* View Mode Toggle and Results Count */}
          <div className="flex items-center justify-between mb-4">
            <p style={{ color: 'var(--pw-text-secondary)' }} className="text-sm">
              {filteredPuzzles.length} puzzle{filteredPuzzles.length !== 1 ? "s" : ""} found
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-all`}
                aria-pressed={viewMode === "grid"}
                style={{
                  backgroundColor: viewMode === "grid" ? "var(--pw-brand-primary)" : "color-mix(in srgb, var(--pw-brand-primary) 16%, transparent)",
                  color: viewMode === "grid" ? "var(--pw-text-on-primary)" : "var(--pw-text-primary)",
                  boxShadow: viewMode === "grid" ? "0 0 0 2px color-mix(in srgb, var(--pw-brand-primary) 55%, transparent)" : "none",
                  opacity: viewMode === "grid" ? 1 : 0.6,
                }}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-all`}
                aria-pressed={viewMode === "list"}
                style={{
                  backgroundColor: viewMode === "list" ? "var(--pw-brand-primary)" : "color-mix(in srgb, var(--pw-brand-primary) 16%, transparent)",
                  color: viewMode === "list" ? "var(--pw-text-on-primary)" : "var(--pw-text-primary)",
                  boxShadow: viewMode === "list" ? "0 0 0 2px color-mix(in srgb, var(--pw-brand-primary) 55%, transparent)" : "none",
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
                try { history.replaceState(null, "", "/puzzles"); } catch {}
              }}
              className="px-3 py-1 rounded text-sm mb-4"
              style={{ background: "var(--pw-surface-3)", color: "var(--pw-text-primary)", border: "1px solid var(--pw-border-default)" }}
            >
              Show all puzzles
            </button>
          </div>
        )}
        {displayed.length === 0 ? (
          <div className="text-center py-20">
            <p style={{ color: 'var(--pw-text-primary)' }} className="text-lg mb-2">No puzzles match your filters</p>
            <p style={{ color: 'var(--pw-text-secondary)' }} className="text-sm">Try adjusting your search or filters</p>
          </div>
          ) : viewMode === "grid" ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {displayed.map((puzzle) => (
              <GridPuzzleCard key={puzzle.id} puzzle={puzzle} totalUsers={totalUsers} onCardClick={handlePuzzleClick} justCompletedId={justCompletedId} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((puzzle) => (
              <ListPuzzleCard key={puzzle.id} puzzle={puzzle} totalUsers={totalUsers} onCardClick={handlePuzzleClick} justCompletedId={justCompletedId} />
            ))}
          </div>
        )}
      </div>
      {showTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-60" onClick={closeTeamModal}></div>
          <div className="relative rounded-lg p-6 max-w-md mx-4 w-full max-h-[90vh] overflow-y-auto" style={{ background: 'var(--pw-bg-elevated)', border: '1px solid var(--pw-border-strong)' }}>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--pw-text-primary)' }}>{teamModalTitle}</h3>
            <p style={{ color: 'var(--pw-text-secondary)' }} className="mb-4">{teamModalMessage}</p>
            <div className="flex justify-end gap-2">
              {teamModalCancelText && (
                <button
                  onClick={closeTeamModal}
                  className="px-4 py-2 rounded bg-transparent font-semibold"
                  style={{ border: '1px solid var(--pw-border-strong)', color: 'var(--pw-text-primary)' }}
                >
                  {teamModalCancelText}
                </button>
              )}
              <GameButton onClick={onTeamModalConfirm} variant="primary" size="sm">{teamModalConfirmText}</GameButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
