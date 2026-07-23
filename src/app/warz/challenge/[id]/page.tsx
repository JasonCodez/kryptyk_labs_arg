"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TriangleAlert, RefreshCw } from "lucide-react";
import WarzPlayBoard from "@/components/puzzle/WarzPlayBoard";
import WarzChallengeLoadingState from "@/components/warz/WarzChallengeLoadingState";
import WarzBattleBriefing, { type WarzBattleBriefingChallenge } from "@/components/warz/WarzBattleBriefing";
import WarzBattleEntryTransition from "@/components/warz/WarzBattleEntryTransition";
import WarzBattleResult from "@/components/warz/WarzBattleResult";
import { type WarzChallengeStatusKind } from "@/components/warz/WarzChallengeStatus";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";

interface WarzChallenge {
  id: string;
  status: string;
  challengerWager: number;
  expiresAt: string;
  challengerTime?: number | null;
  opponentTime?: number | null;
  winnerId?: string | null;
  potPaid?: boolean;
  completedAt?: string | null;
  puzzle: {
    id: string;
    title: string;
    difficulty: string;
    puzzleType: string;
    data?: Record<string, unknown>;
    sudoku?: { puzzleGrid: string; solutionGrid: string };
    jigsaw?: {
      imageUrl: string | null;
      gridRows: number;
      gridCols: number;
      snapTolerance: number;
      rotationEnabled: boolean;
    };
  };
  challenger: {
    id: string;
    username?: string | null;
    name?: string | null;
    image?: string | null;
    level?: number | null;
  };
  opponent?: {
    id: string;
    username?: string | null;
    name?: string | null;
    image?: string | null;
    level?: number | null;
  } | null;
  invitedUser?: { id: string; username?: string | null; name?: string | null } | null;
  winner?: { id: string; username?: string | null; name?: string | null } | null;
}

interface CurrentUser {
  id: string;
  username: string;
  totalPoints: number;
}

type Phase = "loading" | "error" | "briefing" | "entering" | "playing" | "result";

interface WarzTerminalSubmission {
  completionSeconds: number;
  forfeited: boolean;
}

/**
 * Authoritative accept and completion responses may contain partial puzzle
 * metadata. Preserve an already-loaded playable payload when merging them.
 */
function mergeAuthoritativeChallenge(
  currentChallenge: WarzChallenge,
  authoritativeChallenge: WarzChallenge
): WarzChallenge {
  const authoritativePuzzle = authoritativeChallenge.puzzle;

  return {
    ...currentChallenge,
    ...authoritativeChallenge,
    puzzle: {
      ...currentChallenge.puzzle,
      ...(authoritativePuzzle ?? {}),
      data: authoritativePuzzle?.data ?? currentChallenge.puzzle.data,
      sudoku: authoritativePuzzle?.sudoku ?? currentChallenge.puzzle.sudoku,
      jigsaw: authoritativePuzzle?.jigsaw ?? currentChallenge.puzzle.jigsaw,
    },
  };
}

function classifyChallenge(
  challenge: WarzChallenge,
  currentUser: CurrentUser
): WarzChallengeStatusKind {
  if (challenge.status === "COMPLETED") return "completed";
  if (challenge.status === "CANCELLED") return "cancelled";

  const expired = challenge.status === "EXPIRED" || new Date(challenge.expiresAt).getTime() <= Date.now();
  if (expired) return "expired";

  if (challenge.challenger.id === currentUser.id) return "own";

  if (challenge.status === "IN_PROGRESS") {
    if (challenge.opponent?.id === currentUser.id) return "resume";
    return "in-progress-other";
  }

  if (challenge.status === "OPEN") {
    if (challenge.invitedUser && challenge.invitedUser.id !== currentUser.id) return "private";
    if (currentUser.totalPoints < challenge.challengerWager) return "insufficient-balance";
    if (challenge.invitedUser && challenge.invitedUser.id === currentUser.id) return "direct";
    return "open";
  }

  return "cancelled";
}

