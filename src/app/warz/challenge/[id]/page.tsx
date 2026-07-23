"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { TriangleAlert, RefreshCw } from "lucide-react";
import WarzPlayBoard from "@/components/puzzle/WarzPlayBoard";
import WarzChallengeLoadingState from "@/components/warz/WarzChallengeLoadingState";
import WarzBattleBriefing, { type WarzBattleBriefingChallenge } from "@/components/warz/WarzBattleBriefing";
import WarzBattleEntryTransition from "@/components/warz/WarzBattleEntryTransition";
import { type WarzChallengeStatusKind } from "@/components/warz/WarzChallengeStatus";
import { getPuzzleTypeLabel } from "@/lib/puzzleTypeLabels";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";

interface WarzChallenge {
  id: string;
  status: string;
  challengerWager: number;
  expiresAt: string;
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
  challenger: { id: string; username?: string | null; name?: string | null };
  opponent?: { id: string; username?: string | null; name?: string | null } | null;
  invitedUser?: { id: string; username?: string | null; name?: string | null } | null;
  challengerTime?: number | null; // only visible after COMPLETED
  winner?: { id: string; username?: string | null; name?: string | null } | null;
}

interface CurrentUser {
  id: string;
  username: string;
  totalPoints: number;
}

type Phase = "loading" | "error" | "briefing" | "entering" | "playing" | "result";

