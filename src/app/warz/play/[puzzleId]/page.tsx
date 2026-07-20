"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import WarzPlayBoard from "@/components/puzzle/WarzPlayBoard";
import { getPuzzleTypeLabel } from "@/lib/puzzleTypeLabels";

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

interface UserSearchResult {
  id: string;
  username: string;
  avatarUrl?: string | null;
}

interface CurrentUser {
  id: string;
  username: string;
  totalPoints: number;
}

const WAGER_MIN = 10;
const WAGER_MAX = 500;
const WAGER_PRESETS = [10, 25, 50, 100, 250, 500];

export default function WarzPlayPage() {
  const { puzzleId } = useParams<{ puzzleId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [puzzle, setPuzzle] = useState<WarzPuzzle | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Wager / invite (set before starting)
  const [wager, setWager] = useState(50);
  const [wagerInput, setWagerInput] = useState("50");
  const [inviteUsername, setInviteUsername] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedInvite, setSelectedInvite] = useState<UserSearchResult | null>(null);
  const [searchingUsers, setSearchingUsers] = useState(false);

  // Play state
  const [playing, setPlaying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [solveTime, setSolveTime] = useState<number | null>(null);

  // Pre-populate invite from ?invite= query param (set when navigating from a player's profile)
  useEffect(() => {
    const inviteId = searchParams.get("invite");
    if (!inviteId || selectedInvite) return;
    (async () => {
      try {
        const res = await fetch(`/api/users/${inviteId}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.id) {
            setSelectedInvite({ id: data.id, username: data.name ?? data.username ?? "Player", avatarUrl: data.image ?? null });
          }
        }
      } catch { /* ignore */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Load puzzle + current user
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [puzzleRes, userRes, eligRes] = await Promise.all([
          fetch(`/api/puzzles/${puzzleId}`),
          fetch("/api/user/info"),
          fetch(`/api/warz/check-eligible?puzzleId=${encodeURIComponent(puzzleId)}`),
        ]);
        if (!puzzleRes.ok) throw new Error("Puzzle not found");
        if (!userRes.ok) { router.replace('/auth/register?reason=warz'); return; }
        const puzzleData = await puzzleRes.json();
        const userData = await userRes.json();
        if (eligRes.ok) {
          const eligData = await eligRes.json();
          if (!eligData.eligible) {
            if (!cancelled) setError(eligData.reason ?? "You are not eligible to challenge on this puzzle.");
            if (!cancelled) setLoading(false);
            return;
          }
        }
        if (!cancelled) {
          setPuzzle(puzzleData);
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
  }, [puzzleId]);

  // Debounced user search
  useEffect(() => {
    if (!inviteUsername.trim() || inviteUsername.trim().length < 2) {
      setUserSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(inviteUsername.trim())}&limit=6`);
        if (res.ok) {
          const data = await res.json();
          setUserSearchResults(
            (data.users ?? []).filter((u: UserSearchResult) => u.id !== currentUser?.id)
          );
        }
      } finally {
        setSearchingUsers(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [inviteUsername, currentUser?.id]);

  const handleWagerChange = (val: string) => {
    setWagerInput(val);
    const n = parseInt(val, 10);
    if (!isNaN(n)) setWager(Math.max(WAGER_MIN, Math.min(WAGER_MAX, n)));
  };

  // Called by WarzPlayBoard when the puzzle is solved or forfeited
  const handlePuzzleDone = useCallback(async (secs: number, forfeited?: boolean) => {
    if (forfeited) {
      router.push("/warz");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/warz/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          puzzleId,
          completionSeconds: secs,
          wager,
          ...(selectedInvite ? { invitedUserId: selectedInvite.id } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Failed to post challenge");
        return;
      }
      setSolveTime(secs);
      setSubmitted(true);
    } catch {
      setSubmitError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }, [puzzleId, wager, selectedInvite, router]);

  // ── Loading / error ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0A0800" }}>
        <div className="text-center">
          <div className="text-4xl mb-4">⚔️</div>
          <p className="text-white text-lg font-semibold">Loading battle…</p>
        </div>
      </div>
    );
  }

  if (error || !puzzle) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0A0800" }}>
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <p className="text-red-400 text-lg font-semibold">{error ?? "Puzzle not found"}</p>
          <button onClick={() => router.push("/warz")} className="mt-4 text-sm underline" style={{ color: "#FDE74C" }}>
            Back to Warz
          </button>
        </div>
      </div>
    );
  }

  // ── Pre-play screen (set wager + invite before starting) ─────────────────
  if (!playing) {
    const balanceOk = !currentUser || currentUser.totalPoints >= wager;
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#0A0800" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-2xl border-2 p-8 shadow-2xl"
          style={{ backgroundColor: "rgba(20,16,0,0.98)", borderColor: "rgba(253,231,76,0.35)" }}
        >
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">⚔️</div>
            <h1 className="text-2xl font-extrabold text-white mb-1">Warz Challenge</h1>
            <p className="text-sm" style={{ color: "#AB9F9D" }}>
              Set your wager, then solve the puzzle as fast as you can.
              The opponent must beat your time to win!
            </p>
          </div>

          {/* Puzzle info */}
          <div
            className="rounded-xl p-4 mb-5 text-left"
            style={{ backgroundColor: "rgba(253,231,76,0.06)", border: "1px solid rgba(253,231,76,0.2)" }}
          >
            <div className="text-white font-bold mb-1">{puzzle.title}</div>
            <div className="flex gap-2">
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{ backgroundColor: "rgba(255,184,107,0.15)", color: "#FFB86B" }}>
                {getPuzzleTypeLabel(puzzle.puzzleType)}
              </span>
            </div>
          </div>

          {/* Wager picker */}
          <div className="mb-5">
            <label className="block text-sm font-semibold mb-2 text-white">
              Your Wager <span style={{ color: "#FFB86B" }}>(10–500 pts)</span>
            </label>
            <div className="flex gap-2 flex-wrap mb-3">
              {WAGER_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => { setWager(p); setWagerInput(String(p)); }}
                  className="px-3 py-1 rounded-lg text-sm font-bold transition-colors"
                  style={{
                    backgroundColor: wager === p ? "rgba(253,231,76,0.25)" : "rgba(255,255,255,0.05)",
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: wager === p ? "#FDE74C" : "rgba(255,255,255,0.1)",
                    color: wager === p ? "#FDE74C" : "#9ca3af",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={WAGER_MIN}
              max={WAGER_MAX}
              value={wagerInput}
              onChange={(e) => handleWagerChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none"
              style={{ backgroundColor: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)" }}
            />
            {currentUser && (
              <p className="text-xs mt-1" style={{ color: balanceOk ? "#6b7280" : "#fca5a5" }}>
                Balance: <span className="font-semibold" style={{ color: "#FFB86B" }}>{currentUser.totalPoints}</span> pts
                {" · "}Pot: <span className="font-semibold" style={{ color: "#4ade80" }}>{wager * 2}</span> pts
                {!balanceOk && <span className="ml-1 font-bold"> — insufficient balance</span>}
              </p>
            )}
          </div>

          {/* Optional invite */}
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2 text-white">
              Invite a specific player{" "}
              <span className="font-normal" style={{ color: "#6b7280" }}>(optional)</span>
            </label>
            {selectedInvite ? (
              <div
                className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ backgroundColor: "rgba(253,231,76,0.1)", border: "1px solid rgba(253,231,76,0.3)" }}
              >
                <span className="text-white font-semibold text-sm">@{selectedInvite.username}</span>
                <button
                  onClick={() => { setSelectedInvite(null); setInviteUsername(""); }}
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ color: "#9ca3af", backgroundColor: "rgba(255,255,255,0.07)" }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by username…"
                  value={inviteUsername}
                  onChange={(e) => setInviteUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none"
                  style={{ backgroundColor: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)" }}
                />
                {userSearchResults.length > 0 && (
                  <div
                    className="absolute left-0 right-0 mt-1 rounded-lg border z-10 overflow-hidden"
                    style={{ backgroundColor: "rgba(20,16,0,0.98)", borderColor: "rgba(255,255,255,0.15)" }}
                  >
                    {userSearchResults.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => { setSelectedInvite(u); setInviteUsername(""); setUserSearchResults([]); }}
                        className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-white/5 transition-colors"
                        style={{ color: "#e5e7eb" }}
                      >
                        @{u.username}
                      </button>
                    ))}
                  </div>
                )}
                {searchingUsers && (
                  <p className="text-xs mt-1" style={{ color: "#6b7280" }}>Searching…</p>
                )}
              </div>
            )}
            <p className="text-xs mt-1.5" style={{ color: "#6b7280" }}>
              Leave blank to open the challenge to anyone.
            </p>
          </div>

          <div
            className="rounded-xl p-3 mb-5 text-sm"
            style={{ backgroundColor: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", color: "#fca5a5" }}
          >
            ⚠️ <strong>No hints, no XP.</strong> Timer starts the moment you press &ldquo;Start Battle&rdquo;.
          </div>

          {submitError && (
            <div className="mb-4 text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: "rgba(220,38,38,0.1)", color: "#fca5a5" }}>
              {submitError}
            </div>
          )}

          {!balanceOk && currentUser && (
            <div className="mb-4 text-sm px-4 py-3 rounded-xl text-center"
              style={{ backgroundColor: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)", color: "#fca5a5" }}>
              ⚠️ You need <span className="font-bold">{wager} pts</span> to create this challenge, but you only have <span className="font-bold">{currentUser.totalPoints} pts</span>.
              {" "}Earn more by solving puzzles or visit the <a href="/store" className="underline font-semibold" style={{ color: "#a78bfa" }}>Point Store</a>.
            </div>
          )}

          <button
            onClick={() => setPlaying(true)}
            disabled={!balanceOk || wager < WAGER_MIN || wager > WAGER_MAX}
            className="w-full py-4 rounded-xl font-extrabold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #FDE74C, #FFB86B)", color: "#1a1400" }}
          >
            ⚔️ Start Battle
          </button>

          <button
            onClick={() => router.push("/warz")}
            className="mt-3 w-full py-2 text-sm font-semibold"
            style={{ color: "#6b7280" }}
          >
            Cancel
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Submitted confirmation ─────────────────────────────────────────────
  if (submitted) {
    const mins = Math.floor((solveTime ?? 0) / 60);
    const secs2 = (solveTime ?? 0) % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs2}s` : `${secs2}s`;
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#0A0800" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-2xl border-2 p-8 shadow-2xl text-center"
          style={{ backgroundColor: "rgba(20,16,0,0.98)", borderColor: "rgba(253,231,76,0.35)" }}
        >
          <div className="text-5xl mb-4">🏆</div>
          <h2 className="text-2xl font-extrabold text-white mb-2">Challenge Posted!</h2>
          <p className="text-sm mb-5" style={{ color: "#AB9F9D" }}>
            Your time: <span className="font-bold text-white">{timeStr}</span> &nbsp;·&nbsp;
            Wager: <span className="font-bold" style={{ color: "#FFB86B" }}>{wager} pts</span>
          </p>

          <div
            className="rounded-xl p-4 mb-6 text-sm text-left"
            style={{ backgroundColor: "rgba(253,231,76,0.07)", border: "1px solid rgba(253,231,76,0.25)" }}
          >
            <p className="font-semibold mb-1" style={{ color: "#FDE74C" }}>What happens next?</p>
            <ul className="space-y-1" style={{ color: "#AB9F9D" }}>
              <li>⚔️ &nbsp;Your challenge is now open for an opponent to accept.</li>
              <li>🕐 &nbsp;If no one accepts within <strong className="text-white">24 hours</strong>, your {wager} pts will be fully refunded.</li>
              <li>📣 &nbsp;You&rsquo;ll be notified when someone accepts and beats (or fails to beat) your time.</li>
            </ul>
          </div>

          <button
            onClick={() => router.push("/warz")}
            className="w-full py-3 rounded-xl font-extrabold text-base transition-all"
            style={{ background: "linear-gradient(135deg, #FDE74C, #FFB86B)", color: "#1a1400" }}
          >
            View My Battles
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Active play ──────────────────────────────────────────────────────────
  return (
    <div
      data-testid="warz-active-play-shell"
      className="min-h-screen px-4 pt-4 min-[1032px]:pt-24 pb-8 max-w-4xl mx-auto"
      style={{ backgroundColor: "#0A0800" }}
    >
      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(10,8,0,0.85)" }}>
          <div className="text-center">
            <div className="text-4xl mb-3 animate-pulse">⚔️</div>
            <p className="text-white font-semibold">Posting your challenge…</p>
          </div>
        </div>
      )}
      <WarzPlayBoard
        key={`play:${puzzleId}`}
        puzzle={puzzle}
        wager={wager}
        onDone={handlePuzzleDone}
        submitError={submitError}
        onRetry={solveTime !== null ? () => handlePuzzleDone(solveTime) : undefined}
      />
    </div>
  );
}
