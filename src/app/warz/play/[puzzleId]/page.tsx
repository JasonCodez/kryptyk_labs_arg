"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { TriangleAlert, RefreshCw, Swords } from "lucide-react";
import WarzPlayBoard from "@/components/puzzle/WarzPlayBoard";
import WarzSetupLoadingState from "@/components/warz/WarzSetupLoadingState";
import WarzChallengeSetup, { type WarzSetupOpponent, type WarzSetupUser } from "@/components/warz/WarzChallengeSetup";
import WarzChallengePosted from "@/components/warz/WarzChallengePosted";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";

const WAGER_MIN = 10;
const WAGER_MAX = 500;
const DEFAULT_WAGER = 50;

type Phase = "loading" | "error" | "setup" | "starting" | "playing" | "posted";

interface WarzPuzzle {
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
}

interface ParsedWager {
  value: number | null;
  error: string | null;
}

function parseWager(input: string, balance: number): ParsedWager {
  const trimmed = input.trim();
  if (trimmed === "") return { value: null, error: "Enter a wager." };
  if (!/^\d+$/.test(trimmed)) return { value: null, error: "Enter a whole-number wager." };
  const n = Number(trimmed);
  if (n < WAGER_MIN) return { value: null, error: `Minimum wager is ${WAGER_MIN} Points.` };
  if (n > WAGER_MAX) return { value: null, error: `Maximum wager is ${WAGER_MAX} Points.` };
  if (n > balance) return { value: null, error: "You don’t have enough Points for this wager." };
  return { value: n, error: null };
}

