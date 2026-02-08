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
import { EscapeRoomPuzzle } from "@/components/puzzle/EscapeRoomPuzzle";
import PuzzleCompletionRatingModal from "@/components/puzzle/PuzzleCompletionRatingModal";
import Toasts from '@/components/Toast';
import type { JigsawPuzzle as JigsawPuzzleType } from "@/lib/puzzle-types";
import JigsawPuzzle from "@/components/puzzle/JigsawPuzzle";
import CodeMasterIDE from "@/components/puzzle/CodeMasterIDE";
import DetectiveCasePuzzle from "@/components/puzzle/DetectiveCasePuzzle";

interface Puzzle {
  id: string;
  title: string;
  description: string;
  content: string;
  difficulty: string;
  puzzleType?: string;
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
}

const difficultyColors: Record<string, string> = {
  EASY: "bg-green-500/20 text-green-300 border-green-500/30",
  MEDIUM: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  HARD: "bg-red-500/20 text-red-300 border-red-500/30",
  EXPERT: "bg-[#3891A6]/20 text-[#3891A6] border-[#3891A6]/30",
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
  const [sudokuCompletionSeconds, setSudokuCompletionSeconds] = useState<number | null>(null);
  const [timeLimitExceeded, setTimeLimitExceeded] = useState(false);
  const [maxAttemptsExceeded, setMaxAttemptsExceeded] = useState(false);
  const [sudokuAttemptsUsed, setSudokuAttemptsUsed] = useState<number>(0);
  const [showGiveUpConfirm, setShowGiveUpConfirm] = useState(false);

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

  type JigsawControlsApi = {
    reset: () => void;
    sendLooseToTray: () => void;
    enterFullscreen: () => void;
    exitFullscreen: () => void;
    isFullscreen: boolean;
  };
  const [jigsawControls, setJigsawControls] = useState<JigsawControlsApi | null>(null);

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
      data: {
        imageUrl: puzzle.jigsaw.imageUrl,
        pieceCount,
        gridRows: puzzle.jigsaw.gridRows,
        gridCols: puzzle.jigsaw.gridCols,
        rotationEnabled: puzzle.jigsaw.rotationEnabled,
        snapTolerance: puzzle.jigsaw.snapTolerance,
      },
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
      if (!progress?.solved && !sudokuStarted) {
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
        // Resume timer if a start timestamp was saved
        try {
          const startKey = `sudoku-start:${puzzleId}`;
          const savedStart = typeof window !== 'undefined' ? localStorage.getItem(startKey) : null;
          if (savedStart) {
            const t = Number(savedStart);
            if (!Number.isNaN(t) && t > 0) {
              sudokuStartRef.current = t;
              const elapsed = Math.floor((Date.now() - t) / 1000);
              setSudokuElapsed(elapsed);
              const sudokuLimit = puzzle?.sudoku?.timeLimitSeconds ?? 15 * 60;
              if (elapsed >= sudokuLimit) {
                // auto-lock: user exceeded 15 minutes
                try {
                  if (typeof window !== 'undefined') {
                    localStorage.setItem(`sudoku-failed:${puzzleId}`, JSON.stringify({ ts: Date.now(), reason: 'time_limit' }));
                  }
                } catch (e) {
                  // ignore
                }
                addToast('Time limit exceeded. Puzzle locked.', 'error');
                (async () => {
                  try {
                    await fetch(`/api/puzzles/${puzzleId}/progress`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'lock_puzzle', durationSeconds: elapsed }),
                    });
                  } catch (e) {
                    // ignore
                  }

                  try {
                    await fetch(`/api/puzzles/${puzzleId}/progress`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'clear_state' }),
                    });
                  } catch (e) {
                    // ignore
                  }

                  try {
                    if (typeof window !== 'undefined') {
                      localStorage.removeItem(`sudoku-progress:${puzzleId}`);
                      localStorage.removeItem(startKey);
                    }
                  } catch (e) {
                    // ignore
                  }

                  try {
                    if (sudokuTimerRef.current != null) {
                      clearInterval(sudokuTimerRef.current);
                      sudokuTimerRef.current = null;
                    }
                    sudokuStartRef.current = null;
                  } catch (e) {
                    // ignore
                  }

                  setTimeout(() => router.push('/puzzles'), 800);
                })();
              } else {
                // start ticking and enforce time limit each tick
                sudokuTimerRef.current = window.setInterval(() => {
                  if (!sudokuStartRef.current) return;
                  const elapsedNow = Math.floor((Date.now() - sudokuStartRef.current) / 1000);
                  setSudokuElapsed(elapsedNow);
                  const sudokuLimit = puzzle?.sudoku?.timeLimitSeconds ?? 15 * 60;
                  if (elapsed >= sudokuLimit) {
                    // mark exceeded and show modal to user
                    setTimeLimitExceeded(true);
                    try {
                      if (typeof window !== 'undefined') {
                        localStorage.setItem(`sudoku-failed:${puzzleId}`, JSON.stringify({ ts: Date.now(), reason: 'time_limit' }));
                      }
                    } catch (e) {
                      // ignore storage errors
                    }
                    (async () => {
                      try {
                        await fetch(`/api/puzzles/${puzzleId}/progress`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'lock_puzzle', durationSeconds: elapsed }),
                        });
                      } catch (e) {
                        // ignore
                      }

                      try {
                        await fetch(`/api/puzzles/${puzzleId}/progress`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'clear_state' }),
                        });
                      } catch (e) {
                        // ignore
                      }

                      try {
                        if (typeof window !== 'undefined') {
                          localStorage.removeItem(`sudoku-progress:${puzzleId}`);
                          localStorage.removeItem(startKey);
                        }
                      } catch (e) {
                        // ignore
                      }

                      try {
                        if (sudokuTimerRef.current != null) {
                          clearInterval(sudokuTimerRef.current);
                          sudokuTimerRef.current = null;
                        }
                        sudokuStartRef.current = null;
                      } catch (e) {
                        // ignore
                      }

                      // give user time to read the modal, then redirect
                      setTimeout(() => router.push('/puzzles'), 3500);
                    })();
                  }
                }, 1000) as any;
              }
            }
          }
        } catch (e) {
          // ignore storage errors
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

  // Fetch hints separately to get stats and history
  useEffect(() => {
    if (!puzzleId) return;
    // Sudoku doesn't use hints; avoid fetching and rendering them.
    if (puzzle?.puzzleType === 'sudoku') return;

    const fetchHints = async () => {
      try {
        const response = await fetch(`/api/puzzles/${puzzleId}/hints`);
        if (!response.ok) throw new Error("Failed to fetch hints");
        const data = await response.json();
        setHints(data);
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
        socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000', { transports: ['websocket'] });
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

      // Mark hint as revealed
      setRevealedHints((prev) => new Set([...prev, hintId]));
      setUsedHintIds((prev) => [...prev, hintId]);

      // Refresh hints to get updated stats
      const hintsResponse = await fetch(`/api/puzzles/${puzzleId}/hints`);
      if (hintsResponse.ok) {
        const updatedHints = await hintsResponse.json();
        setHints(updatedHints);
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

  const handleSudokuSubmit = async (submittedGrid: number[][]) => {
    const prevPoints = progress?.pointsEarned || 0;
    setSuccess(true);
    setShowSolvedMessage(true);

    // Show solved message, then rating modal after delay (animation already finished when this is called)
    setTimeout(() => {
      setShowSolvedMessage(false);
      setShowRatingModal(true);
    }, 1500);

    // Record success and get updated progress (single request) including elapsed time
    const elapsedSeconds = sudokuStartRef.current ? Math.round((Date.now() - sudokuStartRef.current) / 1000) : 0;
    // keep a stable copy for UI (modal/puzzles list)
    setSudokuCompletionSeconds(elapsedSeconds);
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
    if (puzzle?.puzzleType === 'sudoku' || puzzle?.puzzleType === 'jigsaw' || puzzle?.puzzleType === 'detective_case') {
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
            setProgress(updatedProgress);
          }
        } catch (err) {
          console.error("Failed to refresh progress:", err);
        }

        // Show rating modal instead of immediately redirecting
        setShowRatingModal(true);
      } else {
        setError(data.message || "Incorrect answer. Try again!");
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#020202" }}>
        <div style={{ color: "#FDE74C" }} className="text-lg">
          Loading puzzle...
        </div>
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

  return (
    <div
      style={{
        backgroundColor: "#020202",
        backgroundImage: "linear-gradient(135deg, #020202 0%, #0a0a0a 50%, #020202 100%)",
      }}
      className="min-h-screen"
    >
      {timeLimitExceeded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="max-w-md w-full bg-gradient-to-br from-[#071016] to-[#09313a] text-white rounded-xl p-6 shadow-2xl border border-[#FDE74C]/20">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-[#FDE74C] to-[#FFB86B] flex items-center justify-center shadow-lg">
                <span className="text-3xl">⏱️</span>
              </div>
              <div className="flex-1 text-left">
                <h2 className="text-2xl font-extrabold text-yellow-300">Oh No! Time Limit Reached</h2>
                <p className="mt-1 text-sm text-gray-200">Puzzle failed. Try another puzzle — you'll get it next time!</p>
              </div>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs text-[#cbd5e1]">You will be redirected to the puzzles page shortly.</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push('/puzzles')}
                  className="px-4 py-2 rounded bg-yellow-300 text-black font-semibold shadow hover:brightness-95 transition"
                >
                  Go to puzzles now
                </button>
                <button
                  onClick={() => setTimeLimitExceeded(false)}
                  className="px-3 py-2 rounded bg-transparent border border-white/10 text-sm text-white/90 hover:bg-white/5 transition"
                >
                  Stay
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {maxAttemptsExceeded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="max-w-md w-full bg-gradient-to-br from-[#071016] to-[#09313a] text-white rounded-xl p-6 shadow-2xl border border-[#FDE74C]/20">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-[#FDE74C] to-[#FFB86B] flex items-center justify-center shadow-lg">
                <span className="text-3xl">🔒</span>
              </div>
              <div className="flex-1 text-left">
                <h2 className="text-2xl font-extrabold text-yellow-300">Oh No! Max Submissions Reached</h2>
                <p className="mt-1 text-sm text-gray-200">Puzzle failed due to too many incorrect submissions. Try another puzzle!</p>
              </div>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs text-[#cbd5e1]">You will be redirected to the puzzles page shortly.</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push('/puzzles')}
                  className="px-4 py-2 rounded bg-yellow-300 text-black font-semibold shadow hover:brightness-95 transition"
                >
                  Go to puzzles now
                </button>
                <button
                  onClick={() => setMaxAttemptsExceeded(false)}
                  className="px-3 py-2 rounded bg-transparent border border-white/10 text-sm text-white/90 hover:bg-white/5 transition"
                >
                  Stay
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showGiveUpConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="max-w-md w-full bg-gradient-to-br from-[#071016] to-[#09313a] text-white rounded-xl p-6 shadow-2xl border border-[#FDE74C]/20">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-[#FDE74C] to-[#FFB86B] flex items-center justify-center shadow-lg">
                <span className="text-3xl">❗</span>
              </div>
              <div className="flex-1 text-left">
                <h2 className="text-2xl font-extrabold text-yellow-300">Give Up?</h2>
                <p className="mt-1 text-sm text-gray-200">Giving up will mark this puzzle as failed and you will not be able to access it again. Are you sure?</p>
              </div>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs text-[#cbd5e1]">This action is permanent for this puzzle.</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    setShowGiveUpConfirm(false);
                    // call existing give-up flow
                    try {
                      if (typeof window !== 'undefined') {
                        localStorage.setItem(`sudoku-failed:${puzzleId}`, JSON.stringify({ ts: Date.now(), reason: 'given_up' }));
                      }
                    } catch (e) {
                      // ignore
                    }

                    try {
                      await fetch(`/api/puzzles/${puzzleId}/progress`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'lock_puzzle', durationSeconds: sudokuStartRef.current ? Math.round((Date.now() - sudokuStartRef.current) / 1000) : 0 }),
                      });
                    } catch (e) {
                      // ignore
                    }

                    try {
                      await fetch(`/api/puzzles/${puzzleId}/progress`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'clear_state' }),
                      });
                    } catch (e) {
                      // ignore
                    }

                    try {
                      if (typeof window !== 'undefined') {
                        localStorage.removeItem(`sudoku-progress:${puzzleId}`);
                        localStorage.removeItem(`sudoku-start:${puzzleId}`);
                      }
                    } catch (e) {
                      // ignore
                    }

                    try {
                      if (sudokuTimerRef.current != null) {
                        clearInterval(sudokuTimerRef.current);
                        sudokuTimerRef.current = null;
                      }
                      sudokuStartRef.current = null;
                    } catch (e) {
                      // ignore
                    }

                    setMaxAttemptsExceeded(true);
                    setTimeout(() => router.push('/puzzles'), 3500);
                  }}
                  className="px-4 py-2 rounded bg-yellow-300 text-black font-semibold shadow hover:brightness-95 transition"
                >
                  Give Up
                </button>
                <button
                  onClick={() => setShowGiveUpConfirm(false)}
                  className="px-3 py-2 rounded bg-transparent border border-white/10 text-sm text-white/90 hover:bg-white/5 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Header with Logo */}
      <nav
        className="backdrop-blur-md"
        style={{
          borderBottomColor: "#FDE74C",
          borderBottomWidth: "1px",
          backgroundColor: "rgba(76, 91, 92, 0.7)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/puzzles" className="flex items-center gap-3 hover:opacity-80 transition">
            <img src="/images/puzzle_warz_logo.png" alt="Puzzle Warz Logo" className="h-14 w-auto" />
            <div className="text-2xl font-bold" style={{ color: "#FDE74C" }}>
              Puzzle Warz
            </div>
          </Link>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 rounded-lg text-white transition-all hover:opacity-90"
            style={{ backgroundColor: "#3891A6", borderWidth: "1px", borderColor: "#3891A6" }}
          >
            ← Back
          </button>
        </div>
      </nav>

      <div className="flex-1 w-screen relative left-1/2 -translate-x-1/2 px-0 py-4 sm:p-8 sm:w-auto sm:static sm:translate-x-0">
        <div className="w-full">
          <div
            className="border rounded-lg p-8 mb-8"
            style={{ backgroundColor: "rgba(253, 231, 76, 0.08)", borderColor: "#FDE74C" }}
          >
            {/* Puzzle Title */}
            <h1 className="text-4xl font-bold text-white mb-4">{(() => {
              const escapeTitle = (puzzle?.escapeRoom?.roomTitle || '').toString().trim();
              const puzzleTitle = (puzzle?.title || '').toString().trim();
              if (puzzle?.puzzleType === 'escape_room' && escapeTitle) return escapeTitle;
              if ((puzzleTitle === '' || puzzleTitle === 'Untitled Puzzle') && escapeTitle) return escapeTitle;
              return puzzleTitle || escapeTitle || 'Untitled Puzzle';
            })()}</h1>
            <div className="flex items-center gap-4 mb-6">
              <span className={`px-4 py-2 rounded-full text-sm font-semibold border whitespace-nowrap ${
                difficultyColors[puzzle.difficulty] ||
                "bg-slate-500/20 text-slate-300 border-slate-500/30"
              }`}>
                {puzzle.difficulty}
              </span>
              {puzzle.puzzleType !== 'riddle' && (
                <span className="text-sm" style={{ color: "#3891A6" }}>
                  Category: {puzzle.category.name}
                </span>
              )}
            </div>

            {/* Math Problem Configuration (if present) */}
            {puzzle.puzzleType === 'math' && puzzle.math && (
              <div className="prose prose-invert max-w-none mb-8">
                <div
                  className="whitespace-pre-wrap rounded-lg p-6 border"
                  style={{
                    color: "#FDE74C",
                    backgroundColor: "rgba(56, 145, 166, 0.18)",
                    borderColor: "#FDE74C",
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
            {/* Main Puzzle Content */}
            {puzzle.puzzleType !== 'sudoku' && puzzle.puzzleType !== 'code_master' && puzzle.puzzleType !== 'jigsaw' && (
              <div className="prose prose-invert max-w-none mb-8">
                <div
                  className="whitespace-pre-wrap rounded-lg p-6 border"
                  style={{
                    color: "#DDDBF1",
                    backgroundColor: "rgba(56, 145, 166, 0.1)",
                    borderColor: "#3891A6",
                  }}
                >
                  {puzzle.content}
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
                      style={{ backgroundColor: "rgba(76, 91, 92, 0.5)", borderColor: "#FDE74C" }}
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
                        <div style={{ borderTopColor: "#FDE74C", borderTopWidth: "1px" }} className="p-3">
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
                className="mb-6 p-4 rounded-lg border text-white"
                style={{ backgroundColor: "rgba(171, 159, 157, 0.2)", borderColor: "#AB9F9D" }}
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

            {showRatingModal && puzzle && (
              <PuzzleCompletionRatingModal
                puzzleId={puzzleId}
                puzzleTitle={puzzle.title}
                  onClose={() => {
                    setShowRatingModal(false);
                    router.push("/puzzles");
                  }}
                  onSubmit={() => {
                    router.push("/puzzles");
                  }}
                  initialAwardedPoints={justAwardedPoints}
                  completionSeconds={sudokuCompletionSeconds}
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

            {(() => {
              if (puzzle?.puzzleType === 'jigsaw') {
                return (
                  <div className="mb-8">
                    {jigsawPlayable && (
                      <div className="mb-4 flex flex-col items-stretch gap-3">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                          <button
                            onClick={() => jigsawControls?.enterFullscreen?.()}
                            className="w-full sm:w-auto px-3 py-2 rounded bg-gray-800 text-white border border-gray-600 hover:opacity-90"
                          >
                            Fullscreen
                          </button>
                          <button
                            onClick={() => jigsawControls?.sendLooseToTray?.()}
                            className="w-full sm:w-auto px-3 py-2 rounded bg-yellow-400 text-black border border-yellow-500 hover:opacity-90"
                          >
                            Send loose to tray
                          </button>
                          <button
                            onClick={() => jigsawControls?.reset?.()}
                            className="w-full sm:w-auto px-3 py-2 rounded bg-red-600 text-white border border-red-700 hover:opacity-90"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    )}
                    {!jigsawPlayable ? (
                      <div className="p-4 rounded-lg border text-white" style={{ backgroundColor: "rgba(171, 159, 157, 0.2)", borderColor: "#AB9F9D" }}>
                        This jigsaw puzzle is missing its image. Upload an image in the admin puzzle creator.
                      </div>
                    ) : (
                      <div
                        className="rounded-none overflow-hidden border border-gray-700 bg-gray-900 w-screen relative left-1/2 -translate-x-1/2 sm:w-full sm:static sm:translate-x-0"
                        style={{ margin: "0 auto" }}
                      >
                        <JigsawPuzzle
                          imageUrl={jigsawPlayable.imageUrl}
                          rows={jigsawPlayable.data.gridRows}
                          cols={jigsawPlayable.data.gridCols}
                          onControlsReady={(api) => setJigsawControls(api)}
                          suppressInternalCongrats={true}
                          onComplete={async (timeSpentSeconds?: number) => {
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
                                return pointsAwarded;
                              }
                            } catch (err) {
                              console.error('Failed to log jigsaw success:', err);
                            }
                            setSuccess(true);
                            return 0;
                          }}
                          onShowRatingModal={() => setShowRatingModal(true)}
                        />
                      </div>
                    )}
                  </div>
                );
              }

              if (puzzle?.puzzleType === 'escape_room') {
                return (
                  <div className="mb-8">
                    {progress?.solved && (
                      <div className="mb-6 p-4 rounded-lg border text-white" style={{ backgroundColor: "rgba(76, 91, 92, 0.3)", borderColor: "#3891A6" }}>
                        ✓ You have already solved this puzzle! Visit the puzzles page to try another one.
                      </div>
                    )}
                    <div className="mb-4">
                      {!teamIdParam ? (
                        <div className="p-4 rounded-lg border text-white" style={{ backgroundColor: "rgba(171, 159, 157, 0.2)", borderColor: "#AB9F9D" }}>
                          This escape room is team-only. Start it from your team lobby so the URL includes <b>teamId</b>.
                        </div>
                      ) : (
                        <EscapeRoomPuzzle
                          puzzleId={puzzleId}
                          teamId={teamIdParam}
                          onComplete={() => {
                            setSuccess(true);
                            setShowRatingModal(true);
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              }

              if (puzzle?.puzzleType === 'detective_case') {
                return (
                  <div className="mb-8">
                    {progress?.solved && (
                      <div
                        className="mb-6 p-4 rounded-lg border text-white"
                        style={{ backgroundColor: "rgba(76, 91, 92, 0.3)", borderColor: "#3891A6" }}
                      >
                        ✓ You have already solved this case.
                      </div>
                    )}
                    <DetectiveCasePuzzle puzzleId={puzzleId} />
                  </div>
                );
              }

              // Default: render the standard answer form (for text puzzles and Sudoku paths)
              return (
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
                              onClick={() => {
                                setShowSudokuStartModal(false);
                                setSudokuStarted(true);
                                if (!sudokuStartRef.current) {
                                  const now = Date.now();
                                  sudokuStartRef.current = now;
                                  setSudokuElapsed(0);
                                  sudokuTimerRef.current = window.setInterval(() => {
                                    if (!sudokuStartRef.current) return;
                                    const elapsedNow = Math.floor((Date.now() - sudokuStartRef.current) / 1000);
                                    setSudokuElapsed(elapsedNow);
                                    const sudokuLimit = puzzle?.sudoku?.timeLimitSeconds ?? 15 * 60;
                                    const remaining = Math.max(0, sudokuLimit - elapsedNow);
                                    if (remaining <= 0) {
                                      setTimeLimitExceeded(true);
                                      try {
                                        if (typeof window !== 'undefined') {
                                          localStorage.setItem(`sudoku-failed:${puzzleId}`, JSON.stringify({ ts: Date.now(), reason: 'time_limit' }));
                                        }
                                      } catch (e) {}
                                      (async () => {
                                        try {
                                          await fetch(`/api/puzzles/${puzzleId}/progress`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'lock_puzzle', durationSeconds: sudokuLimit }) });
                                        } catch (e) {}
                                        try {
                                          await fetch(`/api/puzzles/${puzzleId}/progress`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'clear_state' }) });
                                        } catch (e) {}
                                        try { if (typeof window !== 'undefined') { localStorage.removeItem(`sudoku-progress:${puzzleId}`); localStorage.removeItem(`sudoku-start:${puzzleId}`); } } catch (e) {}
                                        try { if (sudokuTimerRef.current) { clearInterval(sudokuTimerRef.current as any); sudokuTimerRef.current = null; } sudokuStartRef.current = null; } catch (e) {}
                                        setTimeout(() => router.push('/puzzles'), 3500);
                                      })();
                                    }
                                  }, 1000) as any;
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
                          {/* Compact info bar stacked above the board */}
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
                            {/* small help button */}
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
                              } catch (e) {
                                // ignore storage errors
                              }
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
                            onAttempt={(attemptNumber, locked) => {
                              setSudokuAttemptsUsed(attemptNumber);
                              if (locked) setMaxAttemptsExceeded(true);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* Code Master IDE */}
                  {puzzle?.puzzleType === 'code_master' && (
                    <div className="mb-6 space-y-4">
                      <div
                        className="rounded-lg p-5 border"
                        style={{ backgroundColor: "rgba(56, 145, 166, 0.1)", borderColor: "#3891A6" }}
                      >
                        <h2 className="text-lg font-semibold text-white mb-2">Scenario</h2>
                        <p className="text-sm whitespace-pre-wrap" style={{ color: "#DDDBF1" }}>
                          {String(puzzle?.data?.scenario || '')}
                        </p>
                      </div>

                      <CodeMasterIDE
                        language={String(puzzle?.data?.language || 'html')}
                        brokenCode={String(puzzle?.data?.brokenCode || '')}
                        prefillCss={String(puzzle?.data?.prefillCss || '')}
                        files={puzzle?.data?.files as Record<string, string> | undefined}
                        onCodeChange={(combined) => setAnswer(combined)}
                      />
                    </div>
                  )}

                  {/* Text answer area - only show for non-Sudoku puzzles */}
                  {puzzle?.puzzleType !== 'sudoku' && puzzle?.puzzleType !== 'code_master' && (
                    <>
                      <textarea
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        disabled={submitting || success || progress?.solved}
                        placeholder={progress?.solved ? "This puzzle has been solved." : "Enter your answer here..."}
                        className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-400 focus:outline-none disabled:opacity-50"
                        style={{ backgroundColor: "#2a3a3b", borderWidth: "2px", borderColor: "#FDE74C" }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "#3891A6")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "#FDE74C")}
                        rows={4}
                      />
                      <button
                        type="submit"
                        disabled={submitting || success || !answer.trim() || progress?.solved}
                        className="mt-4 px-6 py-2 rounded-lg text-white font-semibold transition-colors hover:opacity-90 disabled:opacity-50"
                        style={{ backgroundColor: "#AB9F9D" }}
                      >
                        {submitting ? "Submitting..." : progress?.solved ? "Puzzle Solved ✓" : "Submit Answer"}
                      </button>
                    </>
                  )}

                  {puzzle?.puzzleType === 'code_master' && (
                    <button
                      type="submit"
                      disabled={submitting || success || !answer.trim() || progress?.solved}
                      className="mt-4 px-6 py-2 rounded-lg text-white font-semibold transition-colors hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: "#AB9F9D" }}
                    >
                      {submitting ? "Submitting..." : progress?.solved ? "Puzzle Solved ✓" : "Submit Fix"}
                    </button>
                  )}
                </form>
              );
            })()}

            {/* Hints / Progress Section Wrapper */}
            <div
              style={
                puzzle?.puzzleType === 'sudoku'
                  ? undefined
                  : { borderTopColor: "#3891A6", borderTopWidth: "1px", paddingTop: "2rem" }
              }
            >
              {/* Progress Section */}
              {progress && showProgress && progress.partProgress && progress.partProgress.length > 1 && (
                <div className="mb-8 space-y-4">
                  <h2 className="text-xl font-semibold text-white">📊 Your Progress</h2>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Main progress bar */}
                    <div className="lg:col-span-3">
                      <ProgressBar 
                        percentage={progress.completionPercentage} 
                        solved={progress.solved}
                        showPercentage={true}
                        animateOnLoad={true}
                      />
                    </div>

                    {/* Attempt stats */}
                    <div className="lg:col-span-1">
                      <AttemptStats 
                        attempts={progress.attempts}
                        successfulAttempts={progress.successfulAttempts}
                        averageTimePerAttempt={progress.averageTimePerAttempt}
                        totalAttempts={100}
                      />
                    </div>

                    {/* Time tracker */}
                    <div className="lg:col-span-1">
                      <TimeTracker
                        totalTimeSpent={progress.totalTimeSpent}
                        currentSessionStart={progress.currentSessionStart}
                        sessionLogs={progress.sessionLogs}
                        isActive={!progress.solved}
                      />
                    </div>

                    {/* Completion percentage for multi-part */}
                    {progress.partProgress && progress.partProgress.length > 0 && (
                      <div className="lg:col-span-1">
                        <CompletionPercentage
                          parts={progress.partProgress.map((p) => ({
                            id: p.id,
                            title: p.part.title,
                            description: p.part.description,
                            order: p.part.order,
                            pointsValue: p.part.pointsValue,
                            solved: p.solved,
                            solvedAt: p.solvedAt,
                          }))}
                          overallPercentage={progress.completionPercentage}
                          isMultiPart={progress.partProgress.length > 1}
                          puzzleTitle={puzzle?.title}
                        />
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <button
                      onClick={() => setShowProgress(!showProgress)}
                      className="text-sm px-3 py-1 rounded-lg transition-colors hover:opacity-80"
                      style={{
                        backgroundColor: "rgba(171, 159, 157, 0.1)",
                        color: "#AB9F9D",
                      }}
                    >
                      {showProgress ? "Collapse" : "Expand"}
                    </button>
                  </div>
                </div>
              )}

              <div style={{ borderBottomColor: "#3891A6", borderBottomWidth: "1px", paddingBottom: "1.5rem", marginBottom: "1.5rem" }} />

              {puzzle?.puzzleType !== 'sudoku' && (
                <>
                  {/* Hints Section */}
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() => setShowHints(!showHints)}
                      className="font-semibold transition-colors hover:opacity-80"
                      style={{ color: "#FDE74C" }}
                    >
                      {showHints ? "Hide Hints ↑" : "Show Hints ↓"} ({hints.length})
                    </button>
                    {hints.length > 0 && (
                      <button
                        onClick={() => setShowStats(!showStats)}
                        className="text-sm px-3 py-1 rounded-lg transition-colors hover:opacity-80"
                        style={{
                          backgroundColor: showStats
                            ? "rgba(253, 231, 76, 0.2)"
                            : "rgba(171, 159, 157, 0.1)",
                          color: showStats ? "#FDE74C" : "#AB9F9D",
                        }}
                      >
                        {showStats ? "Hide Stats" : "View Stats"}
                      </button>
                    )}
                  </div>

                  {/* Hints Display */}
                  {showHints && (
                    <div className="space-y-4 mb-6">
                      {hints.length === 0 ? (
                        <p style={{ color: "#DDDBF1" }}>No hints available for this puzzle</p>
                      ) : (
                        hints.map((hint, index) => (
                          <HintCard
                            key={hint.id}
                            hint={hint}
                            index={index}
                            isRevealed={revealedHints.has(hint.id)}
                            isLoading={revealingHint === hint.id}
                            onReveal={handleRevealHint}
                            onRateHelpfulness={handleRateHelpfulness}
                          />
                        ))
                      )}
                    </div>
                  )}

                  {/* Stats Display */}
                  {showStats && hints.length > 0 && (
                    <div className="mb-6">
                      <HintStatsOverlay hints={hints} />
                    </div>
                  )}

                  {/* Hint History */}
                  {showHints && hints.length > 0 && (
                    <div>
                      <HintHistoryPanel
                        historyEntries={hints
                          .flatMap((h) => h.userHistory.map((h2) => ({ ...h2, hintId: h.id })))
                          .sort(
                            (a, b) =>
                              new Date(b.revealedAt).getTime() - new Date(a.revealedAt).getTime()
                          )}
                        puzzleId={puzzleId}
                        totalCostSoFar={hints
                          .flatMap((h) => h.userHistory)
                          .reduce((sum, h) => sum + h.pointsCost, 0)}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
