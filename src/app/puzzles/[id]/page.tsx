"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ImageViewer from "@/components/ImageViewer";
import SudokuPuzzle, { type SudokuPresentationState, type SudokuPuzzleHandle } from "@/components/puzzle/SudokuPuzzle";
import { PuzzlePageSkeleton } from "@/components/Skeleton";
import PuzzleCompletionRatingModal from "@/components/puzzle/PuzzleCompletionRatingModal";
import PuzzleXpModal from "@/components/puzzle/PuzzleXpModal";
import PuzzleComparisonModal, { type ComparisonStats } from "@/components/puzzle/PuzzleComparisonModal";
import { calcLevel } from "@/lib/levels";
import { FEATURE_TOKENS_ENABLED } from "@/lib/featureFlags";
import Toasts from '@/components/Toast';
import type { JigsawPuzzle as JigsawPuzzleType } from "@/lib/puzzle-types";
import type {
  JigsawCompletionResult,
  JigsawPresentationState,
  JigsawPuzzleHandle,
} from "@/components/puzzle/JigsawPuzzle";
import type { Socket } from "socket.io-client";
import CodeMasterIDE from "@/components/puzzle/CodeMasterIDE";
import { getSkinTokens } from "@/lib/puzzleSkins";
import { PuzzleTypeRenderer } from "@/components/puzzle/PuzzleTypeRenderer";
import CatalogSkipControl from "@/components/puzzle/CatalogSkipControl";
import PuzzleFullscreenFrame from "@/components/puzzle/PuzzleFullscreenFrame";
import { PuzzleProgressSection } from "@/components/puzzle/PuzzleProgressSection";
import PuzzleBugReportButton from "@/components/puzzle/PuzzleBugReportButton";
import BugReportModal from "@/components/puzzle/BugReportModal";
import PuzzlePlayShell from "@/components/app-shell/PuzzlePlayShell";
import { PuzzleHeaderActions, PuzzleHeaderCrosswordActions } from "@/components/app-shell/PuzzleHeader";
import type {
  CrosswordPresentationState,
  CrosswordPuzzleHandle,
} from "@/components/puzzle/CrosswordPuzzle";
import type {
  AnagramBlitzHandle,
  AnagramPresentationState,
} from "@/components/puzzle/AnagramBlitz";
import type {
  WordSearchCompletionResult,
  WordSearchPresentationState,
  WordSearchPuzzleHandle,
} from "@/components/puzzle/WordSearchPuzzle";
import type {
  GridlockPresentationState,
  GridlockPuzzleHandle,
} from "@/components/puzzle/GridlockFilePuzzle";
import { juice } from "@/lib/juice";
import Pressable from "@/components/juice/Pressable";
import { confettiBurstAt } from "@/components/juice/particles";
import { normalizeAnagramConfig } from "@/lib/anagramConfig";
import { useLibraryStarterPathCompletion } from "@/hooks/useLibraryStarterPathCompletion";
import { loadOnboardingState } from "@/lib/onboarding";
import LibraryCompletionHandoff, { isLibraryCompletionHandoffEligible } from "@/components/onboarding/LibraryCompletionHandoff";

interface XpModalData {
  xpGained: number;
  oldLevel: number;
  newLevel: number;
  newTitle: string;
  oldProgress: number;
  newProgress: number;
}