export default function WarzPlayPage() {
  const { puzzleId } = useParams<{ puzzleId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduceMotion = useAppReducedMotion();

  const [phase, setPhase] = useState<Phase>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [puzzle, setPuzzle] = useState<WarzPuzzle | null>(null);
  const [currentUser, setCurrentUser] = useState<WarzSetupUser | null>(null);

  const [wagerInput, setWagerInput] = useState(String(DEFAULT_WAGER));
  const [selectedOpponent, setSelectedOpponent] = useState<WarzSetupOpponent | null>(null);
  const [resolvingInvite, setResolvingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  // Tracks the invite id that the most recent resolution attempt (success,
  // "unavailable", or self-challenge rejection) settled for, so the
  // query-param effect below never re-fetches the same id on its own.
  const [inviteAttemptedForId, setInviteAttemptedForId] = useState<string | null>(null);
  const [manualOpponentChosen, setManualOpponentChosen] = useState(false);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [solveTime, setSolveTime] = useState<number | null>(null);
  const [posted, setPosted] = useState<{ opponent: WarzSetupOpponent | null; wager: number } | null>(null);

  const loadRequestSeqRef = useRef(0);
  const loadAbortRef = useRef<AbortController | null>(null);
  const loadInFlightRef = useRef(false);

  const inviteRequestSeqRef = useRef(0);
  const inviteAbortRef = useRef<AbortController | null>(null);

  const submissionInFlightRef = useRef(false);
  const startingRef = useRef(false);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSetup = useCallback(async () => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    const seq = ++loadRequestSeqRef.current;
    const controller = new AbortController();
    loadAbortRef.current = controller;

    setPhase("loading");
    setLoadError(null);

    try {
      const [puzzleRes, userRes, eligRes] = await Promise.all([
        fetch(`/api/puzzles/${puzzleId}`, { signal: controller.signal }),
        fetch("/api/user/info", { signal: controller.signal }),
        fetch(`/api/warz/check-eligible?puzzleId=${encodeURIComponent(puzzleId)}`, { signal: controller.signal }),
      ]);

      if (seq !== loadRequestSeqRef.current) return;

      if (userRes.status === 401) {
        router.replace("/auth/register?reason=warz");
        return;
      }

      if (!puzzleRes.ok) {
        setLoadError("This puzzle is not available for Warz.");
        setPhase("error");
        return;
      }
      if (!userRes.ok) {
        setLoadError("We couldn’t prepare this challenge.");
        setPhase("error");
        return;
      }
      if (!eligRes.ok) {
        setLoadError("We couldn’t confirm your eligibility for this puzzle.");
        setPhase("error");
        return;
      }

      const puzzleData = await puzzleRes.json();
      const userData = await userRes.json();
      const eligData = await eligRes.json();

      if (seq !== loadRequestSeqRef.current) return;

      if (!eligData.eligible) {
        setLoadError(eligData.reason ?? "You are not eligible to challenge on this puzzle.");
        setPhase("error");
        return;
      }

      setPuzzle(puzzleData);
      setCurrentUser({
        id: userData.id,
        username: userData.username ?? userData.name ?? "Player",
        totalPoints: userData.totalPoints ?? 0,
      });
      setPhase("setup");
    } catch (err) {
      if (seq !== loadRequestSeqRef.current) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      setLoadError("We couldn’t prepare this challenge.");
      setPhase("error");
    } finally {
      if (seq === loadRequestSeqRef.current) loadInFlightRef.current = false;
    }
  }, [puzzleId, router]);

  useEffect(() => {
    loadSetup();
    return () => {
      loadRequestSeqRef.current += 1;
      loadAbortRef.current?.abort();
    };

  }, []);

  const resolveInvite = useCallback(
    (inviteId: string, currentUserId: string) => {
      inviteAbortRef.current?.abort();
      const seq = ++inviteRequestSeqRef.current;
      const controller = new AbortController();
      inviteAbortRef.current = controller;

      setResolvingInvite(true);
      setInviteError(null);

      fetch(`/api/users/${encodeURIComponent(inviteId)}`, { signal: controller.signal })
        .then(async (res) => {
          if (seq !== inviteRequestSeqRef.current) return;
          if (!res.ok) {
            setInviteError("That player is unavailable.");
            setInviteAttemptedForId(inviteId);
            return;
          }
          const data = await res.json();
          if (seq !== inviteRequestSeqRef.current) return;
          if (!data?.id) {
            setInviteError("That player is unavailable.");
            setInviteAttemptedForId(inviteId);
            return;
          }
          if (data.id === currentUserId) {
            setInviteError("You cannot challenge yourself.");
            setInviteAttemptedForId(inviteId);
            return;
          }
          setSelectedOpponent({
            id: data.id,
            username: data.name ?? data.username ?? "Player",
            avatarUrl: data.image ?? null,
          });
          setInviteAttemptedForId(inviteId);
        })
        .catch((err) => {
          if (seq !== inviteRequestSeqRef.current) return;
          if (err instanceof DOMException && err.name === "AbortError") return;
          setInviteError("That player is unavailable.");
          setInviteAttemptedForId(inviteId);
        })
        .finally(() => {
          if (seq === inviteRequestSeqRef.current) setResolvingInvite(false);
        });
    },
    []
  );

  useEffect(() => {
    const inviteId = searchParams.get("invite");
    if (!inviteId || !currentUser || manualOpponentChosen || inviteAttemptedForId === inviteId) return;
    resolveInvite(inviteId, currentUser.id);

  }, [searchParams, currentUser, manualOpponentChosen, inviteAttemptedForId]);

  useEffect(() => {
    return () => {
      inviteRequestSeqRef.current += 1;
      inviteAbortRef.current?.abort();
    };
  }, []);

  const balance = currentUser?.totalPoints ?? 0;
  const { value: wager, error: wagerError } = useMemo(() => parseWager(wagerInput, balance), [wagerInput, balance]);

  const handlePresetWager = (value: number) => setWagerInput(String(value));

  const handleSelectOpponent = (opponent: WarzSetupOpponent) => {
    inviteRequestSeqRef.current += 1;
    inviteAbortRef.current?.abort();
    setResolvingInvite(false);
    setManualOpponentChosen(true);
    setInviteError(null);
    setSelectedOpponent(opponent);
  };

  const handleRemoveOpponent = () => {
    inviteRequestSeqRef.current += 1;
    inviteAbortRef.current?.abort();
    setResolvingInvite(false);
    setManualOpponentChosen(true);
    setInviteError(null);
    setSelectedOpponent(null);
  };

  const handleRetryInvite = () => {
    const inviteId = searchParams.get("invite");
    if (inviteId && currentUser) resolveInvite(inviteId, currentUser.id);
  };

  const startDisabled =
    !puzzle || !currentUser || wager == null || resolvingInvite || (inviteError != null && !selectedOpponent);

  const handleStart = () => {
    if (startingRef.current || startDisabled) return;
    startingRef.current = true;
    setPhase("starting");
    const delay = reduceMotion ? 0 : 200;
    startTimerRef.current = setTimeout(() => {
      startTimerRef.current = null;
      setPhase("playing");
    }, delay);
  };

  useEffect(() => {
    return () => {
      if (startTimerRef.current) {
        clearTimeout(startTimerRef.current);
        startTimerRef.current = null;
      }
    };
  }, []);

  const handlePuzzleDone = useCallback(
    async (secs: number, forfeited?: boolean) => {
      if (forfeited) {
        router.push("/warz");
        return;
      }
      if (submissionInFlightRef.current) return;
      submissionInFlightRef.current = true;
      setSubmitting(true);
      setSolveTime(secs);
      setSubmitError(null);
      try {
        const res = await fetch("/api/warz/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            puzzleId,
            completionSeconds: secs,
            wager: wager ?? DEFAULT_WAGER,
            ...(selectedOpponent ? { invitedUserId: selectedOpponent.id } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setSubmitError(data.error ?? "Failed to post challenge");
          submissionInFlightRef.current = false;
          setSubmitting(false);
          return;
        }
        setPosted({ opponent: selectedOpponent, wager: wager ?? DEFAULT_WAGER });
        setPhase("posted");
      } catch {
        setSubmitError("Network error — please try again");
        submissionInFlightRef.current = false;
        setSubmitting(false);
      }
    },
    [puzzleId, wager, selectedOpponent, router]
  );

  const handleCancel = () => {
    loadRequestSeqRef.current += 1;
    loadAbortRef.current?.abort();
  };

  if (phase === "loading") {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4"
        style={{ background: "var(--pw-bg-base)", paddingTop: "calc(56px + env(safe-area-inset-top, 0px))" }}
      >
        <div role="status" aria-label="Loading challenge setup">
          <span className="sr-only">Loading challenge setup…</span>
          <WarzSetupLoadingState />
        </div>
      </div>
    );
  }

  if (phase === "error" || (!puzzle || !currentUser)) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4"
        style={{ background: "var(--pw-bg-base)", paddingTop: "calc(56px + env(safe-area-inset-top, 0px))" }}
      >
        <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl p-8 text-center" style={{ background: "var(--pw-surface-1)" }}>
          <TriangleAlert aria-hidden="true" size={32} style={{ color: "var(--pw-error-text)" }} />
          <h1 className="text-lg font-extrabold" style={{ color: "var(--pw-text-primary)" }}>
            We couldn&rsquo;t prepare this challenge
          </h1>
          <p className="text-sm" style={{ color: "var(--pw-text-secondary)" }}>
            {loadError ?? "Check your connection and try again."}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={loadSetup}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-4 text-sm font-bold"
              style={{
                color: "var(--pw-brand-primary)",
                background: "color-mix(in srgb, var(--pw-brand-primary) 15%, transparent)",
                border: "1px solid color-mix(in srgb, var(--pw-brand-primary) 35%, transparent)",
              }}
            >
              <RefreshCw aria-hidden="true" size={15} />
              Try again
            </button>
            <Link
              href="/warz"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-4 text-sm font-bold"
              style={{ color: "var(--pw-text-muted)", background: "var(--pw-surface-2)" }}
            >
              Back to Warz Arena
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "setup" || phase === "starting") {
    return (
      <div
        className="min-h-screen px-4 py-8"
        style={{ background: "var(--pw-bg-base)", paddingTop: "calc(56px + env(safe-area-inset-top, 0px))" }}
      >
        <AnimatePresence mode="wait">
          {phase === "setup" ? (
            <motion.div
              key="setup"
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.99 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
            >
              <WarzChallengeSetup
                puzzle={puzzle}
                currentUser={currentUser}
                wagerInput={wagerInput}
                wager={wager}
                wagerError={wagerError}
                selectedOpponent={selectedOpponent}
                resolvingInvite={resolvingInvite}
                inviteError={inviteError}
                onPresetWager={handlePresetWager}
                onWagerInputChange={setWagerInput}
                onSelectOpponent={handleSelectOpponent}
                onRemoveOpponent={handleRemoveOpponent}
                onRetryInvite={handleRetryInvite}
                onStart={handleStart}
                onCancel={handleCancel}
                startDisabled={startDisabled}
              />
            </motion.div>
          ) : (
            <motion.div
              key="starting"
              initial={reduceMotion ? undefined : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduceMotion ? 0 : 0.15 }}
              className="flex flex-col items-center justify-center gap-3 py-24 text-center"
            >
              <Swords aria-hidden="true" size={32} style={{ color: "var(--pw-brand-secondary)" }} />
              <p className="text-sm font-extrabold uppercase tracking-widest" style={{ color: "var(--pw-brand-secondary)" }}>
                Battle Ready
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (phase === "posted" && posted) {
    return (
      <div
        className="min-h-screen px-4 py-8"
        style={{ background: "var(--pw-bg-base)", paddingTop: "calc(56px + env(safe-area-inset-top, 0px))" }}
      >
        <WarzChallengePosted
          puzzleTitle={puzzle.title}
          solveTimeSeconds={solveTime ?? 0}
          wager={posted.wager}
          opponent={posted.opponent}
        />
      </div>
    );
  }

  return (
    <div
      data-testid="warz-active-play-shell"
      className="min-h-screen px-4 pt-4 min-[1032px]:pt-24 pb-8 max-w-4xl mx-auto"
      style={{ background: "var(--pw-bg-base)" }}
    >
      <WarzPlayBoard
        key={`play:${puzzleId}`}
        puzzle={puzzle}
        wager={wager ?? DEFAULT_WAGER}
        onDone={handlePuzzleDone}
        submitError={submitError}
        onRetry={solveTime !== null ? () => handlePuzzleDone(solveTime) : undefined}
        submissionPending={submitting && !submitError}
        submissionPendingLabel="Posting your challenge…"
      />
    </div>
  );
}