function formatTime(sec: number) {
  if (sec >= 999999) return "DNF";
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
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

  // Result state (frozen behavior from prior passes)
  const [result, setResult] = useState<{ won: boolean; myTime: number; challengerTime?: number | null; tie?: boolean } | null>(null);
  const [submittingResult, setSubmittingResult] = useState(false);
  const [warzCopied, setWarzCopied] = useState(false);

  const loadRequestSeqRef = useRef(0);
  const loadAbortRef = useRef<AbortController | null>(null);
  const loadInFlightRef = useRef(false);

  const acceptInFlightRef = useRef(false);
  const acceptRequestSeqRef = useRef(0);
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

      setChallenge(chalData.challenge ?? chalData);
      setCurrentUser({
        id: userData.id,
        username: userData.username ?? userData.name ?? "Player",
        totalPoints: userData.totalPoints ?? 0,
      });
      setPhase("briefing");
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

      setChallenge(acceptedChallenge);
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

  const handlePuzzleDone = useCallback(
    async (secs: number, forfeited?: boolean) => {
      setSubmittingResult(true);
      try {
        const body = forfeited ? { challengeId: id, forfeited: true } : { challengeId: id, completionSeconds: secs };

        const res = await fetch("/api/warz/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          setResult({ won: false, myTime: forfeited ? 999999 : secs });
          return;
        }
        setResult({
          won: data.winnerId === currentUser?.id,
          myTime: forfeited ? 999999 : secs,
          challengerTime: data.challenge?.challengerTime ?? null,
          tie: data.tie ?? false,
        });
      } catch {
        setResult({ won: false, myTime: forfeited ? 999999 : secs });
      } finally {
        setSubmittingResult(false);
      }
    },
    [id, currentUser?.id]
  );

  const shareWarz = useCallback(() => {
    if (!result || !challenge) return;
    const pot = challenge.challengerWager * 2;
    const myFormatted = formatTime(result.myTime);
    const theirFormatted = result.challengerTime != null ? formatTime(result.challengerTime) : "DNF";
    const opponent = challenge.challenger.name ?? challenge.challenger.username;
    const puzzleLabel = getPuzzleTypeLabel(challenge.puzzle.puzzleType);

    let text: string;
    if (result.tie) {
      text = `⚔️ PuzzleWarz WARZ\n\n🤝 Tied with @${opponent} on "${challenge.puzzle.title}" (${puzzleLabel})\n⏱ My time: ${myFormatted}  |  Theirs: ${theirFormatted}\nWagers refunded. Rematch time? 😤\n\nhttps://puzzlewarz.com/warz`;
    } else if (result.won) {
      text = `⚔️ PuzzleWarz WARZ\n\n🏆 Just CRUSHED @${opponent} on "${challenge.puzzle.title}" (${puzzleLabel})!\n⏱ My time: ${myFormatted}  |  Theirs: ${theirFormatted}\n💰 Won ${pot} pts\n\nThink you can do better? 👇\nhttps://puzzlewarz.com/warz`;
    } else {
      text = `⚔️ PuzzleWarz WARZ\n\n💀 @${opponent} beat me on "${challenge.puzzle.title}" (${puzzleLabel})\n⏱ My time: ${myFormatted}  |  Theirs: ${theirFormatted}\nI'll be back. 🔥\nhttps://puzzlewarz.com/warz`;
    }

    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ text }).catch(() => {
        navigator.clipboard.writeText(text).then(() => {
          setWarzCopied(true);
          setTimeout(() => setWarzCopied(false), 2_000);
        });
      });
    } else {
      navigator.clipboard.writeText(text).then(() => {
        setWarzCopied(true);
        setTimeout(() => setWarzCopied(false), 2_000);
      });
    }
  }, [result, challenge]);

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

  // ── Result screen (frozen legacy visual language) ───────────────────────
  if (result) {
    const pot = challenge.challengerWager * 2;
    const isWinner = result.won;
    const isTie = result.tie;

    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#0A0800" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-2xl border-2 p-8 text-center shadow-2xl"
          style={{
            backgroundColor: "rgba(10,8,0,0.99)",
            borderColor: isTie ? "rgba(253,231,76,0.5)" : isWinner ? "#22c55e" : "#ef4444",
          }}
        >
          {isTie ? (
            <>
              <div className="text-5xl mb-3">🤝</div>
              <h2 className="text-3xl font-extrabold text-white mb-2">It&apos;s a Tie!</h2>
              <p className="text-sm mb-6" style={{ color: "#AB9F9D" }}>
                Both players tied — wagers refunded.
              </p>
            </>
          ) : isWinner ? (
            <>
              <div className="text-5xl mb-3">🏆</div>
              <h2 className="text-3xl font-extrabold mb-2" style={{ color: "#4ade80" }}>You Win!</h2>
              <p className="text-sm mb-6" style={{ color: "#AB9F9D" }}>
                You won the pot of{" "}
                <span className="font-bold" style={{ color: "#FFB86B" }}>{pot} pts</span>!
              </p>
            </>
          ) : (
            <>
              <div className="text-5xl mb-3">💀</div>
              <h2 className="text-3xl font-extrabold mb-2" style={{ color: "#f87171" }}>Defeated</h2>
              <p className="text-sm mb-6" style={{ color: "#AB9F9D" }}>
                Your opponent was faster. Your wager goes to them.
              </p>
            </>
          )}

          <div
            className="rounded-xl p-4 mb-6 flex gap-4 justify-center"
            style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <div className="text-center">
              <div className="text-xs mb-1" style={{ color: "#6b7280" }}>Your time</div>
              <div className="text-xl font-black tabular-nums" style={{ color: result.myTime >= 999999 ? "#f87171" : "#e5e7eb" }}>
                {formatTime(result.myTime)}
              </div>
            </div>
            <div className="w-px self-stretch" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
            <div className="text-center">
              <div className="text-xs mb-1" style={{ color: "#6b7280" }}>
                {challenge.challenger.name ?? challenge.challenger.username}&apos;s time
              </div>
              <div className="text-xl font-black tabular-nums" style={{ color: "#e5e7eb" }}>
                {result.challengerTime != null ? formatTime(result.challengerTime) : "—"}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={shareWarz}
              className="w-full py-3 rounded-xl font-extrabold"
              style={{ background: "linear-gradient(135deg, #FDE74C, #FFB86B)", color: "#1a1400" }}
            >
              {warzCopied ? "Copied! ✓" : "Share Result ⚔️"}
            </button>
            <button
              onClick={() => router.push("/warz")}
              className="w-full py-3 rounded-xl font-bold text-sm"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}
            >
              Back to Warz Lobby
            </button>
          </div>
        </motion.div>
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
        {submittingResult && (
          <div className="flex items-center justify-center mb-4 gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-400 animate-bounce" />
            <p className="text-sm font-semibold text-white">Submitting result…</p>
          </div>
        )}
        <WarzPlayBoard
          key={`challenge:${id}`}
          puzzle={challenge.puzzle}
          wager={challenge.challengerWager}
          onDone={handlePuzzleDone}
        />
      </div>
    );
  }

  // ── Entering transition ───────────────────────────────────────────────────
  if (phase === "entering") {
    return (
      <div
        className="min-h-screen px-4 py-8"
        style={{ background: "var(--pw-bg-base)", paddingTop: "calc(56px + env(safe-area-inset-top, 0px))" }}
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
      style={{ background: "var(--pw-bg-base)", paddingTop: "calc(56px + env(safe-area-inset-top, 0px))" }}
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
