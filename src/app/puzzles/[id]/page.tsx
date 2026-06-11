"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import HintCard from "@/components/puzzle/HintCard";
import HintHistoryPanel from "@/components/puzzle/HintHistoryPanel";
import HintStatsOverlay from "@/components/puzzle/HintStatsOverlay";
import ProgressBar from "@/components/puzzle/ProgressBar";
import TimeTracker from "@/components/puzzle/TimeTracker";
import AttemptStats from "@/components/puzzle/AttemptStats";
import CompletionPercentage from "@/components/puzzle/CompletionPercentage";
import ImageViewer from "@/components/ImageViewer";
import SudokuGrid from "@/components/puzzle/SudokuGrid";
import { PuzzlePageSkeleton } from "@/components/Skeleton";
import { EscapeRoomPuzzle } from "@/components/puzzle/EscapeRoomPuzzle";
import PuzzleCompletionRatingModal from "@/components/puzzle/PuzzleCompletionRatingModal";
import PuzzleXpModal from "@/components/puzzle/PuzzleXpModal";
import PuzzleComparisonModal, { type ComparisonStats } from "@/components/puzzle/PuzzleComparisonModal";
import { calcLevel } from "@/lib/levels";
import { FEATURE_TOKENS_ENABLED } from "@/lib/featureFlags";
import Toasts from '@/components/Toast';
import type { JigsawPuzzle as JigsawPuzzleType } from "@/lib/puzzle-types";
import JigsawPuzzle from "@/components/puzzle/JigsawPuzzle";
import CodeMasterIDE from "@/components/puzzle/CodeMasterIDE";
import DetectiveCasePuzzle from "@/components/puzzle/DetectiveCasePuzzle";
import CrimeCasePuzzle from "@/components/puzzle/CrimeCasePuzzle";
import ParasiteCodePuzzle from "@/components/puzzle/ParasiteCodePuzzle";
import GridlockFilePuzzle from "@/components/puzzle/GridlockFilePuzzle";
import CrackTheSafePuzzle from "@/components/puzzle/CrackTheSafePuzzle";
import WordCrackPuzzle from "@/components/puzzle/WordCrackPuzzle";
import WordSearchPuzzle from "@/components/puzzle/WordSearchPuzzle";
import CrosswordPuzzle from "@/components/puzzle/CrosswordPuzzle";
import AnagramBlitz from "@/components/puzzle/AnagramBlitz";
import ArgPuzzle from "@/components/puzzle/ArgPuzzle";
import BlackoutPuzzle from "@/components/puzzle/BlackoutPuzzle";
import { getSkinTokens } from "@/lib/puzzleSkins";
import { getPuzzleTypeLabel } from "@/lib/puzzleTypeLabels";
import { PuzzlePageOverlays } from "@/components/puzzle/PuzzlePageOverlays";
import { PuzzleTypeRenderer } from "@/components/puzzle/PuzzleTypeRenderer";
import { PuzzleProgressSection } from "@/components/puzzle/PuzzleProgressSection";

interface XpModalData {
  xpGained: number;
  oldLevel: number;
  newLevel: number;
  newTitle: string;
  oldProgress: number;
  newProgress: number;
  levelReward?: { points?: number; hintTokens?: number; skipTokens?: number; label: string } | null;
}

interface Puzzle {
  id: string;
  title: string;
  description: string;
  content: string;
  difficulty: string;
  puzzleType?: string;
  xpReward?: number;
  solutions?: Array<{ points: number | null }>;
  data?: Record<string, unknown>;
  escapeRoom?: {
    id: string;
    roomTitle: string;
    roomDescription: string;
    timeLimitSeconds?: number | null;
    minTeamSize?: number;
    maxTeamSize?: number;
  };
  category: {
    name: string;
  };
  sudoku?: {
    puzzleGrid: string;
    solutionGrid: string;
    difficulty: string;
    timeLimitSeconds?: number | null;
    maxAttempts?: number | null;
  };
  jigsaw?: {
    imageUrl: string | null;
    gridRows: number;
    gridCols: number;
    snapTolerance: number;
    rotationEnabled: boolean;
  };
  math?: {
    problemStatement: string;
    workingExample?: string;
    mathType?: string;
  };
  media?: PuzzleMedia[];
  userHistory: Array<{
    id: string;
    pointsCost: number;
    revealedAt: Date | string;
    solvedAt: Date | string | null;
    timeToSolve: number | null;
    leadToSolve: boolean;
  }>;
}

// Minimal media type used by the page. Kept local to avoid circular imports.
interface PuzzleMedia {
  id: string;
  type: "image" | "video" | "audio" | "document";
  url: string;
  title?: string;
  description?: string;
  fileSize?: number;
  thumbnail?: string;
  mimeType?: string;
  fileName?: string;
}

// Hint shape used across components; mirrors the definition in HintCard for local typing
interface HintWithStats {
  id: string;
  text: string;
  order: number;
  costPoints: number;
  maxUsesPerUser: number | null;
  maxUsesPerTeam: number | null;
  stats: {
    totalUsages: number;
    timesLeadToSolve: number;
    successRate: number;
    averageTimeToSolve: number | null;
  };
  userHistory: Array<{
    id: string;
    pointsCost: number;
    revealedAt: Date | string;
    solvedAt: Date | string | null;
    timeToSolve: number | null;
    leadToSolve: boolean;
  }>;
}

interface PuzzlePartProgress {
  id: string;
  puzzlePartId: string;
  solved: boolean;
  solvedAt: Date | string | null;
  attempts: number;
  pointsEarned: number;
  part: {
    id: string;
    title: string;
    description: string | null;
    order: number;
    pointsValue: number;
  };
}

interface SessionLog {
  id: string;
  sessionStart: Date | string;
  sessionEnd: Date | string | null;
  durationSeconds: number | null;
  hintUsed: boolean;
  attemptMade: boolean;
  wasSuccessful: boolean;
}

interface PuzzleProgress {
  id: string;
  userId: string;
  puzzleId: string;
  solved: boolean;
  solvedAt: Date | string | null;
  attempts: number;
  pointsEarned: number;
  successfulAttempts: number;
  lastAttemptAt: Date | string | null;
  averageTimePerAttempt: number | null;
  totalTimeSpent: number;
  currentSessionStart: Date | string | null;
  completionPercentage: number;
  viewedAt: Date | string;
  updatedAt: Date | string;
  sessionLogs: SessionLog[];
  partProgress: PuzzlePartProgress[];

  // 3-attempt system
  failedAttempts?: number;

  // Sudoku anti-cheat timer fields (server persisted)
  sudokuStartedAt?: Date | string | null;
  sudokuExpiresAt?: Date | string | null;
  sudokuLockedAt?: Date | string | null;
  sudokuLockReason?: string | null;
}

const difficultyColors: Record<string, string> = {
  EASY: "bg-green-500/20 text-green-300 border-green-500/30",
  MEDIUM: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  HARD: "bg-red-500/20 text-red-300 border-red-500/30",
  EXPERT: "bg-[#3891A6]/20 text-[#3891A6] border-[#3891A6]/30",
};

const DIFFICULTY_BADGE_STYLE: Record<string, React.CSSProperties> = {
  EASY:   { backgroundColor: "rgba(16,185,129,0.12)", color: "#4ade80",  border: "1px solid rgba(16,185,129,0.35)" },
  MEDIUM: { backgroundColor: "rgba(253,231,76,0.12)",  color: "#FDE74C", border: "1px solid rgba(253,231,76,0.35)" },
  HARD:   { backgroundColor: "rgba(239,68,68,0.12)",   color: "#f87171", border: "1px solid rgba(239,68,68,0.35)" },
  EXPERT: { backgroundColor: "rgba(56,145,166,0.15)",  color: "#3891A6", border: "1px solid rgba(56,145,166,0.45)" },
};

