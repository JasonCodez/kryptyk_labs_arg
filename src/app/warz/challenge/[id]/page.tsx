"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import WarzPlayBoard from "@/components/puzzle/WarzPlayBoard";
import { getPuzzleTypeLabel } from "@/lib/puzzleTypeLabels";

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
  challenger: { id: string; username: string; name?: string | null };
  opponent?: { id: string; username: string; name?: string | null } | null;
  challengerTime?: number | null; // only visible after COMPLETED
  winner?: { id: string; username: string } | null;
}

interface CurrentUser {
  id: string;
  username: string;
  totalPoints: number;
}

function formatTime(sec: number) {
  if (sec >= 999999) return "DNF";
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function WarzChallengePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [challenge, setChallenge] = useState<WarzChallenge | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [playing, setPlaying] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  // Result state
  const [result, setResult] = useState<{ won: boolean; myTime: number; challengerTime?: number | null; tie?: boolean } | null>(null);
  const [submittingResult, setSubmittingResult] = useState(false);
  const [warzCopied, setWarzCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [chalRes, userRes] = await Promise.all([
          fetch(`/api/warz/${id}`),
          fetch("/api/user/info"),
        ]);
        if (!chalRes.ok) throw new Error("Challenge not found");
        if (!userRes.ok) { router.replace('/auth/register?reason=warz'); return; }
        const chalData = await chalRes.json();
        const userData = await userRes.json();
        if (!cancelled) {
          setChallenge(chalData.challenge ?? chalData);
          setCurrentUser(userData);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  const handleAcceptAndStart = async () => {
    setAccepting(true);
    setAcceptError(null);
    try {
      const res = await fetch("/api/warz/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAcceptError(data.error ?? "Failed to accept challenge");
        return;
      }
      setPlaying(true);
    } catch {
      setAcceptError("Network error — please try again");
    } finally {
      setAccepting(false);
    }
  };

  const handlePuzzleDone = useCallback(async (secs: number, forfeited?: boolean) => {
    setSubmittingResult(true);
    try {
      const body = forfeited
        ? { challengeId: id, forfeited: true }
        : { challengeId: id, completionSeconds: secs };

      const res = await fetch("/api/warz/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        // Still show result with forfeit
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
  }, [id, currentUser?.id]);

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

  // ── Loading / error ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0A0800" }}>
        <div className="text-center">
          <div className="text-4xl mb-4">⚔️</div>
          <p className="text-white text-lg font-semibold">Loading challenge…</p>
        </div>
      </div>
    );
  }

  if (error || !challenge) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0A0800" }}>
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <p className="text-red-400 text-lg font-semibold">{error ?? "Challenge not found"}</p>
          <button onClick={() => router.push("/warz")} className="mt-4 text-sm underline" style={{ color: "#FDE74C" }}>
            Back to Warz
          </button>
        </div>
      </div>
    );
  }

  // ── Result screen ────────────────────────────────────────────────────────
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

          {/* Time comparison */}
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
  if (playing) {
    return (
      <div
        data-testid="warz-active-play-shell"
        className="min-h-screen px-4 pt-4 min-[1032px]:pt-24 pb-8 max-w-4xl mx-auto"
        style={{ backgroundColor: "#0A0800" }}
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

  // ── Accept / pre-play screen ─────────────────────────────────────────────
  const isOwnChallenge = currentUser?.id === challenge.challenger.id;
  const isExpired = challenge.status === "EXPIRED";
  const isCompleted = challenge.status === "COMPLETED";
  const isInProgress = challenge.status === "IN_PROGRESS";
  const alreadyAccepted = challenge.opponent?.id === currentUser?.id;

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#0A0800" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-2xl border-2 p-8 text-center shadow-2xl"
        style={{ backgroundColor: "rgba(20,16,0,0.98)", borderColor: "rgba(253,231,76,0.35)" }}
      >
        <div className="text-5xl mb-4">⚔️</div>
        <h1 className="text-2xl font-extrabold text-white mb-1">Battle Challenge</h1>
        <p className="text-sm mb-6" style={{ color: "#AB9F9D" }}>
          <span className="font-semibold" style={{ color: "#FDE74C" }}>{challenge.challenger.name ?? challenge.challenger.username}</span>{" "}
          is challenging you to a duel!
        </p>

        {/* Puzzle info */}
        <div
          className="rounded-xl p-4 mb-5 text-left"
          style={{ backgroundColor: "rgba(253,231,76,0.06)", border: "1px solid rgba(253,231,76,0.2)" }}
        >
          <div className="text-white font-bold mb-1">{challenge.puzzle.title}</div>
          <div className="flex gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ backgroundColor: "rgba(255,184,107,0.15)", color: "#FFB86B" }}>
              {getPuzzleTypeLabel(challenge.puzzle.puzzleType)}
            </span>
          </div>
        </div>

        {/* Wager info */}
        <div
          className="rounded-xl p-4 mb-6 text-center"
          style={{ backgroundColor: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.25)" }}
        >
          <div className="text-xs mb-1" style={{ color: "#6b7280" }}>Wager (each player)</div>
          <div className="text-3xl font-extrabold" style={{ color: "#FFB86B" }}>
            🪙 {challenge.challengerWager} pts
          </div>
          <div className="text-xs mt-1" style={{ color: "#6b7280" }}>
            Winner takes: <span className="font-bold" style={{ color: "#4ade80" }}>{challenge.challengerWager * 2} pts</span>
          </div>
          {currentUser && (
            <div className="text-xs mt-1" style={{ color: "#6b7280" }}>
              Your balance: <span className="font-semibold" style={{ color: "#FFB86B" }}>{currentUser.totalPoints}</span> pts
            </div>
          )}
        </div>

        {/* Status-based actions */}
        {isOwnChallenge && (
          <div className="text-sm rounded-xl p-4 mb-4" style={{ backgroundColor: "rgba(255,255,255,0.04)", color: "#9ca3af" }}>
            This is your own challenge. Share the link to let someone accept it.
          </div>
        )}

        {isExpired && (
          <div className="text-sm rounded-xl p-4 mb-4" style={{ backgroundColor: "rgba(220,38,38,0.08)", color: "#fca5a5" }}>
            This challenge has expired.
          </div>
        )}

        {isCompleted && (
          <div className="text-sm rounded-xl p-4 mb-4" style={{ backgroundColor: "rgba(74,222,128,0.08)", color: "#4ade80" }}>
            This battle has already been completed.
          </div>
        )}

        {isInProgress && !alreadyAccepted && !isOwnChallenge && (
          <div className="text-sm rounded-xl p-4 mb-4" style={{ backgroundColor: "rgba(59,130,246,0.08)", color: "#93c5fd" }}>
            This challenge is already in progress.
          </div>
        )}

        {acceptError && (
          <div className="text-sm px-3 py-2 rounded-lg mb-4" style={{ backgroundColor: "rgba(220,38,38,0.1)", color: "#fca5a5" }}>
            {acceptError}
          </div>
        )}

        {/* Accept button — only show if OPEN, not own, not expired */}
        {challenge.status === "OPEN" && !isOwnChallenge && !isExpired && (
          <>
            {currentUser && currentUser.totalPoints < challenge.challengerWager && (
              <div className="text-sm px-4 py-3 rounded-xl mb-4 text-center"
                style={{ backgroundColor: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)", color: "#fca5a5" }}>
                ⚠️ You need <span className="font-bold">{challenge.challengerWager} pts</span> to accept this challenge, but you only have <span className="font-bold">{currentUser.totalPoints} pts</span>.
                {" "}Head to the <a href="/store" className="underline font-semibold" style={{ color: "#a78bfa" }}>Point Store</a> or earn more points by solving puzzles.
              </div>
            )}
            <button
              onClick={handleAcceptAndStart}
              disabled={accepting || (currentUser?.totalPoints ?? 0) < challenge.challengerWager}
              className="w-full py-4 rounded-xl font-extrabold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-3"
              style={{ background: "linear-gradient(135deg, #FDE74C, #FFB86B)", color: "#1a1400" }}
            >
              {accepting ? "Accepting…" : `⚔️ Accept & Battle (${challenge.challengerWager} pts)`}
            </button>
          </>
        )}

        {/* Resume — if already accepted but not yet played */}
        {isInProgress && alreadyAccepted && (
          <button
            onClick={() => setPlaying(true)}
            className="w-full py-4 rounded-xl font-extrabold text-lg mb-3"
            style={{ background: "linear-gradient(135deg, #FDE74C, #FFB86B)", color: "#1a1400" }}
          >
            ⚔️ Play Battle
          </button>
        )}

        <button
          onClick={() => router.push("/warz")}
          className="w-full py-2 text-sm font-semibold"
          style={{ color: "#6b7280" }}
        >
          Back to Warz Lobby
        </button>
      </motion.div>
    </div>
  );
}