function formatCrosswordHeaderTime(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatAnagramHeaderTime(timeLeftMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(timeLeftMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatSudokuHeaderTime(timeMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(timeMs / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
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

// Shape of the team-lobby socket events consumed on this page (participantLeft, lobbyDestroyed).
interface LobbySocketPayload {
  teamId?: string;
  puzzleId?: string;
  userName?: string;
  userId?: string;
  reason?: string;
}

export default function PuzzleDetailPage() {
  const crosswordRef = useRef<CrosswordPuzzleHandle | null>(null);
  const anagramRef = useRef<AnagramBlitzHandle | null>(null);
  const sudokuRef = useRef<SudokuPuzzleHandle | null>(null);
  const wordSearchRef = useRef<WordSearchPuzzleHandle | null>(null);
  const gridlockRef = useRef<GridlockPuzzleHandle | null>(null);
  const [crosswordPresentation, setCrosswordPresentation] = useState<CrosswordPresentationState | null>(null);
  const [anagramPresentation, setAnagramPresentation] = useState<AnagramPresentationState | null>(null);
  const [sudokuPresentation, setSudokuPresentation] = useState<SudokuPresentationState | null>(null);
  const [wordSearchPresentation, setWordSearchPresentation] = useState<WordSearchPresentationState | null>(null);
  const [gridlockPresentation, setGridlockPresentation] = useState<GridlockPresentationState | null>(null);
  const [sudokuCelebrationPending, setSudokuCelebrationPending] = useState(false);
  const [showHeaderBugReport, setShowHeaderBugReport] = useState(false);
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const puzzleId = params.id as string;
  const teamIdParam = searchParams.get('teamId') || undefined;
  const lobbyIdParam = searchParams.get('lobbyId') || undefined;
  const sessionStartRef = useRef<Date | null>(null);

  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [progress, setProgress] = useState<PuzzleProgress | null>(null);
  const [progressLoading, setProgressLoading] = useState(true);
  const [progressError, setProgressError] = useState("");
  const [answer, setAnswer] = useState("");
  const puzzleTypeCompletionInFlightRef = useRef(false);
  const pageMountedRef = useRef(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState<{ unlocksAfterTitle: string | null } | null>(null);
  const [success, setSuccess] = useState(false);
  const [showSolvedMessage, setShowSolvedMessage] = useState(false);
  const [showProgress, setShowProgress] = useState(true);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [justAwardedPoints, setJustAwardedPoints] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Array<{id:string; message:string; type?: 'info'|'success'|'error'}>>([]);
  const [completionSeconds, setCompletionSeconds] = useState<number | null>(null);
  const [userTotalXp, setUserTotalXp] = useState<number>(0);
  const [showXpModal, setShowXpModal] = useState(false);
  // Bumped on each wrong answer to retrigger the shake animation + error pop-in
  const [shakeKey, setShakeKey] = useState(0);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const [xpModalData, setXpModalData] = useState<XpModalData | null>(null);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [comparisonStats, setComparisonStats] = useState<ComparisonStats | null>(null);
  const [showLibraryHandoff, setShowLibraryHandoff] = useState(false);

  const onboardingUserId = session?.user
    ? (session.user as { id?: string }).id || session.user.email || null
    : null;
  useLibraryStarterPathCompletion({
    userId: onboardingUserId,
    completed: success,
    enabled: !teamIdParam && !lobbyIdParam,
  });

  // Runs once the rating modal is dismissed: hands off to the final Starter
  // Path objective (Leaderboards) when eligible, otherwise falls back to the
  // normal post-completion destination. Never writes onboarding state itself.
  const finishCatalogCompletionFlow = () => {
    setShowRatingModal(false);

    const eligible =
      success &&
      !teamIdParam &&
      !lobbyIdParam &&
      Boolean(onboardingUserId) &&
      isLibraryCompletionHandoffEligible(loadOnboardingState(onboardingUserId as string));

    if (eligible) {
      setShowLibraryHandoff(true);
    } else {
      router.push("/puzzles");
    }
  };

  useEffect(() => {
    pageMountedRef.current = true;
    return () => { pageMountedRef.current = false; };
  }, []);

  // Fetch user's current total XP so we can animate the XP bar on puzzle completion
  useEffect(() => {
    fetch('/api/user/info')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.totalXp != null) setUserTotalXp(data.totalXp); })
      .catch(() => {});
  }, []);

  const addToast = (message: string, type: 'info'|'success'|'error' = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter(x => x.id !== id)), 4200);
  };

  const removeToast = (id: string) => setToasts((t) => t.filter(x => x.id !== id));
  const [usedHintIds, setUsedHintIds] = useState<string[]>([]);
  const [hintTokens, setHintTokens] = useState<number>(0);
  const [skipTokens, setSkipTokens] = useState<number>(0);
  const [isSkipping, setIsSkipping] = useState(false);

  // Tokens are tied to the store — hide them when the store is disabled
  const effectiveHintTokens = FEATURE_TOKENS_ENABLED ? hintTokens : 0;
  const effectiveSkipTokens = FEATURE_TOKENS_ENABLED ? skipTokens : 0;

  const jigsawRef = useRef<JigsawPuzzleHandle>(null);
  const [jigsawPresentation, setJigsawPresentation] = useState<JigsawPresentationState | null>(null);
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
        if (!response.ok) {
          if (response.status === 403) {
            const data = await response.json().catch(() => ({}));
            if (data?.error === "locked") {
              setLocked({ unlocksAfterTitle: data.unlocksAfterTitle || null });
              return;
            }
          }
          throw new Error("Failed to fetch puzzle");
        }
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

  const sudokuOriginal = useMemo<number[][] | null>(() => {
    if (puzzle?.puzzleType !== "sudoku" || !puzzle.sudoku) return null;
    try { return JSON.parse(puzzle.sudoku.puzzleGrid) as number[][]; }
    catch { return null; }
  }, [puzzle]);

  const sudokuSolution = useMemo<number[][] | null>(() => {
    if (puzzle?.puzzleType !== "sudoku" || !puzzle.sudoku) return null;
    try { return JSON.parse(puzzle.sudoku.solutionGrid) as number[][]; }
    catch { return null; }
  }, [puzzle]);

  // Fetch hints separately to get stats and history (also fetches token balance for sudoku)
  useEffect(() => {
    if (!puzzleId) return;

    const fetchHints = async () => {
      try {
        const response = await fetch(`/api/puzzles/${puzzleId}/hints`);
        if (!response.ok) throw new Error("Failed to fetch hints");
        const data = await response.json();
        const hintsArr: HintWithStats[] = Array.isArray(data) ? data : (data.hints ?? []);
        if (data.hintTokens != null) setHintTokens(data.hintTokens);
        if (data.skipTokens != null) setSkipTokens(data.skipTokens);

        // Auto-reveal hints the user has already used (they paid the token previously)
        const alreadyUsedIds = hintsArr
          .filter((h) => h.userHistory && h.userHistory.length > 0)
          .map((h) => h.id);
        if (alreadyUsedIds.length > 0) {
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
    let cancelled = false;
    setProgress(null);
    setProgressLoading(true);
    setProgressError("");
    setSudokuCelebrationPending(false);
    setSudokuPresentation(null);

    const fetchProgress = async () => {
      try {
        const response = await fetch(`/api/puzzles/${puzzleId}/progress`);
        if (!response.ok) {
          let bodyText = '';
          try {
            bodyText = await response.text();
          } catch {
            bodyText = '<unreadable response body>';
          }
          console.error(`Progress fetch failed: status=${response.status} ${response.statusText}`, bodyText);
          if (!cancelled) setProgressError("Unable to load your puzzle progress. Refresh to try again.");
          // handle common statuses gracefully
          if (response.status === 401) {
            // unauthorized — user may need to sign in
            return;
          }
          return;
        }
        const data = await response.json();
        if (!cancelled) setProgress(data);
      } catch (err) {
        console.error("Failed to fetch progress (network):", err);
        if (!cancelled) setProgressError("Unable to load your puzzle progress. Refresh to try again.");
      } finally {
        if (!cancelled) setProgressLoading(false);
      }
    };

    void fetchProgress();
    return () => { cancelled = true; };
  }, [puzzleId]);

  // Team puzzle safety: mark entry + listen for lobby resets, and auto-reset if a teammate never reaches this page.
  useEffect(() => {
    if (!puzzleId) return;
    const teamId = teamIdParam;
    if (!teamId) return;

    let socket: Socket | null = null;
    let cancelled = false;
    let currentUserId: string | null = null;
    let checkTimer: ReturnType<typeof setTimeout> | null = null;
    let participantLeftHandler: ((payload: LobbySocketPayload) => void) | null = null;
    let destroyedHandler: ((payload: LobbySocketPayload) => void) | null = null;

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

        const activeSocket = io(socketUrl, { transports: ['polling', 'websocket'] });
        socket = activeSocket;
        activeSocket.on('connect', () => {
          try {
            activeSocket.emit('joinLobby', { teamId, puzzleId, userId: currentUserId || '', name: session?.user?.name || '' });
          } catch {
            // ignore
          }
        });

        participantLeftHandler = (payload: LobbySocketPayload) => {
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

        destroyedHandler = (payload: LobbySocketPayload) => {
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

        activeSocket.on('participantLeft', participantLeftHandler);
        activeSocket.on('lobbyDestroyed', destroyedHandler);
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
          if (participantLeftHandler) socket.off('participantLeft', participantLeftHandler);
          if (destroyedHandler) socket.off('lobbyDestroyed', destroyedHandler);
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
    try {
      window.sessionStorage.setItem("pw:justCompletedPuzzleId", puzzleId);
    } catch { /* ignore */ }

    const xp = xpOverride ?? (puzzle?.xpReward ?? 50);
    const before = calcLevel(userTotalXp);
    const after = calcLevel(userTotalXp + xp);

    setXpModalData({
      xpGained: xp,
      oldLevel: before.level,
      newLevel: after.level,
      newTitle: after.title,
      oldProgress: before.progress,
      newProgress: after.progress,
    });
    juice.reward();
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

  const handleJigsawComplete = async (timeSpentSeconds?: number): Promise<JigsawCompletionResult> => {
    if (progress?.solved) return { success: true, pointsAwarded: 0 };
    const prevPoints = progress?.pointsEarned || 0;
    try {
      const resp = await fetch(`/api/puzzles/${puzzleId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({ action: 'attempt_success', durationSeconds: timeSpentSeconds || 0 }),
      });
      if (resp.ok) {
        const updated = await resp.json();
        setProgress(updated);
        const newPoints = updated?.pointsEarned ?? prevPoints;
        const pointsAwarded = Math.max(0, newPoints - prevPoints);
        setJustAwardedPoints(pointsAwarded);
        setCompletionSeconds(timeSpentSeconds ?? null);
        return { success: true, pointsAwarded };
      }
      const data = await resp.json().catch(() => null) as { error?: string } | null;
      return { success: false, error: data?.error || "Completion could not be recorded." };
    } catch (err) {
      console.error('Failed to log jigsaw success:', err);
      return { success: false, error: "Completion could not be recorded. Check your connection and retry." };
    }
  };

  const handlePuzzleTypeComplete = async (
    elapsed?: number,
    xp?: number,
    options?: { modalDelayMs?: number },
  ) => {
    if (progress?.solved) {
      return;
    }
    if (puzzleTypeCompletionInFlightRef.current) {
      return;
    }

    puzzleTypeCompletionInFlightRef.current = true;
    setError("");
    try {
      const modalNotBefore = Date.now() + Math.max(0, options?.modalDelayMs ?? 0);
      const committed = await recordCompletionAndShowModal(elapsed, xp, modalNotBefore);
      if (committed && pageMountedRef.current) {
        setSuccess(true);
      }
    } finally {
      puzzleTypeCompletionInFlightRef.current = false;
    }
  };

  // Word Trove's final validated word already commits progress, points, and XP in
  // /word_search. This hand-off only refreshes that authoritative result and opens
  // the existing completion UI; it must never issue a generic attempt_success.
  const handleWordSearchComplete = async (): Promise<WordSearchCompletionResult> => {
    if (progress?.solved) return { success: true };
    if (puzzleTypeCompletionInFlightRef.current) {
      return { success: false, error: "Completion is already being refreshed." };
    }
    puzzleTypeCompletionInFlightRef.current = true;
    setError("");
    const previousPoints = progress?.pointsEarned ?? 0;
    try {
      const response = await fetch(`/api/puzzles/${puzzleId}/progress`, { cache: "no-store" });
      if (!response.ok) throw new Error("Completion was recorded, but progress could not be refreshed.");
      const updated = await response.json();
      if (!updated?.solved) throw new Error("Completion is still being confirmed. Please try again.");
      if (!pageMountedRef.current) return { success: false, error: "Completion view is no longer available." };
      setProgress(updated);
      setJustAwardedPoints(Math.max(0, (updated.pointsEarned ?? previousPoints) - previousPoints));
      setCompletionSeconds(sessionStartRef.current ? Math.round((Date.now() - sessionStartRef.current.getTime()) / 1000) : null);
      setSuccess(true);
      handlePuzzleSolved();
      return { success: true };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Completion could not be refreshed.";
      if (pageMountedRef.current) setError(message);
      return { success: false, error: message };
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
  const recordCompletionAndShowModal = async (
    elapsedOverride?: number,
    xpOverride?: number,
    modalNotBefore = 0,
  ): Promise<boolean> => {
    const prevPoints = progress?.pointsEarned || 0;
    const elapsed = elapsedOverride ?? (sessionStartRef.current ? Math.round((Date.now() - sessionStartRef.current.getTime()) / 1000) : null);
    setCompletionSeconds(elapsed);

    if (!progress?.solved) {
      try {
        const completionResponse = await fetch(`/api/puzzles/${puzzleId}/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
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
        if (!pageMountedRef.current) return true;
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
        if (!pageMountedRef.current) return true;
        setProgress(updatedProgress);
        const newPoints = updatedProgress?.pointsEarned ?? prevPoints;
        setJustAwardedPoints(Math.max(0, newPoints - prevPoints));
      }
    } catch (err) {
      console.error("Failed to refresh progress for completion modal:", err);
    }
    if (!pageMountedRef.current) return true;
    const modalDelay = Math.max(0, modalNotBefore - Date.now());
    if (modalDelay > 0) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, modalDelay));
    }
    if (!pageMountedRef.current) return true;
    handlePuzzleSolved(xpOverride);
    return true;
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
        juice.error();
        setShakeKey((k) => k + 1);
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
        juice.success();
        confettiBurstAt(submitButtonRef.current);
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
        juice.error();
        setShakeKey((k) => k + 1);
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
      <PuzzlePlayShell backHref="/puzzles" title="Loading…">
        <PuzzlePageSkeleton />
      </PuzzlePlayShell>
    );
  }

  if (locked) {
    return (
      <PuzzlePlayShell backHref="/puzzles" title="Puzzle Locked">
        <div className="h-full flex flex-col items-center justify-center gap-4 px-4 text-center">
          <div style={{ fontSize: 40 }}>🔒</div>
          <div style={{ color: "#F5F5F5" }} className="text-lg font-bold">
            This puzzle is locked
          </div>
          <div style={{ color: "#AB9F9D" }} className="text-sm max-w-sm">
            {locked.unlocksAfterTitle
              ? <>Complete <span style={{ color: "#FDE74C" }}>{locked.unlocksAfterTitle}</span> first to unlock this one.</>
              : "Complete the previous puzzle first to unlock it."}
          </div>
          <Link href="/puzzles" style={{ color: "#3891A6" }} className="text-sm font-semibold underline mt-2">
            Back to Puzzles
          </Link>
        </div>
      </PuzzlePlayShell>
    );
  }

  if (!puzzle) {
    return (
      <PuzzlePlayShell backHref="/puzzles" title="Puzzle Not Found">
        <div className="h-full flex items-center justify-center">
          <div style={{ color: "#AB9F9D" }} className="text-lg">
            Puzzle not found
          </div>
        </div>
      </PuzzlePlayShell>
    );
  }

  const skin = getSkinTokens(activeSkin);
  const normalizedAnagramConfig = normalizeAnagramConfig(puzzle.data);

  const displayTitle = (() => {
    const escapeTitle = (puzzle?.escapeRoom?.roomTitle || '').toString().trim();
    const puzzleTitle = (puzzle?.title || '').toString().trim();
    if ((puzzle?.puzzleType === 'escape_room' || puzzle?.puzzleType === 'jim_wyze_case') && escapeTitle) return escapeTitle;
    if ((puzzleTitle === '' || puzzleTitle === 'Untitled Puzzle') && escapeTitle) return escapeTitle;
    return puzzleTitle || escapeTitle || 'Untitled Puzzle';
  })();

  // Skip-token control — normally rendered below the puzzle by PuzzleProgressSection, which gets
  // hidden behind the fullscreen overlay. Passed into PuzzleFullscreenFrame so it's still
  // reachable while fullscreen. Mirrors the same eligibility checks as PuzzleProgressSection.
  const skipControl = !progress?.solved && !teamIdParam ? (
    <CatalogSkipControl tokens={effectiveSkipTokens} skipping={isSkipping} onSkip={handleSkipPuzzle} />
  ) : null;

  const catalogSudokuMounted = puzzle.puzzleType === "sudoku"
    && !progressLoading
    && !progressError
    && progress?.puzzleId === puzzleId
    && Boolean(sudokuOriginal)
    && Boolean(sudokuSolution)
    && (!progress.solved || sudokuCelebrationPending);
  const canGiveUpSudoku = catalogSudokuMounted
    && !progress?.solved
    && sudokuPresentation?.status !== "won"
    && sudokuPresentation?.status !== "lost";

  return (
    <>
      <PuzzlePlayShell
      backHref="/puzzles"
      title={puzzle.puzzleType === "gridlock_file" ? "GRIDLOCK FILE" : displayTitle}
      subtitle={puzzle.puzzleType === "anagram_blitz"
        ? `${anagramPresentation?.solvedCount ?? 0} / ${anagramPresentation?.totalWords ?? normalizedAnagramConfig.words.length} solved`
        : puzzle.puzzleType === "sudoku"
          ? `${sudokuPresentation?.attemptsLeft ?? puzzle.sudoku?.maxAttempts ?? 5} attempts left`
          : puzzle.puzzleType === "jigsaw"
            ? `${jigsawPresentation?.placedPieces ?? 0} / ${jigsawPresentation?.totalPieces ?? (puzzle.jigsaw ? puzzle.jigsaw.gridRows * puzzle.jigsaw.gridCols : 0)} pieces placed`
          : puzzle.puzzleType === "gridlock_file"
            ? `${gridlockPresentation?.selectedCount ?? 0} / ${gridlockPresentation?.requiredCount ?? 0} evidence marked`
          : undefined}
      progress={puzzle.puzzleType === "crossword"
        ? <span aria-label={`Elapsed time ${formatCrosswordHeaderTime(crosswordPresentation?.elapsedMs ?? 0)}`}>
            {formatCrosswordHeaderTime(crosswordPresentation?.elapsedMs ?? 0)}
          </span>
        : puzzle.puzzleType === "anagram_blitz"
          ? <span aria-label={`Remaining time ${formatAnagramHeaderTime(anagramPresentation?.timeLeftMs ?? normalizedAnagramConfig.timeLimitSeconds * 1000)}`}>
              {formatAnagramHeaderTime(anagramPresentation?.timeLeftMs ?? normalizedAnagramConfig.timeLimitSeconds * 1000)}
            </span>
          : puzzle.puzzleType === "sudoku"
            ? <span aria-label={`Remaining time ${formatSudokuHeaderTime(sudokuPresentation?.timeMs ?? (puzzle.sudoku?.timeLimitSeconds ?? 900) * 1000)}`}>
                {formatSudokuHeaderTime(sudokuPresentation?.timeMs ?? (puzzle.sudoku?.timeLimitSeconds ?? 900) * 1000)}
              </span>
            : puzzle.puzzleType === "word_search"
              ? <span aria-label={`${wordSearchPresentation?.foundCount ?? 0} of ${wordSearchPresentation?.totalWords ?? 0} words found`}>
                  {wordSearchPresentation?.foundCount ?? 0}/{wordSearchPresentation?.totalWords ?? 0} found
                </span>
              : puzzle.puzzleType === "jigsaw"
                ? <span aria-label={`Elapsed time ${formatCrosswordHeaderTime(jigsawPresentation?.elapsedMs ?? 0)}`}>
                    {formatCrosswordHeaderTime(jigsawPresentation?.elapsedMs ?? 0)}
                  </span>
              : puzzle.puzzleType === "gridlock_file"
                ? <span aria-label={`Elapsed time ${formatCrosswordHeaderTime(gridlockPresentation?.elapsedMs ?? 0)}`}>
                    {formatCrosswordHeaderTime(gridlockPresentation?.elapsedMs ?? 0)}
                  </span>
              : undefined}
      actions={puzzle.puzzleType === "crossword"
        ? <PuzzleHeaderCrosswordActions
            onClues={() => crosswordRef.current?.openClueSheet()}
            onHelp={() => crosswordRef.current?.openInstructions()}
            overflow={[
              skipControl,
              <button type="button" key="report-bug" onClick={() => setShowHeaderBugReport(true)}>
                Report Bug
              </button>,
            ]}
          />
        : puzzle.puzzleType === "anagram_blitz"
          ? <PuzzleHeaderActions
              onHelp={() => anagramRef.current?.openInstructions()}
              helpLabel="How to play Anagram Blitz"
              overflow={[
                skipControl,
                <button type="button" key="report-bug" onClick={() => setShowHeaderBugReport(true)}>
                  Report Bug
                </button>,
              ]}
            />
          : puzzle.puzzleType === "sudoku"
            ? <PuzzleHeaderActions
                onHelp={() => sudokuRef.current?.openInstructions()}
                helpLabel="How to play Sudoku"
                overflow={[
                  canGiveUpSudoku ? <button type="button" key="give-up" onClick={() => sudokuRef.current?.requestGiveUp()}>Give Up</button> : null,
                  skipControl,
                  <button type="button" key="report-bug" onClick={() => setShowHeaderBugReport(true)}>Report Bug</button>,
                ]}
              />
            : puzzle.puzzleType === "word_search"
              ? <PuzzleHeaderActions
                  onHelp={() => wordSearchRef.current?.openInstructions()}
                  helpLabel="How to play Word Trove"
                  overflow={[
                    skipControl,
                    <button type="button" key="report-bug" onClick={() => setShowHeaderBugReport(true)}>Report Bug</button>,
                  ]}
                />
            : puzzle.puzzleType === "jigsaw"
              ? <PuzzleHeaderActions
                  onHelp={() => jigsawRef.current?.openInstructions()}
                  helpLabel="How to play Jigsaw"
                  overflow={[
                    <button type="button" key="preview" onClick={() => jigsawRef.current?.openPreview()}>Preview Image</button>,
                    <button type="button" key="return" onClick={() => jigsawRef.current?.returnLooseToTray()}>Return Loose Pieces</button>,
                    <button type="button" key="reset" onClick={() => jigsawRef.current?.requestReset()}>Reset Puzzle</button>,
                    <button type="button" key="fullscreen" onClick={() => jigsawRef.current?.enterFullscreen()}>Fullscreen</button>,
                    skipControl,
                    <button type="button" key="report-bug" onClick={() => setShowHeaderBugReport(true)}>Report Bug</button>,
                  ]}
                />
            : puzzle.puzzleType === "gridlock_file"
              ? <PuzzleHeaderActions
                  onHelp={() => gridlockRef.current?.openHelp()}
                  helpLabel="How to play Gridlock"
                  overflow={[
                    <button type="button" key="reset" onClick={() => gridlockRef.current?.requestReset()}>Reset File</button>,
                    skipControl,
                    <button type="button" key="report-bug" onClick={() => setShowHeaderBugReport(true)}>Report Bug</button>,
                  ]}
                />
          : <PuzzleBugReportButton puzzleId={puzzleId} puzzleTitle={puzzle?.title ?? "This puzzle"} />}
      contentMode={puzzle.puzzleType === "jigsaw" || puzzle.puzzleType === "crossword" || puzzle.puzzleType === "anagram_blitz" || puzzle.puzzleType === "sudoku" || puzzle.puzzleType === "word_search" || puzzle.puzzleType === "gridlock_file" ? "fixed" : "scroll"}
      contentClassName={puzzle.puzzleType === "crossword"
        ? "pw-crossword-shell-content"
        : puzzle.puzzleType === "anagram_blitz"
          ? "pw-anagram-shell-content"
          : puzzle.puzzleType === "sudoku"
            ? "pw-sudoku-shell-content"
            : puzzle.puzzleType === "word_search"
              ? "pw-word-search-shell-content"
            : puzzle.puzzleType === "gridlock_file"
              ? "pw-gridlock-shell-content"
            : puzzle.puzzleType === "jigsaw"
              ? "pw-jigsaw-shell-content"
              : undefined}
    >
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
      className="puzzle-detail-play-stage min-h-full"
    >
      <div className="puzzle-detail-play-inner flex-1 w-full px-0 sm:px-8 py-3 sm:py-8">
        <div className="puzzle-detail-play-container w-full max-w-5xl mx-auto">

          {/* ── Main puzzle card ─────────────────────────────────── */}
          <div
            className="puzzle-detail-play-card rounded-none sm:rounded-2xl mb-3 sm:mb-8 overflow-hidden border-0 sm:border shadow-none sm:shadow-[0_4px_48px_rgba(0,0,0,0.5),0_0_0_1px_rgba(56,145,166,0.06)_inset]"
            style={{
              backgroundColor: "rgba(10,12,18,0.98)",
              borderColor: "rgba(56,145,166,0.28)",
            }}
          >
            {/* ── Card body ───────────────────────────────────────── */}
            {/* Visually-hidden h1 — PuzzleHeader shows the title visually; the page still
                needs one real heading for accessibility/SEO. */}
            <h1 className="sr-only">{displayTitle}</h1>
            <div className="puzzle-detail-play-card-body px-0 py-3 sm:p-8">

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
                key={`err-${shakeKey}`}
                className="mb-6 p-4 rounded-lg border pw-pop-in"
                style={{ backgroundColor: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.45)", color: "#fca5a5" }}
              >
                {error}
              </div>
            )}


            {showSolvedMessage && (
              <div
                className="mb-6 p-4 rounded-lg border text-white text-center text-lg font-semibold pw-pop-in"
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
                funFact={puzzle.puzzleType === 'jigsaw' && jigsawPlayable ? (jigsawPlayable.data as JigsawPuzzleType['data'] & { funFact?: string }).funFact : undefined}
                  onClose={finishCatalogCompletionFlow}
                  initialAwardedPoints={justAwardedPoints}
                  completionSeconds={completionSeconds}
              />
            )}

            <LibraryCompletionHandoff
              open={showLibraryHandoff}
              onViewLeaderboard={() => {
                setShowLibraryHandoff(false);
                router.push("/leaderboards");
              }}
              onBrowseMore={() => {
                setShowLibraryHandoff(false);
                router.push("/puzzles");
              }}
            />

            {/* Toasts (inline above puzzle) */}
            <Toasts toasts={toasts} onRemove={(id) => removeToast(id)} inline />

            {puzzle.puzzleType === "sudoku" && (progressLoading || (!progressError && progress?.puzzleId !== puzzleId)) && (
              <section className="sudoku-status-card" role="status"><span className="sudoku-spinner" />Loading your Sudoku round…</section>
            )}

            {puzzle.puzzleType === "sudoku" && !progressLoading && progressError && (
              <section className="sudoku-status-card" role="alert">{progressError}</section>
            )}

            {catalogSudokuMounted && sudokuOriginal && sudokuSolution && progress && (
              <SudokuPuzzle
                ref={sudokuRef}
                puzzleId={puzzleId}
                puzzle={sudokuOriginal}
                solution={sudokuSolution}
                mode="catalog"
                displayMode="app-shell"
                attemptsUsed={progress?.attempts ?? 0}
                attemptsAllowed={puzzle.sudoku?.maxAttempts ?? 5}
                hintTokens={effectiveHintTokens}
                timeLimitSeconds={puzzle.sudoku?.timeLimitSeconds ?? 900}
                serverStartedAt={progress?.sudokuStartedAt ? String(progress.sudokuStartedAt) : null}
                serverExpiresAt={progress?.sudokuExpiresAt ? String(progress.sudokuExpiresAt) : null}
                serverLockedAt={progress?.sudokuLockedAt ? String(progress.sudokuLockedAt) : null}
                serverLockReason={progress?.sudokuLockReason ?? null}
                onPresentationChange={setSudokuPresentation}
                onStartRound={async () => {
                  const response = await fetch(`/api/puzzles/${puzzleId}/progress`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "start_sudoku_timer" }),
                  });
                  if (!response.ok) {
                    const body = await response.json().catch(() => ({}));
                    throw new Error(body.error || "Unable to start Sudoku round");
                  }
                  const updated = await response.json(); setProgress(updated);
                  return { startedAt: updated.sudokuStartedAt, expiresAt: updated.sudokuExpiresAt, lockedAt: updated.sudokuLockedAt, lockReason: updated.sudokuLockReason, attemptsUsed: updated.attempts };
                }}
                onIncorrectAttempt={async (checkedGrid) => {
                  const response = await fetch(`/api/puzzles/${puzzleId}/progress`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "log_attempt", grid: checkedGrid }),
                  });
                  if (!response.ok) {
                    const body = await response.json().catch(() => ({}));
                    throw new Error(body.error || "That check could not be recorded.");
                  }
                  const updated = await response.json(); setProgress(updated);
                  return { success: false, attemptsUsed: updated.attempts };
                }}
                onComplete={async (completedGrid, elapsedSeconds) => {
                  const previousPoints = progress?.pointsEarned ?? 0;
                  const response = await fetch(`/api/puzzles/${puzzleId}/progress`, {
                    method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
                    body: JSON.stringify({ action: "attempt_success", durationSeconds: elapsedSeconds, grid: completedGrid }),
                  });
                  if (!response.ok) {
                    const body = await response.json().catch(() => ({}));
                    return { success: false, error: body.error || "Completion was not confirmed. Retry submission." };
                  }
                  const updated = await response.json();
                  setSudokuCelebrationPending(true);
                  setProgress(updated); setCompletionSeconds(elapsedSeconds);
                  setJustAwardedPoints(Math.max(0, (updated.pointsEarned ?? previousPoints) - previousPoints));
                  return { success: true, attemptsUsed: updated.attempts };
                }}
                onHintUsed={handleSudokuHintUsed}
                onGiveUp={async () => {
                  const response = await fetch(`/api/puzzles/${puzzleId}/progress`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "lock_puzzle", reason: "given_up" }),
                  });
                  if (!response.ok) {
                    const body = await response.json().catch(() => ({}));
                    throw new Error(body.error || "Unable to give up this round.");
                  }
                  setProgress(await response.json());
                }}
                onTimeout={async () => {
                  const response = await fetch(`/api/puzzles/${puzzleId}/progress`, {
                    method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
                    body: JSON.stringify({ action: "lock_puzzle", reason: "time_limit" }),
                  });
                  if (!response.ok) {
                    const body = await response.json().catch(() => ({}));
                    throw new Error(body.error || "Unable to confirm the timeout.");
                  }
                  setProgress(await response.json());
                }}
                onRetry={async () => {
                  const clear = await fetch(`/api/puzzles/${puzzleId}/progress`, {
                    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "clear_state" }),
                  });
                  if (!clear.ok) throw new Error("Unable to clear round");
                  const start = await fetch(`/api/puzzles/${puzzleId}/progress`, {
                    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start_sudoku_timer" }),
                  });
                  if (!start.ok) throw new Error("Unable to restart round");
                  const updated = await start.json(); setProgress(updated);
                  return { startedAt: updated.sudokuStartedAt, expiresAt: updated.sudokuExpiresAt, attemptsUsed: updated.attempts };
                }}
                onCelebrationComplete={() => {
                  setSudokuCelebrationPending(false);
                  setSuccess(true); setShowSolvedMessage(true); handlePuzzleSolved();
                }}
              />
            )}

            {puzzle.puzzleType === "sudoku" && !progressLoading && progress?.puzzleId === puzzleId && progress.solved && !sudokuCelebrationPending && (
              <section className="sudoku-result-card"><span aria-hidden>✓</span><h2>Sudoku solved!</h2><p>Your completion has been recorded.</p></section>
            )}

            <PuzzleTypeRenderer
              puzzle={puzzle}
              progress={progress}
              puzzleId={puzzleId}
              teamIdParam={teamIdParam}
              lobbyIdParam={lobbyIdParam}
              jigsawPlayable={jigsawPlayable}
              effectiveHintTokens={effectiveHintTokens}
              onHintUsed={handleSudokuHintUsed}
              onSolved={handlePuzzleTypeComplete}
              onAnagramSolved={(elapsedSeconds) => handlePuzzleTypeComplete(elapsedSeconds, undefined, { modalDelayMs: 900 })}
              onJigsawComplete={handleJigsawComplete}
              jigsawRef={jigsawRef}
              onJigsawPresentationChange={setJigsawPresentation}
              onJigsawShowRatingModal={() => {
                setSuccess(true);
                void handlePuzzleSolved();
              }}
              crosswordRef={crosswordRef}
              onCrosswordPresentationChange={setCrosswordPresentation}
              anagramRef={anagramRef}
              onAnagramPresentationChange={setAnagramPresentation}
              wordSearchRef={wordSearchRef}
              onWordSearchPresentationChange={setWordSearchPresentation}
              onWordSearchComplete={handleWordSearchComplete}
              gridlockRef={gridlockRef}
              onGridlockPresentationChange={setGridlockPresentation}
              skipControl={skipControl}
            />

            {/* Default form — text / sudoku / code_master puzzle types */}
            {!['sudoku','jigsaw','escape_room','jim_wyze_case','detective_case','crime_rpg','parasite_code','gridlock_file','crack_safe','word_crack','crossword','word_search','anagram_blitz','arg','blackout','vault','logic_grid'].includes(puzzle?.puzzleType ?? '') && (
              <form onSubmit={handleSubmit} className="mb-8">
                {progress?.solved && (
                  <div className="mb-6 p-4 rounded-lg border text-white" style={{ backgroundColor: "rgba(76, 91, 92, 0.3)", borderColor: "#3891A6" }}>
                    ✓ You have already solved this puzzle! Visit the puzzles page to try another one.
                  </div>
                )}

                {/* Code Master IDE */}
                {puzzle?.puzzleType === 'code_master' && (
                  <PuzzleFullscreenFrame extraControls={skipControl} puzzleId={puzzleId} puzzleTitle={puzzle?.title ?? "This puzzle"}>
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
                    <Pressable
                      type="submit"
                      ref={submitButtonRef}
                      disabled={submitting || success || !answer.trim() || progress?.solved}
                      className={`mt-5 w-full py-3.5 rounded-xl text-white font-bold text-sm tracking-wide transition-colors disabled:opacity-50 shadow-lg ${
                        progress?.solved
                          ? 'bg-emerald-700 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/50'
                      }`}
                    >
                      {submitting ? 'Submitting…' : progress?.solved ? '✓ Puzzle Solved' : 'Submit Fix →'}
                    </Pressable>
                  </PuzzleFullscreenFrame>
                )}

                {/* Text answer area — standard puzzles */}
                {puzzle?.puzzleType !== 'sudoku' && puzzle?.puzzleType !== 'code_master' && (
                  <>
                    {/* key retriggers the shake on every wrong answer */}
                    <div key={shakeKey} className={shakeKey > 0 ? "pw-shake" : undefined}>
                      <textarea
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        disabled={submitting || success || progress?.solved}
                        placeholder={progress?.solved ? "This puzzle has been solved." : "Enter your answer here..."}
                        className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-400 focus:outline-none disabled:opacity-50 transition-[border-color,box-shadow] duration-200"
                        style={{
                          backgroundColor: "#111820",
                          borderWidth: "2px",
                          borderColor: error && shakeKey > 0 ? "rgba(255,59,92,0.6)" : "rgba(56,145,166,0.35)",
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "#3891A6";
                          e.currentTarget.style.boxShadow = "0 0 14px rgba(56,145,166,0.35)";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = "rgba(56,145,166,0.35)";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                        rows={4}
                      />
                    </div>
                    <Pressable
                      type="submit"
                      ref={submitButtonRef}
                      ripple="dark"
                      disabled={submitting || success || !answer.trim() || progress?.solved}
                      className="mt-4 px-6 py-2.5 rounded-lg font-bold tracking-wide disabled:opacity-50"
                      style={{ backgroundColor: "#3891A6", color: "#020202" }}
                    >
                      {submitting ? "Submitting..." : progress?.solved ? "Puzzle Solved ✓" : "Submit Answer"}
                    </Pressable>
                  </>
                )}
              </form>
            )}

            {/* Hints / Progress Section Wrapper — Jigsaw already has its own Skip control in
                the header's "More puzzle actions" overflow menu, and word_crack renders its
                own CatalogSkipControl directly beneath the board, so this section would just
                duplicate it below. */}
            {puzzle.puzzleType !== "word_search" && puzzle.puzzleType !== "jigsaw" && puzzle.puzzleType !== "gridlock_file" && puzzle.puzzleType !== "word_crack" && <div className="puzzle-detail-progress-section">
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
            </div>}
            </div>{/* end card body */}
          </div>{/* end card outer */}
        </div>
      </div>
    </div>
      </PuzzlePlayShell>
      {showHeaderBugReport && (puzzle.puzzleType === "crossword" || puzzle.puzzleType === "anagram_blitz" || puzzle.puzzleType === "sudoku" || puzzle.puzzleType === "word_search") && (
        <BugReportModal
          puzzleId={puzzleId}
          puzzleTitle={puzzle.title ?? "This puzzle"}
          onClose={() => setShowHeaderBugReport(false)}
        />
      )}
    </>
  );
}