export default function PuzzleDetailPage() {
  // Modal state for Sudoku start overlay
  const [showSudokuStartModal, setShowSudokuStartModal] = useState(false);
  // Modal state for Sudoku help/info
  const [showSudokuHelp, setShowSudokuHelp] = useState(false);
  // Track if Sudoku has started
  const [sudokuStarted, setSudokuStarted] = useState(false);
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const puzzleId = params.id as string;
  const teamIdParam = searchParams.get('teamId') || undefined;
  const lobbyIdParam = searchParams.get('lobbyId') || undefined;
  const sessionStartRef = useRef<Date | null>(null);

  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [hints, setHints] = useState<HintWithStats[]>([]);
  const [progress, setProgress] = useState<PuzzleProgress | null>(null);
  const [answer, setAnswer] = useState("");
  const [sudokuGrid, setSudokuGrid] = useState<(number | null)[][]>([]);
  const [sudokuOriginal, setSudokuOriginal] = useState<number[][] | null>(null);
  const restoredToastKey = `sudoku-restored:${puzzleId}`;
  const [sudokuSolution, setSudokuSolution] = useState<number[][] | null>(null);
  const [sudokuGridForSubmit, setSudokuGridForSubmit] = useState<number[][]>([]);
  const sudokuStartRef = useRef<number | null>(null);
  const sudokuTimerRef = useRef<number | null>(null);
  const sudokuLockSentRef = useRef(false);
  const puzzleTypeCompletionInFlightRef = useRef(false);
  const [sudokuElapsed, setSudokuElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showSolvedMessage, setShowSolvedMessage] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showProgress, setShowProgress] = useState(true);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [justAwardedPoints, setJustAwardedPoints] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Array<{id:string; message:string; type?: 'info'|'success'|'error'}>>([]);
  const [completionSeconds, setCompletionSeconds] = useState<number | null>(null);
  const [timeLimitExceeded, setTimeLimitExceeded] = useState(false);
  const [maxAttemptsExceeded, setMaxAttemptsExceeded] = useState(false);
  const [sudokuAttemptsUsed, setSudokuAttemptsUsed] = useState<number>(0);
  const [showGiveUpConfirm, setShowGiveUpConfirm] = useState(false);
  const [userTotalXp, setUserTotalXp] = useState<number>(0);
  const [showXpModal, setShowXpModal] = useState(false);
  const [xpModalData, setXpModalData] = useState<XpModalData | null>(null);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [comparisonStats, setComparisonStats] = useState<ComparisonStats | null>(null);

  // Fetch user's current total XP so we can animate the XP bar on puzzle completion
  useEffect(() => {
    fetch('/api/user/info')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.totalXp != null) setUserTotalXp(data.totalXp); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    sudokuLockSentRef.current = false;
  }, [puzzleId]);

  // --- SUDOKU MODAL STATE ---
  // (sudokuStarted and setSudokuStarted declared above; remove duplicate)

  const addToast = (message: string, type: 'info'|'success'|'error' = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter(x => x.id !== id)), 4200);
  };

  const removeToast = (id: string) => setToasts((t) => t.filter(x => x.id !== id));
  const [revealedHints, setRevealedHints] = useState<Set<string>>(new Set());
  const [revealingHint, setRevealingHint] = useState<string | null>(null);
  const [usedHintIds, setUsedHintIds] = useState<string[]>([]);
  const [hintTokens, setHintTokens] = useState<number>(0);
  const [skipTokens, setSkipTokens] = useState<number>(0);
  const [isSkipping, setIsSkipping] = useState(false);

  // Tokens are tied to the store — hide them when the store is disabled
  const effectiveHintTokens = FEATURE_TOKENS_ENABLED ? hintTokens : 0;
  const effectiveSkipTokens = FEATURE_TOKENS_ENABLED ? skipTokens : 0;

  type JigsawControlsApi = {
    reset: () => void;
    sendLooseToTray: () => void;
    enterFullscreen: () => void;
    exitFullscreen: () => void;
    isFullscreen: boolean;
  };
  const [jigsawControls, setJigsawControls] = useState<JigsawControlsApi | null>(null);
  const [activeSkin, setActiveSkin] = useState<string>("default");
  const [activeCompletionAnimation, setActiveCompletionAnimation] = useState<string>("default");

  // Fetch equipped cosmetics once on mount
  useEffect(() => {
    fetch("/api/user/profile", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.activeSkin) setActiveSkin(d.activeSkin);
        if (d?.activeCompletionAnimation) setActiveCompletionAnimation(d.activeCompletionAnimation);
      })
      .catch(() => {});
  }, []);

  const jigsawPlayable: JigsawPuzzleType | null = (() => {
    if (!puzzle || puzzle.puzzleType !== 'jigsaw') return null;
    if (!puzzle.jigsaw?.imageUrl) return null;

    const mappedDifficulty = (() => {
      const d = (puzzle.difficulty || '').toLowerCase();
      if (d === 'easy' || d === 'medium' || d === 'hard') return d;
      return 'hard';
    })();

    const pieceCount = puzzle.jigsaw.gridRows * puzzle.jigsaw.gridCols;

    // The jigsaw component only relies on `puzzle.data` at runtime; we fill extra fields to satisfy the type.
    return {
      id: puzzle.id,
      title: puzzle.title,
      description: puzzle.description,
      type: 'jigsaw',
      difficulty: mappedDifficulty,
      category: puzzle.category?.name || 'general',
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      pointsReward: 100,
      imageUrl: puzzle.jigsaw.imageUrl,
      pieceCount,
      aspectRatio: 1,
      data: (() => {
        const pData = (puzzle.data && typeof puzzle.data === 'object') ? (puzzle.data as Record<string, unknown>) : {};
        return {
          imageUrl: puzzle.jigsaw.imageUrl,
          pieceCount,
          gridRows: puzzle.jigsaw.gridRows,
          gridCols: puzzle.jigsaw.gridCols,
          rotationEnabled: puzzle.jigsaw.rotationEnabled,
          snapTolerance: puzzle.jigsaw.snapTolerance,
          ...(typeof pData.pieceExtFrac       === 'number' ? { pieceExtFrac:       pData.pieceExtFrac }       : {}),
          ...(typeof pData.pieceRFrac         === 'number' ? { pieceRFrac:         pData.pieceRFrac }         : {}),
          ...(typeof pData.pieceNHalfFrac     === 'number' ? { pieceNHalfFrac:     pData.pieceNHalfFrac }     : {}),
          ...(typeof pData.pieceShoulderStart === 'number' ? { pieceShoulderStart: pData.pieceShoulderStart } : {}),
          ...(typeof pData.funFact            === 'string' && pData.funFact ? { funFact: pData.funFact }     : {}),
        };
      })(),
    } as unknown as JigsawPuzzleType;
  })();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    const fetchPuzzle = async () => {
      try {
        const response = await fetch(`/api/puzzles/${puzzleId}`);
        if (!response.ok) throw new Error("Failed to fetch puzzle");
        const data = await response.json();
        setPuzzle(data);
      } catch (err) {
        setError("Failed to load puzzle");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (puzzleId) fetchPuzzle();
  }, [puzzleId, status, router]);

  // Initialize Sudoku grid when puzzle loads
  useEffect(() => {
    if (puzzle?.puzzleType === 'sudoku' && puzzle.sudoku) {
      // Only show modal if not solved and not already started
      if (!progress?.solved && !sudokuStarted && !progress?.sudokuStartedAt) {
        setShowSudokuStartModal(true);
      }
      try {
        const gridData = JSON.parse(puzzle.sudoku.puzzleGrid);
        setSudokuOriginal(gridData);
        // Try restore saved progress from localStorage first
        const saved = typeof window !== 'undefined' ? localStorage.getItem(`sudoku-progress:${puzzleId}`) : null;
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setSudokuGrid(parsed);
            try {
              if (typeof window !== 'undefined' && !sessionStorage.getItem(restoredToastKey)) {
                addToast('Restored saved Sudoku progress.', 'info');
                sessionStorage.setItem(restoredToastKey, '1');
              }
            } catch (e) {
              // ignore sessionStorage errors
              addToast('Restored saved Sudoku progress.', 'info');
            }
          } catch (e) {
            setSudokuGrid(gridData);
          }
        } else {
          setSudokuGrid(gridData);
        }
        try {
          const sol = JSON.parse(puzzle.sudoku.solutionGrid);
          setSudokuSolution(sol);
        } catch (e) {
          setSudokuSolution(null);
        }
      } catch (err) {
        console.error("Failed to parse Sudoku grid:", err);
      }
    }
  }, [puzzle]);

  // Server-backed Sudoku timer (anti-cheat): start/resume based on persisted deadline.
  useEffect(() => {
    if (puzzle?.puzzleType !== 'sudoku') return;
    if (!puzzle?.sudoku) return;
    if (!progress) return;
    if (progress.solved) return;

    const startedAtRaw = progress.sudokuStartedAt;
    const expiresAtRaw = progress.sudokuExpiresAt;
    const lockedAtRaw = progress.sudokuLockedAt;

    const startedAtMs = startedAtRaw ? new Date(startedAtRaw as any).getTime() : null;
    const expiresAtMs = expiresAtRaw ? new Date(expiresAtRaw as any).getTime() : null;
    const locked = !!lockedAtRaw;

    if (!startedAtMs || !expiresAtMs || Number.isNaN(startedAtMs) || Number.isNaN(expiresAtMs)) {
      return;
    }

    // Hide the start modal and start the timer.
    setShowSudokuStartModal(false);
    setSudokuStarted(true);
    sudokuStartRef.current = startedAtMs;

    const tick = () => {
      const now = Date.now();
      const elapsedNow = Math.max(0, Math.floor((now - startedAtMs) / 1000));
      setSudokuElapsed(elapsedNow);
      const remainingMs = expiresAtMs - now;
      if (locked || remainingMs <= 0) {
        setTimeLimitExceeded(true);
        try {
          if (sudokuTimerRef.current != null) {
            clearInterval(sudokuTimerRef.current);
            sudokuTimerRef.current = null;
          }
        } catch {
          // ignore
        }
      }
    };

    // start ticking
    try {
      if (sudokuTimerRef.current != null) {
        clearInterval(sudokuTimerRef.current);
        sudokuTimerRef.current = null;
      }
    } catch {
      // ignore
    }

    tick();
    sudokuTimerRef.current = window.setInterval(tick, 1000) as any;

    return () => {
      try {
        if (sudokuTimerRef.current != null) {
          clearInterval(sudokuTimerRef.current);
          sudokuTimerRef.current = null;
        }
      } catch {
        // ignore
      }
    };
  }, [puzzle?.puzzleType, puzzle?.sudoku, progress?.sudokuStartedAt, progress?.sudokuExpiresAt, progress?.sudokuLockedAt, progress?.solved]);

  // If Sudoku fails (time limit reached or max attempts), auto-redirect to puzzles page.
  useEffect(() => {
    if (puzzle?.puzzleType !== 'sudoku') return;
    if (!timeLimitExceeded && !maxAttemptsExceeded) return;

    const t = window.setTimeout(() => {
      router.push('/puzzles');
    }, 3500);

    return () => {
      window.clearTimeout(t);
    };
  }, [puzzle?.puzzleType, timeLimitExceeded, maxAttemptsExceeded, router]);

  // Persist Sudoku failure to the server when the time limit is exceeded.
  // Without this, the puzzle can reappear as "available" after refresh.
  useEffect(() => {
    if (puzzle?.puzzleType !== 'sudoku') return;
    if (!timeLimitExceeded) return;
    if (progress?.solved) return;
    if (sudokuLockSentRef.current) return;

    sudokuLockSentRef.current = true;

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`sudoku-failed:${puzzleId}`, JSON.stringify({ ts: Date.now(), reason: 'time_limit' }));
      }
    } catch {
      // ignore
    }

    void (async () => {
      try {
        await fetch(`/api/puzzles/${puzzleId}/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'lock_puzzle',
            reason: 'time_limit',
            durationSeconds: sudokuStartRef.current ? Math.round((Date.now() - sudokuStartRef.current) / 1000) : 0,
          }),
        });
      } catch {
        // ignore
      }
    })();
  }, [puzzle?.puzzleType, timeLimitExceeded, progress?.solved, puzzleId]);

  // Fetch hints separately to get stats and history (also fetches token balance for sudoku)
  useEffect(() => {
    if (!puzzleId) return;

    const fetchHints = async () => {
      try {
        const response = await fetch(`/api/puzzles/${puzzleId}/hints`);
        if (!response.ok) throw new Error("Failed to fetch hints");
        const data = await response.json();
        const hintsArr: HintWithStats[] = Array.isArray(data) ? data : (data.hints ?? []);
        // Only set hints for non-sudoku puzzles; always set token balance
        if (puzzle?.puzzleType !== 'sudoku') setHints(hintsArr);
        if (data.hintTokens != null) setHintTokens(data.hintTokens);
        if (data.skipTokens != null) setSkipTokens(data.skipTokens);

        // Auto-reveal hints the user has already used (they paid the token previously)
        const alreadyRevealed = new Set<string>();
        const alreadyUsedIds: string[] = [];
        for (const h of hintsArr) {
          if (h.userHistory && h.userHistory.length > 0) {
            alreadyRevealed.add(h.id);
            alreadyUsedIds.push(h.id);
          }
        }
        if (alreadyRevealed.size > 0) {
          setRevealedHints((prev) => new Set([...prev, ...alreadyRevealed]));
          setUsedHintIds((prev) => [...new Set([...prev, ...alreadyUsedIds])]);
        }
      } catch (err) {
        console.error("Failed to fetch hints:", err);
      }
    };

    fetchHints();
  }, [puzzleId, puzzle?.puzzleType]);

  // Fetch progress data
  useEffect(() => {
    if (!puzzleId) return;

    const fetchProgress = async () => {
      try {
        const response = await fetch(`/api/puzzles/${puzzleId}/progress`);
        if (!response.ok) {
          let bodyText = '';
          try {
            bodyText = await response.text();
          } catch (e) {
            bodyText = '<unreadable response body>';
          }
          console.error(`Progress fetch failed: status=${response.status} ${response.statusText}`, bodyText);
          // handle common statuses gracefully
          if (response.status === 401) {
            // unauthorized — user may need to sign in
            return;
          }
          return;
        }
        const data = await response.json();
        setProgress(data);
      } catch (err) {
        console.error("Failed to fetch progress (network):", err);
      }
    };

    fetchProgress();
  }, [puzzleId]);

  // Team puzzle safety: mark entry + listen for lobby resets, and auto-reset if a teammate never reaches this page.
  useEffect(() => {
    if (!puzzleId) return;
    const teamId = teamIdParam;
    if (!teamId) return;

    let socket: any = null;
    let cancelled = false;
    let currentUserId: string | null = null;
    let checkTimer: any = null;

    const buildLobbyUrl = (notice: string) =>
      `/teams/${teamId}/lobby?puzzleId=${encodeURIComponent(puzzleId)}&notice=${encodeURIComponent(notice)}`;

    const getUserId = async () => {
      try {
        const r = await fetch('/api/user/info');
        const j = await r.json().catch(() => ({}));
        return (j?.id as string) || null;
      } catch {
        return null;
      }
    };

    const markEnteredPuzzle = async () => {
      try {
        await fetch('/api/team/lobby', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'enteredPuzzle', teamId, puzzleId }),
        });
      } catch {
        // ignore
      }
    };

    const fetchLobbyState = async () => {
      try {
        const res = await fetch(`/api/team/lobby?teamId=${encodeURIComponent(teamId)}&puzzleId=${encodeURIComponent(puzzleId)}`);
        const j = await res.json().catch(() => ({}));
        return j;
      } catch {
        return null;
      }
    };

    const maybeAutoResetIfMissingPlayer = async () => {
      try {
        const lobby = await fetchLobbyState();
        if (!lobby?.exists) return;
        const participants = Array.isArray(lobby.participants) ? lobby.participants : [];
        const entered = lobby.enteredPuzzleAt && typeof lobby.enteredPuzzleAt === 'object' ? Object.keys(lobby.enteredPuzzleAt).length : 0;
        if (participants.length > 0 && entered >= participants.length) return;

        if (!currentUserId) return;
        if (lobby.leaderId && lobby.leaderId !== currentUserId) return;

        await fetch('/api/team/lobby', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reset', teamId, puzzleId, reason: 'missing_player_navigation' }),
        });
      } catch {
        // ignore
      }
    };

    (async () => {
      currentUserId = await getUserId();
      if (cancelled) return;
      await markEnteredPuzzle();

      // Join the lobby room so we reliably receive room-scoped broadcasts.
      try {
        const { io } = await import('socket.io-client');

        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || (process.env.NODE_ENV !== 'production' ? 'http://localhost:4000' : '');
        if (!socketUrl) return;

        socket = io(socketUrl, { transports: ['polling', 'websocket'] });
        socket.on('connect', () => {
          try {
            socket.emit('joinLobby', { teamId, puzzleId, userId: currentUserId || '', name: session?.user?.name || '' });
          } catch {
            // ignore
          }
        });

        const participantLeftHandler = (payload: any) => {
          try {
            if (!payload) return;
            if (payload.teamId !== teamId || payload.puzzleId !== puzzleId) return;
            const name = payload.userName || payload.userId || 'A player';
            const url = buildLobbyUrl(`${name} left the lobby`);
            try { router.push(url); } catch { window.location.href = url; }
          } catch {
            // ignore
          }
        };

        const destroyedHandler = (payload: any) => {
          try {
            if (!payload) return;
            if (payload.teamId !== teamId || payload.puzzleId !== puzzleId) return;
            const reason = String(payload.reason || 'leader_shutdown');

            if (reason === 'player_disconnected' || reason === 'missing_player' || reason === 'missing_player_navigation') {
              const url = buildLobbyUrl('Lobby reset. Return to the lobby to restart.');
              try { router.push(url); } catch { window.location.href = url; }
              return;
            }

            try { router.push('/dashboard'); } catch { window.location.href = '/dashboard'; }
          } catch {
            // ignore
          }
        };

        socket.on('participantLeft', participantLeftHandler);
        socket.on('lobbyDestroyed', destroyedHandler);

        // cleanup handlers stored on socket for removal
        (socket as any).__pw_participantLeftHandler = participantLeftHandler;
        (socket as any).__pw_destroyedHandler = destroyedHandler;
      } catch {
        // ignore socket init errors
      }

      // If someone never reaches the puzzle page, reset the lobby.
      // This runs from the puzzle page (leader is almost always here).
      checkTimer = setTimeout(maybeAutoResetIfMissingPlayer, 20000);
    })();

    return () => {
      cancelled = true;
      try { if (checkTimer) clearTimeout(checkTimer); } catch { /* ignore */ }
      try {
        if (socket) {
          socket.off('participantLeft', (socket as any).__pw_participantLeftHandler);
          socket.off('lobbyDestroyed', (socket as any).__pw_destroyedHandler);
          socket.disconnect();
        }
      } catch {
        // ignore
      }
    };
  }, [puzzleId, teamIdParam, session?.user?.name, router]);
  useEffect(() => {
    if (!puzzleId || !session) return;

    const startSession = async () => {
      try {
        await fetch(`/api/puzzles/${puzzleId}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start_session" }),
        });
        sessionStartRef.current = new Date();
      } catch (err) {
        console.error("Failed to start session:", err);
      }
    };

    startSession();

    // End session on unmount
    return () => {
      const endSession = async () => {
        try {
          await fetch(`/api/puzzles/${puzzleId}/progress`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "end_session" }),
          });
        } catch (err) {
          console.error("Failed to end session:", err);
        }
      };

      endSession();
    };
  }, [puzzleId, session]);

  const handleRevealHint = async (hintId: string) => {
    setRevealingHint(hintId);
    try {
      const response = await fetch(`/api/puzzles/${puzzleId}/hints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hintId }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to reveal hint");
        return;
      }

      const revealData = await response.json();
      // Update token balance from the response
      if (revealData.remainingTokens != null) {
        setHintTokens(revealData.remainingTokens);
      }

      // Mark hint as revealed
      setRevealedHints((prev) => new Set([...prev, hintId]));
      setUsedHintIds((prev) => [...prev, hintId]);

      // Refresh hints to get updated stats
      const hintsResponse = await fetch(`/api/puzzles/${puzzleId}/hints`);
      if (hintsResponse.ok) {
        const updatedData = await hintsResponse.json();
        const hintsArr = Array.isArray(updatedData) ? updatedData : (updatedData.hints ?? []);
        setHints(hintsArr);
        if (updatedData.hintTokens != null) setHintTokens(updatedData.hintTokens);
      }
    } catch (err) {
      setError("Failed to reveal hint");
      console.error(err);
    } finally {
      setRevealingHint(null);
    }
  };

  const handleRateHelpfulness = async (hintId: string, wasHelpful: boolean) => {
    // This could be extended to track user feedback on hint usefulness
    console.log(`Hint ${hintId} rated as ${wasHelpful ? "helpful" : "not helpful"}`);
  };

  // Consumes one hint token server-side for sudoku hints; returns true on success.
  const handleSudokuHintUsed = async (): Promise<boolean> => {
    try {
      const response = await fetch("/api/user/consume-hint-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) return false;
      const data = await response.json();
      if (data.remainingTokens != null) setHintTokens(data.remainingTokens);
      return true;
    } catch {
      return false;
    }
  };

  const handlePuzzleSolved = async (xpOverride?: number) => {
    const xp = xpOverride ?? (puzzle?.xpReward ?? 50);
    const before = calcLevel(userTotalXp);
    const after = calcLevel(userTotalXp + xp);

    let levelReward: { points?: number; hintTokens?: number; skipTokens?: number; label: string } | null = null;
    if (after.level > before.level) {
      try {
        const res = await fetch("/api/user/claim-level-reward", { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          levelReward = data.reward ?? null;
        }
      } catch {
        // non-critical — modal still shows without reward info
      }
    }

    setXpModalData({
      xpGained: xp,
      oldLevel: before.level,
      newLevel: after.level,
      newTitle: after.title,
      oldProgress: before.progress,
      newProgress: after.progress,
      levelReward,
    });
    setShowXpModal(true);
    // Notify the Navbar (and any other listener) that XP has changed
    window.dispatchEvent(new CustomEvent('puzzlewarz:xp-updated'));
    // Trigger an immediate achievement check instead of waiting for the 30-second poll
    window.dispatchEvent(new CustomEvent('puzzlewarz:puzzle-solved'));
    // Fire-and-forget: fetch comparison stats so they're ready when XP modal dismisses
    fetch(`/api/puzzles/${puzzleId}/comparison-stats`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setComparisonStats(data); })
      .catch(() => {});
  };

  const handleGiveUpConfirm = async () => {
    setShowGiveUpConfirm(false);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`sudoku-failed:${puzzleId}`, JSON.stringify({ ts: Date.now(), reason: 'given_up' }));
      }
    } catch (e) { /* ignore */ }
    try {
      sudokuLockSentRef.current = true;
      await fetch(`/api/puzzles/${puzzleId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lock_puzzle', reason: 'given_up', durationSeconds: sudokuStartRef.current ? Math.round((Date.now() - sudokuStartRef.current) / 1000) : 0 }),
      });
    } catch (e) { /* ignore */ }
    try {
      await fetch(`/api/puzzles/${puzzleId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_state' }),
      });
    } catch (e) { /* ignore */ }
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`sudoku-progress:${puzzleId}`);
        localStorage.removeItem(`sudoku-start:${puzzleId}`);
      }
    } catch (e) { /* ignore */ }
    try {
      if (sudokuTimerRef.current != null) {
        clearInterval(sudokuTimerRef.current);
        sudokuTimerRef.current = null;
      }
      sudokuStartRef.current = null;
    } catch (e) { /* ignore */ }
    setMaxAttemptsExceeded(true);
    setTimeout(() => router.push('/puzzles'), 3500);
  };

  const handleJigsawComplete = async (timeSpentSeconds?: number): Promise<number> => {
    const prevPoints = progress?.pointsEarned || 0;
    try {
      const resp = await fetch(`/api/puzzles/${puzzleId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'attempt_success', durationSeconds: timeSpentSeconds || 0 }),
      });
      if (resp.ok) {
        const updated = await resp.json();
        setProgress(updated);
        setSuccess(true);
        const newPoints = updated?.pointsEarned ?? prevPoints;
        const pointsAwarded = Math.max(0, newPoints - prevPoints);
        setJustAwardedPoints(pointsAwarded);
        setCompletionSeconds(timeSpentSeconds ?? null);
        return pointsAwarded;
      }
    } catch (err) {
      console.error('Failed to log jigsaw success:', err);
    }
    setSuccess(true);
    return 0;
  };

  const handlePuzzleTypeComplete = async (elapsed?: number, xp?: number) => {
    if (progress?.solved) {
      return;
    }
    if (puzzleTypeCompletionInFlightRef.current) {
      return;
    }

    puzzleTypeCompletionInFlightRef.current = true;
    setError("");
    try {
      const committed = await recordCompletionAndShowModal(elapsed, xp);
      if (committed) {
        setSuccess(true);
      }
    } finally {
      puzzleTypeCompletionInFlightRef.current = false;
    }
  };

  const handleSkipPuzzle = async () => {
    if (isSkipping || progress?.solved) return;
    if (effectiveSkipTokens < 1) return;
    setIsSkipping(true);
    try {
      const res = await fetch(`/api/puzzles/${puzzleId}/skip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || "Failed to skip puzzle", "error");
        return;
      }
      setSkipTokens(data.remainingTokens ?? 0);
      // Refresh progress so the puzzle shows as solved
      try {
        const progressRes = await fetch(`/api/puzzles/${puzzleId}/progress`);
        if (progressRes.ok) setProgress(await progressRes.json());
      } catch { /* non-critical */ }
      handlePuzzleSolved(data.xpGained);
    } catch {
      addToast("Failed to skip puzzle", "error");
    } finally {
      setIsSkipping(false);
    }
  };

  // Used by non-sudoku puzzle types: computes elapsed, fetches updated points, then shows modals.
  const recordCompletionAndShowModal = async (elapsedOverride?: number, xpOverride?: number): Promise<boolean> => {
    const prevPoints = progress?.pointsEarned || 0;
    const elapsed = elapsedOverride ?? (sessionStartRef.current ? Math.round((Date.now() - sessionStartRef.current.getTime()) / 1000) : null);
    setCompletionSeconds(elapsed);

    if (!progress?.solved) {
      try {
        const completionResponse = await fetch(`/api/puzzles/${puzzleId}/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'attempt_success',
            ...(typeof elapsed === 'number' ? { durationSeconds: elapsed } : {}),
          }),
        });

        if (!completionResponse.ok) {
          let bodyText = '';
          try {
            bodyText = await completionResponse.text();
          } catch {
            bodyText = '<unreadable response body>';
          }
          console.error('Failed to record puzzle success:', completionResponse.status, bodyText);
          setError('Failed to record puzzle completion. Please try again.');
          return false;
        }

        const updatedProgress = await completionResponse.json();
        setProgress(updatedProgress);
        const newPoints = updatedProgress?.pointsEarned ?? prevPoints;
        setJustAwardedPoints(Math.max(0, newPoints - prevPoints));
      } catch (err) {
        console.error('Failed to record puzzle success:', err);
        setError('Failed to record puzzle completion. Please try again.');
        return false;
      }
    }

    try {
      const progressResponse = await fetch(`/api/puzzles/${puzzleId}/progress`);
      if (progressResponse.ok) {
        const updatedProgress = await progressResponse.json();
        setProgress(updatedProgress);
        const newPoints = updatedProgress?.pointsEarned ?? prevPoints;
        setJustAwardedPoints(Math.max(0, newPoints - prevPoints));
      }
    } catch (err) {
      console.error("Failed to refresh progress for completion modal:", err);
    }
    handlePuzzleSolved(xpOverride);
    return true;
  };

  const handleSudokuSubmit = async (submittedGrid: number[][]) => {
    const prevPoints = progress?.pointsEarned || 0;
    setSuccess(true);
    setShowSolvedMessage(true);
    setTimeout(() => setShowSolvedMessage(false), 3000);
    handlePuzzleSolved();

    // Record success and get updated progress (single request) including elapsed time
    const elapsedSeconds = sudokuStartRef.current ? Math.round((Date.now() - sudokuStartRef.current) / 1000) : 0;
    // keep a stable copy for UI (modal/puzzles list)
    setCompletionSeconds(elapsedSeconds);
    try {
      const resp = await fetch(`/api/puzzles/${puzzleId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'attempt_success', durationSeconds: elapsedSeconds, grid: submittedGrid }),
      });

      if (resp.ok) {
        const updated = await resp.json();
        setProgress(updated);
        const newPoints = updated?.pointsEarned ?? prevPoints;
        const pointsAwarded = Math.max(0, newPoints - prevPoints);
        setJustAwardedPoints(pointsAwarded);
      } else {
        let bodyText = '';
        try { bodyText = await resp.text(); } catch (e) { bodyText = '<unreadable response body>'; }
        console.error('Failed to record Sudoku success', resp.status, bodyText);
      }
    } catch (err) {
      console.error('Failed to record Sudoku success:', err);
    }

    // Store completion elapsed time locally so puzzles list can display it
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`sudoku-completed:${puzzleId}`, JSON.stringify({ ts: Date.now(), elapsedSeconds }));
      }
    } catch (e) {
      // ignore
    }

    // Clear any saved local progress for this Sudoku so it doesn't persist after solving
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`sudoku-progress:${puzzleId}`);
        localStorage.removeItem(`sudoku-start:${puzzleId}`);
      }
    } catch (e) {
      // ignore
    }

    // Best-effort: tell the server to clear any saved state for this puzzle progress
    (async () => {
      try {
        await fetch(`/api/puzzles/${puzzleId}/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clear_state' }),
        });
      } catch (e) {
        // ignore network errors
      }
    })();

    // Also call the submit endpoint for compatibility (will accept SUDOKU_SOLVED)
    try {
      await fetch(`/api/puzzles/${puzzleId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: "SUDOKU_SOLVED" }),
      });
    } catch (err) {
      console.error('Failed to submit Sudoku token:', err);
    }

    // stop the sudoku timer
    try {
      if (sudokuTimerRef.current != null) {
        clearInterval(sudokuTimerRef.current);
        sudokuTimerRef.current = null;
      }
      sudokuStartRef.current = null;
    } catch (e) {
      // ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Skip if this is a Sudoku puzzle
    if (puzzle?.puzzleType === 'sudoku' || puzzle?.puzzleType === 'jigsaw' || puzzle?.puzzleType === 'detective_case' || puzzle?.puzzleType === 'jim_wyze_case' || puzzle?.puzzleType === 'crack_safe' || puzzle?.puzzleType === 'crime_rpg' || puzzle?.puzzleType === 'parasite_code' || puzzle?.puzzleType === 'gridlock_file' || puzzle?.puzzleType === 'vault') {
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess(false);

    try {
      // Log the attempt
      try {
        await fetch(`/api/puzzles/${puzzleId}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "log_attempt" }),
        });
      } catch (err) {
        console.error("Failed to log attempt:", err);
      }

      const response = await fetch(`/api/puzzles/${puzzleId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.locked) {
          if (data.attemptsUsed !== undefined) {
            setProgress((prev) => prev ? { ...prev, failedAttempts: data.attemptsUsed } : prev);
          }
          setError(`Puzzle locked — you've used all 3 attempts.`);
          return;
        }
        setError(data.error || "Failed to submit answer");
        return;
      }

      if (data.correct) {
        setSuccess(true);
        setAnswer("");

        // Log successful attempt in progress
        try {
          await fetch(`/api/puzzles/${puzzleId}/progress`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "attempt_success" }),
          });
        } catch (err) {
          console.error("Failed to log success:", err);
        }

        // Update hint effectiveness with hints that led to solve
        if (usedHintIds.length > 0) {
          try {
            await fetch(`/api/puzzles/${puzzleId}/hints/update-effectiveness`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ hintIds: usedHintIds }),
            });
          } catch (err) {
            console.error("Failed to update hint effectiveness:", err);
          }
        }

        // Refresh progress
        try {
          const progressResponse = await fetch(`/api/puzzles/${puzzleId}/progress`);
          if (progressResponse.ok) {
            const updatedProgress = await progressResponse.json();
            const prevPoints = progress?.pointsEarned || 0;
            const newPoints = updatedProgress?.pointsEarned ?? prevPoints;
            setJustAwardedPoints(Math.max(0, newPoints - prevPoints));
            setProgress(updatedProgress);
          }
        } catch (err) {
          console.error("Failed to refresh progress:", err);
        }

        // Track elapsed time from session start
        const elapsed = sessionStartRef.current ? Math.round((Date.now() - sessionStartRef.current.getTime()) / 1000) : null;
        setCompletionSeconds(elapsed);

        // Show XP modal then rating modal
        handlePuzzleSolved();
      } else {
        // Update attempt count in progress state
        if (data.attemptsUsed !== undefined) {
          setProgress((prev) => prev ? { ...prev, failedAttempts: data.attemptsUsed } : prev);
        }
        if (data.locked) {
          setError(`Puzzle locked — you've used all 3 attempts.${data.revealAnswer ? ` The answer was: ${data.revealAnswer}` : ""}`);
        } else {
          const remaining = data.attemptsRemaining;
          const suffix = remaining !== undefined ? ` (${remaining} attempt${remaining !== 1 ? "s" : ""} left)` : "";
          setError((data.message || "Incorrect answer. Try again!") + suffix);
        }
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#020202" }}>
        <PuzzlePageSkeleton />
      </div>
    );
  }

  if (!puzzle) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#020202" }}>
        <div style={{ color: "#AB9F9D" }} className="text-lg">
          Puzzle not found
        </div>
      </div>
    );
  }

  const skin = getSkinTokens(activeSkin);

  return (
    <div
      style={{
        backgroundColor: skin.boardBg !== "rgba(15,18,25,0.97)" ? skin.boardBg : "#020202",
        backgroundImage: activeSkin === "default"
          ? "linear-gradient(135deg, #020202 0%, #0a0a0a 50%, #020202 100%)"
          : `linear-gradient(135deg, ${skin.boardBg} 0%, ${skin.tileBg} 50%, ${skin.boardBg} 100%)`,
        fontFamily: skin.tileFontFamily || undefined,
        // Expose skin tokens as CSS variables for child components
        "--ps-board-bg":    skin.boardBg,
        "--ps-board-border": skin.boardBorder,
        "--ps-board-shadow": skin.boardShadow,
        "--ps-tile-bg":     skin.tileBg,
        "--ps-tile-border": skin.tileBorder,
        "--ps-tile-text":   skin.tileText,
        "--ps-correct":     skin.accentCorrect,
        "--ps-wrong":       skin.accentWrong,
        "--ps-active":      skin.accentActive,
        "--ps-input-bg":    skin.inputBg,
        "--ps-input-border": skin.inputBorder,
        "--ps-input-text":  skin.inputText,
        "--ps-btn-bg":      skin.btnBg,
        "--ps-btn-text":    skin.btnText,
        "--ps-label":       skin.labelColor,
      } as React.CSSProperties}
      className="min-h-screen"
    >
      <PuzzlePageOverlays
        timeLimitExceeded={timeLimitExceeded}
        maxAttemptsExceeded={maxAttemptsExceeded}
        showGiveUpConfirm={showGiveUpConfirm}
        sudokuTimeLimitMinutes={puzzle?.sudoku?.timeLimitSeconds ? Math.round(puzzle.sudoku.timeLimitSeconds / 60) : 15}
        onGoToPuzzles={() => router.push('/puzzles')}
        onGiveUpConfirm={handleGiveUpConfirm}
        onGiveUpCancel={() => setShowGiveUpConfirm(false)}
      />


      <div className="flex-1 w-full px-3 sm:px-8 py-6 sm:py-8">
        <div className="w-full max-w-5xl mx-auto">

          {/* ── Back navigation ─────────────────────────────────── */}
          <div className="flex items-center gap-2 mb-5">
            <Link
              href="/puzzles"
              className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-80"
              style={{ color: "#AB9F9D" }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>←</span> Puzzles
            </Link>
            <span style={{ color: "#AB9F9D", opacity: 0.35 }}>/</span>
            <span className="text-sm truncate max-w-[200px] sm:max-w-xs" style={{ color: "#DDDBF1" }}>
              {(() => {
                const escapeTitle = (puzzle?.escapeRoom?.roomTitle || '').toString().trim();
                const puzzleTitle = (puzzle?.title || '').toString().trim();
                if ((puzzle?.puzzleType === 'escape_room' || puzzle?.puzzleType === 'jim_wyze_case') && escapeTitle) return escapeTitle;
                if ((puzzleTitle === '' || puzzleTitle === 'Untitled Puzzle') && escapeTitle) return escapeTitle;
                return puzzleTitle || escapeTitle || 'Untitled Puzzle';
              })()}
            </span>
          </div>

          {/* ── Main puzzle card ─────────────────────────────────── */}
          <div
            className="rounded-2xl mb-6 sm:mb-8 overflow-hidden"
            style={{
              backgroundColor: "rgba(10,12,18,0.98)",
              border: "1px solid rgba(56,145,166,0.28)",
              boxShadow: "0 4px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(56,145,166,0.06) inset",
            }}
          >
            {/* ── Card header ─────────────────────────────────────── */}
            <div
              style={{
                padding: "24px 28px 20px",
                background: "linear-gradient(180deg, rgba(56,145,166,0.1) 0%, transparent 100%)",
                borderBottom: "1px solid rgba(56,145,166,0.18)",
              }}
            >
              {/* Badge row */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {/* Difficulty */}
                <span
                  className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full whitespace-nowrap"
                  style={{
                    ...(DIFFICULTY_BADGE_STYLE[puzzle.difficulty] ?? {
                      backgroundColor: "rgba(100,100,120,0.15)",
                      color: "#DDDBF1",
                      border: "1px solid rgba(100,100,120,0.35)",
                    }),
                  }}
                >
                  {puzzle.difficulty}
                </span>
                {/* Puzzle type */}
                {puzzle.puzzleType && (
                  <span
                    className="text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap"
                    style={{
                      backgroundColor: "rgba(56,145,166,0.12)",
                      color: "#3891A6",
                      border: "1px solid rgba(56,145,166,0.35)",
                    }}
                  >
                    {getPuzzleTypeLabel(puzzle.puzzleType)}
                  </span>
                )}
                {/* XP reward */}
                {puzzle.xpReward != null && puzzle.xpReward > 0 && (
                  <span
                    className="text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap"
                    style={{
                      backgroundColor: "rgba(253,231,76,0.1)",
                      color: "#FDE74C",
                      border: "1px solid rgba(253,231,76,0.28)",
                    }}
                  >
                    ✦ {puzzle.xpReward} XP
                  </span>
                )}
                {/* Solved indicator */}
                {progress?.solved && (
                  <span
                    className="text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap"
                    style={{
                      backgroundColor: "rgba(16,185,129,0.12)",
                      color: "#4ade80",
                      border: "1px solid rgba(16,185,129,0.35)",
                    }}
                  >
                    ✓ Solved
                  </span>
                )}
              </div>

              {/* Title */}
              <h1
                className="font-extrabold leading-tight mb-2"
                style={{
                  color: "#fff",
                  fontSize: "clamp(22px, 4vw, 34px)",
                  letterSpacing: "-0.025em",
                }}
              >
                {(() => {
                  const escapeTitle = (puzzle?.escapeRoom?.roomTitle || '').toString().trim();
                  const puzzleTitle = (puzzle?.title || '').toString().trim();
                  if ((puzzle?.puzzleType === 'escape_room' || puzzle?.puzzleType === 'jim_wyze_case') && escapeTitle) return escapeTitle;
                  if ((puzzleTitle === '' || puzzleTitle === 'Untitled Puzzle') && escapeTitle) return escapeTitle;
                  return puzzleTitle || escapeTitle || 'Untitled Puzzle';
                })()}
              </h1>

              {/* Category */}
              {puzzle.puzzleType !== 'riddle' && (
                <div className="flex items-center gap-1.5 text-sm" style={{ color: "#3891A6" }}>
                  <span>◈</span>
                  <span>{puzzle.category.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                </div>
              )}
            </div>

            {/* ── Card body ───────────────────────────────────────── */}
            <div className="p-4 sm:p-8">

            {/* Math Problem Configuration (if present) */}
            {puzzle.puzzleType === 'math' && puzzle.math && (
              <div className="prose prose-invert max-w-none mb-8">
                <div
                  className="whitespace-pre-wrap rounded-lg p-6 border"
                  style={{
                    color: "#FDE74C",
                    backgroundColor: "rgba(56, 145, 166, 0.1)",
                    borderColor: "rgba(56, 145, 166, 0.4)",
                  }}
                >
                  <strong>Math Problem Configuration</strong>
                  <div className="mt-2">
                    {puzzle.math.problemStatement && (
                      <div className="mb-2">
                        <strong>Problem Statement:</strong><br />
                        {puzzle.math.problemStatement}
                      </div>
                    )}
                    {puzzle.math.workingExample && (
                      <div className="mb-2">
                        <strong>Working Example:</strong><br />
                        {puzzle.math.workingExample}
                      </div>
                    )}
                    {puzzle.math.mathType && (
                      <div className="mb-2">
                        <strong>Math Type:</strong> {puzzle.math.mathType}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}


            {puzzle.puzzleType !== 'jigsaw' && puzzle.media && puzzle.media.length > 0 && (
              <div
                className="mb-8 p-6 rounded-lg border"
                style={{ backgroundColor: "rgba(56, 145, 166, 0.1)", borderColor: "#3891A6" }}
              >
                <h2 className="text-xl font-semibold text-white mb-4">📎 Media</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {puzzle.media.map((media) => (
                    <div
                      key={media.id}
                      className="rounded-lg overflow-hidden border transition-colors"
                      style={{ backgroundColor: "rgba(255,255,255,0.03)", borderColor: "rgba(56,145,166,0.3)" }}
                    >
                      {media.type === "image" && puzzle.puzzleType !== 'jigsaw' && (
                        <ImageViewer
                          src={media.url}
                          alt={media.title || "Puzzle image"}
                          title={media.title}
                        />
                      )}
                      {media.type === "video" && (
                        <video
                          controls
                          className="w-full h-48 bg-black"
                          poster={media.thumbnail}
                        >
                          <source src={media.url} type={media.mimeType} />
                          Your browser does not support the video tag.
                        </video>
                      )}
                      {media.type === "audio" && (
                        <div
                          className="flex items-center justify-center h-24"
                          style={{ backgroundImage: "linear-gradient(to right, #FDE74C, #3891A6)" }}
                        >
                          <audio controls className="w-full">
                            <source src={media.url} type={media.mimeType} />
                            Your browser does not support the audio element.
                          </audio>
                        </div>
                      )}
                      {media.type === "document" && (
                        <div
                          className="flex flex-col items-center justify-center h-32"
                          style={{ backgroundColor: "rgba(76, 91, 92, 0.7)" }}
                        >
                          <div className="text-4xl mb-2">📄</div>
                          <a
                            href={media.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm break-words text-center px-2 hover:opacity-80"
                            style={{ color: "#FDE74C" }}
                          >
                            {media.title || media.fileName}
                          </a>
                        </div>
                      )}
                      {media.title && (
                        <div style={{ borderTopColor: "rgba(56,145,166,0.25)", borderTopWidth: "1px" }} className="p-3">
                          <p className="text-white font-semibold text-sm">{media.title}</p>
                          {media.description && (
                            <p style={{ color: "#DDDBF1" }} className="text-xs mt-1">
                              {media.description}
                            </p>
                          )}
                          {typeof media.fileSize === 'number' && (
                            <p style={{ color: "#DDDBF1" }} className="text-xs mt-2">
                              {(media.fileSize / 1024 / 1024).toFixed(2)} MB
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div
                className="mb-6 p-4 rounded-lg border"
                style={{ backgroundColor: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.45)", color: "#fca5a5" }}
              >
                {error}
              </div>
            )}


            {showSolvedMessage && (
              <div
                className="mb-6 p-4 rounded-lg border text-white text-center text-lg font-semibold"
                style={{ backgroundColor: "rgba(56, 211, 153, 0.15)", borderColor: "#38D399" }}
              >
                🎉 Puzzle Solved! Excellent work!
              </div>
            )}

            {showXpModal && xpModalData && (
              <PuzzleXpModal
                xpGained={xpModalData.xpGained}
                pointsEarned={justAwardedPoints ?? 0}
                oldLevel={xpModalData.oldLevel}
                newLevel={xpModalData.newLevel}
                newTitle={xpModalData.newTitle}
                oldProgress={xpModalData.oldProgress}
                newProgress={xpModalData.newProgress}
                levelReward={xpModalData.levelReward}
                completionAnimation={activeCompletionAnimation}
                onDismiss={() => {
                  setShowXpModal(false);
                  if (comparisonStats) {
                    setShowComparisonModal(true);
                  } else {
                    setShowRatingModal(true);
                  }
                }}
              />
            )}

            {showComparisonModal && comparisonStats && (
              <PuzzleComparisonModal
                puzzleId={puzzleId}
                stats={comparisonStats}
                onDismiss={() => {
                  setShowComparisonModal(false);
                  setShowRatingModal(true);
                }}
              />
            )}

            {showRatingModal && puzzle && (
              <PuzzleCompletionRatingModal
                puzzleId={puzzleId}
                puzzleTitle={puzzle.title}
                difficulty={puzzle.difficulty}
                funFact={puzzle.puzzleType === 'jigsaw' && jigsawPlayable ? (jigsawPlayable.data as any).funFact : undefined}
                  onClose={() => {
                    setShowRatingModal(false);
                    router.push("/puzzles");
                  }}
                  onSubmit={() => {
                    router.push("/puzzles");
                  }}
                  initialAwardedPoints={justAwardedPoints}
                  completionSeconds={completionSeconds}
              />
            )}

            {showSudokuHelp && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
                <div className="max-w-lg w-full bg-gradient-to-br from-[#071016] to-[#09313a] text-white rounded-xl p-6 shadow-2xl border border-[#FDE74C]/20">
                  <div className="flex items-start justify-between">
                    <h2 className="text-2xl font-extrabold text-yellow-300">How to play Sudoku</h2>
                    <button onClick={() => setShowSudokuHelp(false)} className="text-white/80 hover:text-white">✕</button>
                  </div>
                  <div className="mt-4 space-y-3 text-sm text-gray-200">
                    <p><strong>Objective:</strong> Fill the 9×9 grid so each row, column, and 3×3 box contains the digits 1 through 9 exactly once.</p>
                    <p><strong>Givens:</strong> Numbers shown in bold are pre-filled and cannot be changed.</p>
                    <p>Click an empty cell and type a digit 1–9. Use the board's Submit button to check your solution, or the board will validate automatically when complete.</p>
                    <p><strong>Limits:</strong> You have <strong>{puzzle?.sudoku?.timeLimitSeconds ? Math.round((puzzle.sudoku.timeLimitSeconds)/60) : 15} minutes</strong> and <strong>{puzzle?.sudoku?.maxAttempts ?? 5}</strong> attempts.</p>
                    <p className="text-yellow-200">Tip: Work by scanning rows/columns/boxes and eliminating possibilities. Start with the easiest cells.</p>
                  </div>
                  <div className="mt-6 text-right">
                    <button onClick={() => setShowSudokuHelp(false)} className="px-4 py-2 rounded bg-yellow-300 text-black font-semibold">Got it</button>
                  </div>
                </div>
              </div>
            )}

            {/* Toasts (inline above puzzle) */}
            <Toasts toasts={toasts} onRemove={(id) => removeToast(id)} inline />

            <PuzzleTypeRenderer
              puzzle={puzzle}
              progress={progress}
              puzzleId={puzzleId}
              teamIdParam={teamIdParam}
              lobbyIdParam={lobbyIdParam}
              jigsawPlayable={jigsawPlayable}
              jigsawControls={jigsawControls}
              setJigsawControls={setJigsawControls}
              effectiveHintTokens={effectiveHintTokens}
              onHintUsed={handleSudokuHintUsed}
              onSolved={handlePuzzleTypeComplete}
              onJigsawComplete={handleJigsawComplete}
              onJigsawShowRatingModal={handlePuzzleSolved}
            />

            {/* Default form — text / sudoku / code_master puzzle types */}
            {!['jigsaw','escape_room','jim_wyze_case','detective_case','crime_rpg','parasite_code','gridlock_file','crack_safe','word_crack','crossword','word_search','anagram_blitz','arg','blackout','vault'].includes(puzzle?.puzzleType ?? '') && (
              <form onSubmit={handleSubmit} className="mb-8">
                {progress?.solved && (
                  <div className="mb-6 p-4 rounded-lg border text-white" style={{ backgroundColor: "rgba(76, 91, 92, 0.3)", borderColor: "#3891A6" }}>
                    ✓ You have already solved this puzzle! Visit the puzzles page to try another one.
                  </div>
                )}

                {puzzle?.puzzleType === 'sudoku' ? (
                  <div className="mb-4">
                    {/* Sudoku Start Modal Overlay */}
                    {showSudokuStartModal && !progress?.solved && !sudokuStarted && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
                        <div className="max-w-md w-full bg-gradient-to-br from-[#071016] to-[#09313a] text-white rounded-xl p-8 shadow-2xl border border-[#FDE74C]/20 flex flex-col items-center">
                          <div className="flex flex-col items-center gap-4">
                            <div className="flex-shrink-0 w-20 h-20 rounded-full bg-gradient-to-br from-[#FDE74C] to-[#FFB86B] flex items-center justify-center shadow-lg mb-2">
                              <span className="text-4xl">🧩</span>
                            </div>
                            <h2 className="text-2xl font-extrabold text-yellow-300 text-center">Ready to Start the Sudoku?</h2>
                            <p className="mt-2 text-base text-gray-200 text-center">You have <span className="font-bold text-yellow-200">{puzzle?.sudoku?.timeLimitSeconds ? Math.round((puzzle.sudoku.timeLimitSeconds) / 60) : 15}</span> minutes and <span className="font-bold text-yellow-200">{puzzle?.sudoku?.maxAttempts ?? 5}</span> guesses. The timer will start when you click Start.</p>
                          </div>
                          <button
                            className="mt-8 px-6 py-3 rounded-lg bg-yellow-300 text-black font-bold text-lg shadow hover:brightness-95 transition"
                            type="button"
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();

                              setShowSudokuStartModal(false);
                              setSudokuStarted(true);

                              const limitSeconds = puzzle?.sudoku?.timeLimitSeconds ?? 15 * 60;
                              const localStart = Date.now();
                              const localExpiresAtMs = localStart + limitSeconds * 1000;

                              sudokuStartRef.current = localStart;
                              setSudokuElapsed(0);
                              setTimeLimitExceeded(false);

                              try {
                                if (sudokuTimerRef.current != null) {
                                  clearInterval(sudokuTimerRef.current);
                                  sudokuTimerRef.current = null;
                                }
                              } catch { /* ignore */ }

                              const localTick = () => {
                                const now = Date.now();
                                const elapsedNow = Math.max(0, Math.floor((now - localStart) / 1000));
                                setSudokuElapsed(elapsedNow);
                                if (now >= localExpiresAtMs) {
                                  setTimeLimitExceeded(true);
                                  try {
                                    if (sudokuTimerRef.current != null) {
                                      clearInterval(sudokuTimerRef.current);
                                      sudokuTimerRef.current = null;
                                    }
                                  } catch { /* ignore */ }
                                }
                              };

                              localTick();
                              sudokuTimerRef.current = window.setInterval(localTick, 1000) as any;

                              let localStartMs: number | null = null;
                              try {
                                const saved = typeof window !== 'undefined' ? localStorage.getItem(`sudoku-start:${puzzleId}`) : null;
                                if (saved) {
                                  const n = Number(saved);
                                  if (Number.isFinite(n) && n > 0) localStartMs = n;
                                }
                              } catch { /* ignore */ }

                              if (!localStartMs) {
                                try {
                                  if (typeof window !== 'undefined') {
                                    localStorage.setItem(`sudoku-start:${puzzleId}`, String(localStart));
                                  }
                                } catch { /* ignore */ }
                                localStartMs = localStart;
                              }

                              try {
                                const resp = await fetch(`/api/puzzles/${puzzleId}/progress`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ action: 'start_sudoku_timer', clientStartedAtMs: localStartMs ?? undefined }),
                                });
                                if (resp.ok) {
                                  const updated = await resp.json();
                                  setProgress(updated);
                                } else {
                                  const t = await resp.text().catch(() => '');
                                  console.error('Failed to start sudoku timer', resp.status, t);
                                }
                              } catch (e) {
                                console.error('Failed to start sudoku timer (network)', e);
                              }
                            }}
                          >
                            Start Puzzle
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Render the interactive Sudoku board after the user starts */}
                    {sudokuStarted && (
                      <div className="mb-6">
                        <div className="mb-1 flex flex-col items-center gap-1 px-2 py-1 rounded bg-[#071016] text-sm">
                          <div className="text-2xl sm:text-3xl" style={{ color: '#FDE74C', fontWeight: 800, lineHeight: 1 }}>
                            {(() => {
                              const limit = puzzle?.sudoku?.timeLimitSeconds ?? 15 * 60;
                              const rem = Math.max(0, limit - sudokuElapsed);
                              const mm = Math.floor(rem / 60).toString().padStart(2, '0');
                              const ss = (rem % 60).toString().padStart(2, '0');
                              return `Time remaining: ${mm}:${ss}`;
                            })()}
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowSudokuHelp(true)}
                            className="mt-1 text-xs text-[#AB9F9D] hover:text-white underline"
                          >
                            How to play
                          </button>
                        </div>

                        <SudokuGrid
                          puzzle={(sudokuOriginal ?? (sudokuGrid as unknown as number[][])) as number[][]}
                          givens={sudokuOriginal ?? undefined}
                          solution={sudokuSolution ?? undefined}
                          onChange={(g) => {
                            setSudokuGrid(g);
                            try {
                              if (typeof window !== 'undefined') {
                                localStorage.setItem(`sudoku-progress:${puzzleId}`, JSON.stringify(g));
                              }
                            } catch (e) { /* ignore */ }
                          }}
                          onValidatedSuccess={(sol) => {
                            try {
                              handleSudokuSubmit(sol);
                            } catch (e) {
                              console.error('Sudoku success handler failed:', e);
                            }
                          }}
                          disabled={timeLimitExceeded || maxAttemptsExceeded || Boolean(progress?.solved)}
                          maxAttempts={puzzle?.sudoku?.maxAttempts ?? 5}
                          hintTokens={effectiveHintTokens}
                          onHintUsed={handleSudokuHintUsed}
                          onAttempt={(attemptNumber, locked) => {
                            setSudokuAttemptsUsed(attemptNumber);
                            if (!locked) return;

                            setMaxAttemptsExceeded(true);

                            try {
                              if (typeof window !== 'undefined') {
                                localStorage.setItem(`sudoku-failed:${puzzleId}`, JSON.stringify({ ts: Date.now(), reason: 'max_attempts' }));
                              }
                            } catch { /* ignore */ }

                            if (!sudokuLockSentRef.current) {
                              sudokuLockSentRef.current = true;
                              void (async () => {
                                try {
                                  await fetch(`/api/puzzles/${puzzleId}/progress`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      action: 'lock_puzzle',
                                      reason: 'max_attempts',
                                      durationSeconds: sudokuStartRef.current ? Math.round((Date.now() - sudokuStartRef.current) / 1000) : 0,
                                    }),
                                  });
                                } catch { /* ignore */ }
                              })();
                            }

                            try {
                              if (typeof window !== 'undefined') {
                                localStorage.removeItem(`sudoku-progress:${puzzleId}`);
                                localStorage.removeItem(`sudoku-start:${puzzleId}`);
                              }
                            } catch { /* ignore */ }
                          }}
                        />
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Code Master IDE */}
                {puzzle?.puzzleType === 'code_master' && (
                  <div className="mb-6">
                    <CodeMasterIDE
                      language={String(puzzle?.data?.language || 'html')}
                      brokenCode={String(puzzle?.data?.brokenCode || '')}
                      prefillCss={String(puzzle?.data?.prefillCss || '')}
                      files={puzzle?.data?.files as Record<string, string> | undefined}
                      validationMode={String(puzzle?.data?.validationMode || 'exact')}
                      validationRules={puzzle?.data?.validationRules as { mustContain?: string[]; mustNotContain?: string[]; ignoreCase?: boolean; ignoreWhitespace?: boolean } | undefined}
                      expectedFix={String(puzzle?.data?.expectedFix || '')}
                      theory={puzzle?.data?.theory ? String(puzzle.data.theory) : undefined}
                      lessonSummary={puzzle?.data?.lessonSummary ? String(puzzle.data.lessonSummary) : undefined}
                      concepts={Array.isArray(puzzle?.data?.concepts) ? (puzzle.data.concepts as string[]) : undefined}
                      track={puzzle?.data?.track ? String(puzzle.data.track) : undefined}
                      trackOrder={puzzle?.data?.trackOrder ? Number(puzzle.data.trackOrder) : undefined}
                      scenario={puzzle?.data?.scenario ? String(puzzle.data.scenario) : undefined}
                      puzzleId={puzzle?.id}
                      solved={progress?.solved}
                      onCodeChange={(combined) => setAnswer(combined)}
                    />
                  </div>
                )}

                {/* Text answer area — standard puzzles */}
                {puzzle?.puzzleType !== 'sudoku' && puzzle?.puzzleType !== 'code_master' && (
                  <>
                    <textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      disabled={submitting || success || progress?.solved}
                      placeholder={progress?.solved ? "This puzzle has been solved." : "Enter your answer here..."}
                      className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-400 focus:outline-none disabled:opacity-50"
                      style={{ backgroundColor: "#111820", borderWidth: "2px", borderColor: "rgba(56,145,166,0.35)" }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "#3891A6")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(56,145,166,0.35)")}
                      rows={4}
                    />
                    <button
                      type="submit"
                      disabled={submitting || success || !answer.trim() || progress?.solved}
                      className="mt-4 px-6 py-2.5 rounded-lg font-bold tracking-wide transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: "#3891A6", color: "#020202" }}
                    >
                      {submitting ? "Submitting..." : progress?.solved ? "Puzzle Solved ✓" : "Submit Answer"}
                    </button>
                  </>
                )}

                {puzzle?.puzzleType === 'code_master' && (
                  <button
                    type="submit"
                    disabled={submitting || success || !answer.trim() || progress?.solved}
                    className={`mt-5 w-full py-3.5 rounded-xl text-white font-bold text-sm tracking-wide transition-all disabled:opacity-50 shadow-lg ${
                      progress?.solved
                        ? 'bg-emerald-700 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] shadow-indigo-900/50'
                    }`}
                  >
                    {submitting ? 'Submitting…' : progress?.solved ? '✓ Puzzle Solved' : 'Submit Fix →'}
                  </button>
                )}
              </form>
            )}

            {/* Hints / Progress Section Wrapper */}
            <PuzzleProgressSection
              progress={progress}
              puzzleTitle={puzzle?.title}
              showProgress={showProgress}
              onToggleProgress={() => setShowProgress(!showProgress)}
              effectiveSkipTokens={effectiveSkipTokens}
              isSkipping={isSkipping}
              onSkip={handleSkipPuzzle}
              teamIdParam={teamIdParam}
              puzzleType={puzzle?.puzzleType}
            />
            </div>{/* end card body */}
          </div>{/* end card outer */}
        </div>
      </div>
    </div>
  );
}