export default function WarzChallengePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const reduceMotion = useAppReducedMotion();

  const [phase, setPhase] = useState<Phase>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<WarzChallenge | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [entryMode, setEntryMode] = useState<"accepted" | "resume">("accepted");

  const [submittingResult, setSubmittingResult] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [lastTerminalSubmission, setLastTerminalSubmission] = useState<WarzTerminalSubmission | null>(null);

  const loadRequestSeqRef = useRef(0);
  const loadAbortRef = useRef<AbortController | null>(null);
  const loadInFlightRef = useRef(false);

  const acceptInFlightRef = useRef(false);
  const acceptRequestSeqRef = useRef(0);
  const completionInFlightRef = useRef(false);
  const completionRequestSeqRef = useRef(0);
  const mountedRef = useRef(true);

  const entryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startingRef = useRef(false);

  const loadChallenge = useCallback(async () => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    const seq = ++loadRequestSeqRef.current;
    const controller = new AbortController();
    loadAbortRef.current = controller;

    setPhase("loading");
    setLoadError(null);

    try {
      const [chalRes, userRes] = await Promise.all([
        fetch(`/api/warz/${id}`, { signal: controller.signal }),
        fetch("/api/user/info", { signal: controller.signal }),
      ]);

      if (seq !== loadRequestSeqRef.current) return;

      if (chalRes.status === 401 || userRes.status === 401) {
        router.replace("/auth/register?reason=warz");
        return;
      }

      if (chalRes.status === 404) {
        setLoadError("This battle could not be found.");
        setPhase("error");
        return;
      }

      if (!chalRes.ok) {
        setLoadError("We couldn’t load this battle");
        setPhase("error");
        return;
      }
      if (!userRes.ok) {
        setLoadError("We couldn’t load this battle");
        setPhase("error");
        return;
      }

      const chalData = await chalRes.json();
      const userData = await userRes.json();

      if (seq !== loadRequestSeqRef.current) return;

      const loadedChallenge: WarzChallenge = chalData.challenge ?? chalData;
      setChallenge(loadedChallenge);
      setCurrentUser({
        id: userData.id,
        username: userData.username ?? userData.name ?? "Player",
        totalPoints: userData.totalPoints ?? 0,
      });
      setPhase(loadedChallenge.status === "COMPLETED" ? "result" : "briefing");
    } catch (err) {
      if (seq !== loadRequestSeqRef.current) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      setLoadError("We couldn’t load this battle");
      setPhase("error");
    } finally {
      if (seq === loadRequestSeqRef.current) loadInFlightRef.current = false;
    }
  }, [id, router]);

  useEffect(() => {
    loadChallenge();
    return () => {
      loadRequestSeqRef.current += 1;
      loadAbortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      completionRequestSeqRef.current += 1;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (entryTimerRef.current) {
        clearTimeout(entryTimerRef.current);
        entryTimerRef.current = null;
      }
    };
  }, []);

  const enterBattle = useCallback(
    (mode: "accepted" | "resume") => {
      if (startingRef.current) return;
      startingRef.current = true;
      setEntryMode(mode);
      setPhase("entering");
      const delay = reduceMotion ? 0 : 200;
      entryTimerRef.current = setTimeout(() => {
        entryTimerRef.current = null;
        setPhase("playing");
      }, delay);
    },
    [reduceMotion]
  );

  const handleAccept = useCallback(async () => {
    if (acceptInFlightRef.current) return;
    acceptInFlightRef.current = true;
    const seq = ++acceptRequestSeqRef.current;
    setAccepting(true);
    setAcceptError(null);

    try {
      const res = await fetch("/api/warz/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: id }),
      });
      const data = await res.json().catch(() => ({}));

      if (!mountedRef.current || seq !== acceptRequestSeqRef.current) return;

      if (!res.ok) {
        setAcceptError(data.error || "We couldn’t accept this challenge.");
        acceptInFlightRef.current = false;
        setAccepting(false);
        return;
      }

      const acceptedChallenge = data.challenge;
      if (!acceptedChallenge || !acceptedChallenge.id) {
        setAcceptError("We couldn’t accept this challenge.");
        acceptInFlightRef.current = false;
        setAccepting(false);
        return;
      }

      setChallenge((current) =>
        current ? mergeAuthoritativeChallenge(current, acceptedChallenge) : acceptedChallenge
      );
      setAccepting(false);
      enterBattle("accepted");
      // acceptInFlightRef intentionally remains true — a successful
      // acceptance must permanently block another accept request.
    } catch {
      if (!mountedRef.current || seq !== acceptRequestSeqRef.current) return;
      setAcceptError("Network error — please try again.");
      acceptInFlightRef.current = false;
      setAccepting(false);
    }
  }, [id, enterBattle]);

  const handleResume = useCallback(() => {
    enterBattle("resume");
  }, [enterBattle]);

  const submitCompletion = useCallback(
    async (submission: WarzTerminalSubmission) => {
      if (completionInFlightRef.current) return;
      completionInFlightRef.current = true;
      const seq = ++completionRequestSeqRef.current;
      setSubmittingResult(true);
      setCompletionError(null);

      try {
        const body = submission.forfeited
          ? { challengeId: id, forfeited: true }
          : { challengeId: id, completionSeconds: submission.completionSeconds };
        const res = await fetch("/api/warz/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!mountedRef.current || seq !== completionRequestSeqRef.current) return;

        const authoritativeChallenge = data.challenge as WarzChallenge | undefined;
        const validCompletedChallenge =
          res.ok &&
          authoritativeChallenge?.id === id &&
          authoritativeChallenge.status === "COMPLETED";

        if (!validCompletedChallenge) {
          setCompletionError(
            res.ok
              ? "We couldn’t record this battle result."
              : data.error || "We couldn’t record this battle result."
          );
          setPhase("result");
          return;
        }

        setChallenge((current) =>
          current
            ? mergeAuthoritativeChallenge(current, authoritativeChallenge)
            : authoritativeChallenge
        );
        setCompletionError(null);
        setPhase("result");
      } catch {
        if (!mountedRef.current || seq !== completionRequestSeqRef.current) return;
        setCompletionError("Network error — we couldn’t record this battle result.");
        setPhase("result");
      } finally {
        completionInFlightRef.current = false;
        if (mountedRef.current && seq === completionRequestSeqRef.current) {
          setSubmittingResult(false);
        }
      }
    },
    [id]
  );

  const handlePuzzleDone = useCallback(
    (seconds: number, forfeited?: boolean) => {
      const submission: WarzTerminalSubmission = {
        completionSeconds: forfeited ? 0 : seconds,
        forfeited: Boolean(forfeited),
      };
      setLastTerminalSubmission(submission);
      void submitCompletion(submission);
    },
    [submitCompletion]
  );

  const handleRetryCompletion = useCallback(() => {
    if (!lastTerminalSubmission) return;
    void submitCompletion(lastTerminalSubmission);
  }, [lastTerminalSubmission, submitCompletion]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4"
        style={{ background: "var(--pw-bg-base)", paddingTop: "calc(56px + env(safe-area-inset-top, 0px))" }}
      >
        <div role="status" aria-label="Loading battle challenge">
          <span className="sr-only">Loading battle challenge…</span>
          <WarzChallengeLoadingState />
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (phase === "error" || !challenge || !currentUser) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4"
        style={{ background: "var(--pw-bg-base)", paddingTop: "calc(56px + env(safe-area-inset-top, 0px))" }}
      >
        <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl p-8 text-center" style={{ background: "var(--pw-surface-1)" }}>
          <TriangleAlert aria-hidden="true" size={32} style={{ color: "var(--pw-error-text)" }} />
          <h1 className="text-lg font-extrabold" style={{ color: "var(--pw-text-primary)" }}>
            We couldn&rsquo;t load this battle
          </h1>
          <p className="text-sm" style={{ color: "var(--pw-text-secondary)" }}>
            {loadError ?? "Check your connection and try again."}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={loadChallenge}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-4 text-sm font-bold"
              style={{
                minHeight: 44,
                color: "var(--pw-brand-primary)",
                background: "color-mix(in srgb, var(--pw-brand-primary) 15%, transparent)",
                border: "1px solid color-mix(in srgb, var(--pw-brand-primary) 35%, transparent)",
              }}
            >
              <RefreshCw aria-hidden="true" size={15} />
              Try again
            </button>
            <a
              href="/warz"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-4 text-sm font-bold"
              style={{ minHeight: 44, color: "var(--pw-text-muted)", background: "var(--pw-surface-2)" }}
            >
              Back to Warz Arena
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Result ────────────────────────────────────────────────────────────────
  if (phase === "result") {
    const challengeUrl =
      typeof window === "undefined"
        ? `https://puzzlewarz.com/warz/challenge/${id}`
        : `${window.location.origin}/warz/challenge/${id}`;
    return (
      <div
        className="min-h-screen overflow-x-hidden px-3 py-6 sm:px-5"
        style={{
          background: "var(--pw-bg-base)",
          paddingTop: "calc(56px + 20px + env(safe-area-inset-top, 0px))",
          paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <WarzBattleResult
          challenge={challenge}
          currentUserId={currentUser.id}
          challengeUrl={challengeUrl}
          completionError={completionError}
          retryingCompletion={submittingResult}
          onRetryCompletion={lastTerminalSubmission ? handleRetryCompletion : undefined}
          onReturnToWarz={() => router.push("/warz")}
          onBrowsePuzzles={() => router.push("/puzzles")}
        />
      </div>
    );
  }

  // ── Active play ──────────────────────────────────────────────────────────
  if (phase === "playing") {
    return (
      <div
        data-testid="warz-active-play-shell"
        className="min-h-screen px-4 pt-4 min-[1032px]:pt-24 pb-8 max-w-4xl mx-auto"
        style={{ background: "var(--pw-bg-base)" }}
      >
        <WarzPlayBoard
          key={`challenge:${id}`}
          puzzle={challenge.puzzle}
          wager={challenge.challengerWager}
          onDone={handlePuzzleDone}
          submissionPending={submittingResult}
          submissionPendingLabel="Submitting result…"
        />
      </div>
    );
  }

  // ── Entering transition ───────────────────────────────────────────────────
  if (phase === "entering") {
    return (
      <div
        className="min-h-screen px-4 py-8"
        style={{ background: "var(--pw-bg-base)", paddingTop: "calc(56px + 24px + env(safe-area-inset-top, 0px))" }}
      >
        <WarzBattleEntryTransition mode={entryMode} />
      </div>
    );
  }

  // ── Briefing ─────────────────────────────────────────────────────────────
  const statusKind = classifyChallenge(challenge, currentUser);
  const briefingChallenge: WarzBattleBriefingChallenge = {
    puzzle: {
      title: challenge.puzzle.title,
      puzzleType: challenge.puzzle.puzzleType,
      difficulty: challenge.puzzle.difficulty,
    },
    challenger: {
      username: challenge.challenger.username,
      name: challenge.challenger.name,
    },
    invitedUser: challenge.invitedUser
      ? { username: challenge.invitedUser.username, name: challenge.invitedUser.name }
      : null,
    challengerWager: challenge.challengerWager,
    expiresAt: challenge.expiresAt,
  };

  return (
    <div
      className="min-h-screen px-4 py-8"
      style={{ background: "var(--pw-bg-base)", paddingTop: "calc(56px + 24px + env(safe-area-inset-top, 0px))" }}
    >
      <WarzBattleBriefing
        challenge={briefingChallenge}
        currentUser={currentUser}
        statusKind={statusKind}
        accepting={accepting}
        acceptError={acceptError}
        onAccept={handleAccept}
        onResume={handleResume}
      />
    </div>
  );
}
