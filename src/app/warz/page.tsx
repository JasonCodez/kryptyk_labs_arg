"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { getPuzzleTypeLabel } from "@/lib/puzzleTypeLabels";
import LoadingSpinner from "@/components/LoadingSpinner";

// ── Types ────────────────────────────────────────────────────────────────────
interface EligiblePuzzle {
  id: string;
  title: string;
  difficulty: string;
  puzzleType: string;
  category?: { name: string } | null;
}

interface WarzChallenge {
  id: string;
  status: string;
  challengerWager: number;
  createdAt: string;
  expiresAt: string;
  spotlightUntil?: string | null;
  puzzle: { id: string; title: string; difficulty: string; puzzleType: string };
  challenger: { id: string; name: string | null; image: string | null; level: number | null };
  opponent?: { id: string; name: string | null; image?: string | null } | null;
  invitedUser?: { id: string; name: string | null } | null;
  winner?: { id: string; name: string | null } | null;
}

interface CurrentUser {
  id: string;
  username: string | null;
  totalPoints: number;
  level: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  OPEN: { bg: "rgba(255,201,74,0.1)", border: "rgba(255,201,74,0.4)", text: "#FFC94A", label: "Open" },
  IN_PROGRESS: { bg: "rgba(61,127,255,0.1)", border: "rgba(61,127,255,0.4)", text: "#3D7FFF", label: "In Progress" },
  COMPLETED: { bg: "rgba(46,217,145,0.1)", border: "rgba(46,217,145,0.4)", text: "#2ED991", label: "Completed" },
  EXPIRED: { bg: "rgba(98,93,118,0.1)", border: "rgba(98,93,118,0.3)", text: "#8891AC", label: "Expired" },
  CANCELLED: { bg: "rgba(98,93,118,0.1)", border: "rgba(98,93,118,0.3)", text: "#8891AC", label: "Cancelled" },
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "#2ED991",
  medium: "#FFC94A",
  hard: "#f97316",
  expert: "#FF3B5C",
};



function timeLeft(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "expired";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── Puzzle Picker Modal ───────────────────────────────────────────────────────
function PuzzlePickerModal({
  puzzles,
  loading,
  onSelect,
  onClose,
}: {
  puzzles: EligiblePuzzle[];
  loading: boolean;
  onSelect: (puzzle: EligiblePuzzle) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filtered = puzzles.filter((p) => {
    const matchType = typeFilter === "all" || p.puzzleType === typeFilter;
    const matchName = !filter || p.title.toLowerCase().includes(filter.toLowerCase());
    return matchType && matchName;
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm px-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-lg rounded-2xl border-2 shadow-2xl flex flex-col"
        style={{
          background: "linear-gradient(160deg, rgba(19,24,41,0.99), rgba(11,14,26,0.99))",
          borderColor: "rgba(255,201,74,0.35)",
          maxHeight: "80vh",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div>
            <h2 className="text-xl font-extrabold text-white">Choose Your Puzzle</h2>
            <p className="text-xs mt-0.5" style={{ color: "#8891AC" }}>
              Only puzzles you&apos;ve never attempted are shown.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b flex flex-col gap-2" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <input
            type="text"
            placeholder="Search puzzles…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none"
            style={{ backgroundColor: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
          />
          <div className="flex gap-2 flex-wrap">
            {["all", "sudoku", "word_crack", "word_search", "jigsaw"].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className="px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors"
                style={{
                  backgroundColor: typeFilter === t ? "rgba(255,201,74,0.2)" : "rgba(255,255,255,0.05)",
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: typeFilter === t ? "#FFC94A" : "rgba(255,255,255,0.1)",
                  color: typeFilter === t ? "#FFC94A" : "#8891AC",
                }}
              >
                {t === "all" ? "All" : getPuzzleTypeLabel(t)}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <img src="/images/puzzle_warz_logo.png" alt="Loading…" width={40} height={40} style={{ animation: "pw-logo-spin 1.4s ease-in-out infinite", objectFit: "contain" }} />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm py-8" style={{ color: "#8891AC" }}>
              {puzzles.length === 0
                ? "You've already attempted all available puzzles."
                : "No puzzles match your filter."}
            </p>
          ) : (
            filtered.map((puzzle) => (
              <button
                key={puzzle.id}
                onClick={() => onSelect(puzzle)}
                className="pw-bevel w-full text-left px-4 py-3 border transition-all hover:scale-[1.01]"
                style={{
                  background: "linear-gradient(160deg, var(--pw-surface-hi), var(--pw-surface) 70%)",
                  borderColor: "rgba(255,201,74,0.25)",
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-white font-semibold text-sm">{puzzle.title}</span>
                  <div className="flex gap-1.5 shrink-0 ml-2">
                    <span
                      className="px-1.5 py-0.5 rounded text-xs font-bold leading-none"
                      style={{ color: "#B24BF3", backgroundColor: "rgba(178,75,243,0.1)" }}
                    >
                      {getPuzzleTypeLabel(puzzle.puzzleType)}
                    </span>
                  </div>
                </div>
                {puzzle.category?.name && (
                  <span className="text-xs mt-0.5" style={{ color: "#8891AC" }}>{puzzle.category.name}</span>
                )}
              </button>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Challenge card ────────────────────────────────────────────────────────────
function ChallengeCard({
  challenge,
  currentUserId,
}: {
  challenge: WarzChallenge;
  currentUserId: string;
}) {
  const router = useRouter();
  const sc = STATUS_COLORS[challenge.status] ?? STATUS_COLORS.EXPIRED;
  const isChallenger = challenge.challenger.id === currentUserId;
  const isOpponent = challenge.opponent?.id === currentUserId;
  const isInvited = challenge.invitedUser?.id === currentUserId;
  const pot = challenge.challengerWager * 2;

  const handleAction = () => {
    if (challenge.status === "IN_PROGRESS" && isOpponent) {
      // Resume opponent play
      router.push(`/warz/challenge/${challenge.id}`);
    } else if (challenge.status === "OPEN" && !isChallenger) {
      // Accept
      router.push(`/warz/challenge/${challenge.id}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="pw-bevel border p-4 transition-all"
      style={{
        background: "linear-gradient(160deg, var(--pw-surface-hi), var(--pw-surface) 70%)",
        borderColor: challenge.spotlightUntil && new Date(challenge.spotlightUntil) > new Date() ? "rgba(255,201,74,0.5)" : "rgba(255,255,255,0.08)",
        boxShadow: challenge.spotlightUntil && new Date(challenge.spotlightUntil) > new Date() ? "0 0 20px -8px rgba(255,201,74,0.5)" : undefined,
      }}
    >
      {/* Spotlight badge */}
      {challenge.spotlightUntil && new Date(challenge.spotlightUntil) > new Date() && (
        <div className="flex items-center gap-1 mb-2 text-xs font-bold" style={{ color: '#FFC94A' }}>
          ✨ Spotlighted
        </div>
      )}
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-bold text-sm truncate">{challenge.puzzle.title}</span>
            <span className="px-1.5 py-0.5 rounded text-xs font-bold" style={{ color: "#B24BF3", backgroundColor: "rgba(178,75,243,0.1)" }}>
              {getPuzzleTypeLabel(challenge.puzzle.puzzleType)}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs" style={{ color: "#8891AC" }}>
              by <span className="font-medium" style={{ color: "#8891AC" }}>@{challenge.challenger.name ?? "Unknown"}</span>
            </span>
            {challenge.invitedUser && (
              <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(61,127,255,0.1)", color: "#3D7FFF" }}>
                → @{challenge.invitedUser.name}
              </span>
            )}
            {challenge.status === "OPEN" && (
              <span className="text-xs" style={{ color: "#8891AC" }}>
                expires in {timeLeft(challenge.expiresAt)}
              </span>
            )}
          </div>
        </div>

        <div
          className="text-xs px-2 py-1 rounded-full font-bold shrink-0"
          style={{ backgroundColor: sc.bg, borderWidth: 1, borderStyle: "solid", borderColor: sc.border, color: sc.text }}
        >
          {sc.label}
        </div>
      </div>

      {/* Wager + action */}
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <span className="font-bold" style={{ color: "#FFC94A" }}>🪙 {challenge.challengerWager}</span>
          <span className="text-xs ml-1" style={{ color: "#8891AC" }}>
            pts each · pot <span className="font-semibold" style={{ color: "#2ED991" }}>{pot}</span> pts
          </span>
        </div>

        <div className="flex gap-2">
          {/* Challenger can cancel OPEN challenges */}
          {challenge.status === "OPEN" && isChallenger && (
            <CancelButton challengeId={challenge.id} />
          )}

          {/* Opponent actions */}
          {challenge.status === "OPEN" && !isChallenger && (
            (!challenge.invitedUser || isInvited) && (
              <button
                onClick={handleAction}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{ background: "linear-gradient(135deg, #FFC94A, #AD8932)", color: "#0B0E1A" }}
              >
                ⚔️ Accept
              </button>
            )
          )}

          {challenge.status === "IN_PROGRESS" && isOpponent && (
            <button
              onClick={handleAction}
              className="px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ backgroundColor: "rgba(61,127,255,0.2)", border: "1px solid rgba(61,127,255,0.4)", color: "#3D7FFF" }}
            >
              ▶ Play
            </button>
          )}

          {challenge.status === "COMPLETED" && (
            <Link
              href={`/warz/challenge/${challenge.id}`}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "#8891AC" }}
            >
              View Result
            </Link>
          )}

          {/* Challenger view challenge */}
          {isChallenger && challenge.status !== "OPEN" && (
            <Link
              href={`/warz/challenge/${challenge.id}`}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "#8891AC" }}
            >
              View
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function CancelButton({ challengeId }: { challengeId: string }) {
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await fetch("/api/warz/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId }),
      });
      if (res.ok) setCancelled(true);
    } finally {
      setCancelling(false);
    }
  };

  if (cancelled) {
    return <span className="text-xs" style={{ color: "#8891AC" }}>Cancelled</span>;
  }

  return (
    <button
      onClick={handleCancel}
      disabled={cancelling}
      className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
      style={{ backgroundColor: "rgba(255,59,92,0.12)", border: "1px solid rgba(255,59,92,0.3)", color: "#FF3B5C" }}
    >
      {cancelling ? "…" : "Cancel"}
    </button>
  );
}

// ── Main Lobby ────────────────────────────────────────────────────────────────
type TabKey = "open" | "mine" | "history";

function WarzLobbyInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [challenges, setChallenges] = useState<WarzChallenge[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<TabKey>("open");
  const [showPicker, setShowPicker] = useState(false);
  const [eligiblePuzzles, setEligiblePuzzles] = useState<EligiblePuzzle[]>([]);
  const [loadingPuzzles, setLoadingPuzzles] = useState(false);

  const [successToast, setSuccessToast] = useState(searchParams.get("created") === "1");

  // Fetch lobby + user
  const fetchLobby = useCallback(async () => {
    try {
      const [chalRes, userRes] = await Promise.all([
        fetch("/api/warz?status=ALL&limit=50"),
        fetch("/api/user/info"),
      ]);
      if (chalRes.ok) {
        const data = await chalRes.json();
        setChallenges(data.challenges ?? []);
      }
      if (userRes.ok) {
        const u = await userRes.json();
        setCurrentUser({ id: u.id, username: u.username, totalPoints: u.totalPoints ?? 0, level: u.level ?? 1 });
      } else if (userRes.status === 401) {
        router.replace("/auth/register?reason=warz");
        return;
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchLobby();
    const interval = setInterval(fetchLobby, 30000);
    return () => clearInterval(interval);
  }, [fetchLobby]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!successToast) return;
    const t = setTimeout(() => setSuccessToast(false), 4000);
    return () => clearTimeout(t);
  }, [successToast]);

  const handleOpenPicker = async () => {
    setShowPicker(true);
    setLoadingPuzzles(true);
    try {
      const res = await fetch("/api/warz/eligible-puzzles");
      if (res.ok) {
        const data = await res.json();
        setEligiblePuzzles(data.puzzles ?? []);
      }
    } finally {
      setLoadingPuzzles(false);
    }
  };

  const handleSelectPuzzle = (puzzle: EligiblePuzzle) => {
    setShowPicker(false);
    const inviteParam = searchParams.get("invite");
    const suffix = inviteParam ? `?invite=${encodeURIComponent(inviteParam)}` : "";
    router.push(`/warz/play/${puzzle.id}${suffix}`);
  };

  // Filter challenges by tab
  const now = new Date();
  const featuredChallenges = challenges
    .filter((c) => c.status === "OPEN" && c.spotlightUntil && new Date(c.spotlightUntil) > now)
    .sort((a, b) => new Date(b.spotlightUntil!).getTime() - new Date(a.spotlightUntil!).getTime());
  const featuredIds = new Set(featuredChallenges.map((c) => c.id));

  const openChallenges = challenges.filter((c) => c.status === "OPEN" && !featuredIds.has(c.id));
  const myChallenges = currentUser
    ? challenges.filter((c) =>
        c.challenger.id === currentUser.id || c.opponent?.id === currentUser.id
      )
    : [];
  const historyChallenges = challenges.filter(
    (c) => c.status === "COMPLETED" || c.status === "EXPIRED" || c.status === "CANCELLED"
  );

  const displayChallenges: WarzChallenge[] =
    tab === "open" ? openChallenges : tab === "mine" ? myChallenges : historyChallenges;

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(1300px 800px at 15% -10%, rgba(178,75,243,0.2), transparent 62%), radial-gradient(1100px 700px at 90% 0%, rgba(255,201,74,0.12), transparent 58%), radial-gradient(1000px 650px at 50% 100%, rgba(46,217,145,0.09), transparent 60%), #10121F",
      }}
    >
      {/* ── Hero header ── */}
      <div
        className="relative px-6 pt-28 pb-12 text-center overflow-hidden"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(255,201,74,0.14) 0%, transparent 70%), radial-gradient(ellipse at 15% 30%, rgba(178,75,243,0.1) 0%, transparent 60%)" }}
      >
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl min-[450px]:text-5xl font-black mb-3 whitespace-nowrap"
          style={{ color: "#FFC94A", textShadow: "0 0 40px rgba(255,201,74,0.35)" }}
        >
          ⚔️ Puzzle Warz
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.15 } }}
          className="text-lg mb-8 max-w-lg mx-auto"
          style={{ color: "#8891AC" }}
        >
          Pick your puzzle, set your wager, solve the puzzle, post your challenge. Fastest time wins the pot!
        </motion.p>

        {/* User balance */}
        {currentUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.25 } }}
            className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full border mb-8"
            style={{ backgroundColor: "rgba(255,201,74,0.1)", borderColor: "rgba(255,201,74,0.3)", boxShadow: "0 0 16px -6px rgba(255,201,74,0.6)" }}
          >
            <span className="text-sm font-semibold" style={{ color: "#FFC94A" }}>
              🪙 {currentUser.totalPoints} pts
            </span>
            <span className="text-xs" style={{ color: "#8891AC" }}>Level {currentUser.level}</span>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1, transition: { delay: 0.3 } }}>
          {searchParams.get("invite") && (
            <p className="text-sm mb-3 font-semibold" style={{ color: "#FFC94A" }}>
              ⚔️ Targeting a rival — pick a puzzle to begin!
            </p>
          )}
          <button
            onClick={handleOpenPicker}
            className="px-8 py-4 rounded-2xl font-extrabold text-lg transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg, #FFC94A, #AD8932)", color: "#0B0E1A", boxShadow: "0 0 30px -6px rgba(255,201,74,0.6)" }}
          >
            ⚔️ Issue a Challenge
          </button>
        </motion.div>
      </div>

      {/* ── Success toast ── */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl font-bold text-sm shadow-xl"
            style={{ backgroundColor: "rgba(46,217,145,0.15)", border: "1px solid #2ED991", color: "#2ED991" }}
          >
            ✅ Challenge posted! Waiting for an opponent…
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Featured Challenges ── */}
      {featuredChallenges.length > 0 && (
        <div className="max-w-3xl mx-auto px-4 pt-8">
          <div
            className="pw-bevel border p-5 mb-6"
            style={{
              background: "radial-gradient(420px 200px at 15% 0%, rgba(255,201,74,0.16), transparent 60%), radial-gradient(360px 180px at 100% 100%, rgba(178,75,243,0.12), transparent 60%), linear-gradient(160deg, var(--pw-surface-hi), var(--pw-surface) 70%)",
              borderColor: "rgba(255,201,74,0.4)",
              boxShadow: "0 0 30px -10px rgba(255,201,74,0.4)",
            }}
          >
            {/* Section header */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg leading-none">✨</span>
              <span className="font-extrabold text-sm uppercase tracking-widest" style={{ color: "#FFC94A" }}>
                Featured Challenges
              </span>
              <span
                className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold"
                style={{ backgroundColor: "rgba(255,201,74,0.15)", color: "#FFC94A" }}
              >
                {featuredChallenges.length} spotlighted
              </span>
            </div>
            <div className="space-y-3">
              {featuredChallenges.map((c, i) => {
                const remainingMs = new Date(c.spotlightUntil!).getTime() - now.getTime();
                const remainingMins = Math.ceil(remainingMs / 60000);
                const pot = c.challengerWager * 2;
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05 } }}
                    className="pw-bevel border p-4 relative overflow-hidden"
                    style={{
                      background: "linear-gradient(160deg, var(--pw-surface-hi), var(--pw-surface) 70%)",
                      borderColor: "rgba(255,201,74,0.4)",
                      boxShadow: "0 0 20px -8px rgba(255,201,74,0.4)",
                    }}
                  >
                    {/* Gold shimmer strip */}
                    <div
                      className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl"
                      style={{ background: "linear-gradient(90deg, transparent, rgba(255,201,74,0.6), transparent)" }}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-bold text-sm">{c.puzzle.title}</span>
                          <span className="px-1.5 py-0.5 rounded text-xs font-bold" style={{ color: "#B24BF3", backgroundColor: "rgba(178,75,243,0.1)" }}>
                            {getPuzzleTypeLabel(c.puzzle.puzzleType)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-xs" style={{ color: "#8891AC" }}>
                            by <span className="font-medium" style={{ color: "#8891AC" }}>@{c.challenger.name ?? "Unknown"}</span>
                          </span>
                          <span className="text-xs font-semibold" style={{ color: "#FFC94A" }}>
                            ⏱ {remainingMins}m spotlight left
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="text-sm font-bold" style={{ color: "#FFC94A" }}>
                          🪙 pot: <span style={{ color: "#2ED991" }}>{pot}</span> pts
                        </span>
                        {currentUser && c.challenger.id !== currentUser.id && (
                          (!c.invitedUser || c.invitedUser.id === currentUser.id) && (
                            <a
                              href={`/warz/challenge/${c.id}`}
                              className="px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all hover:scale-105"
                              style={{ background: "linear-gradient(135deg, #FFC94A, #AD8932)", color: "#0B0E1A" }}
                            >
                              ⚔️ Accept
                            </a>
                          )
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="max-w-3xl mx-auto px-4 pt-6">
        <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
          {(
            [
              { key: "open" as TabKey, label: "Open Challenges", count: openChallenges.length },
              { key: "mine" as TabKey, label: "My Battles", count: myChallenges.length },
              { key: "history" as TabKey, label: "History", count: historyChallenges.length },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
              style={
                tab === t.key
                  ? { backgroundColor: "rgba(255,201,74,0.15)", color: "#FFC94A" }
                  : { color: "#8891AC" }
              }
            >
              {t.label}
              {t.count > 0 && (
                <span
                  className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs"
                  style={{ backgroundColor: tab === t.key ? "rgba(255,201,74,0.2)" : "rgba(255,255,255,0.07)", color: "inherit" }}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Challenge list ── */}
        {loading ? (
          <LoadingSpinner label="Loading challenges…" />
        ) : displayChallenges.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">{tab === "open" ? "🏜️" : tab === "mine" ? "🤷" : "📜"}</div>
            <p className="font-semibold text-white mb-1">
              {tab === "open" ? "No open challenges" : tab === "mine" ? "You haven't battled yet" : "No history yet"}
            </p>
            <p className="text-sm" style={{ color: "#8891AC" }}>
              {tab === "open" ? "Be the first to issue one!" : "Issue a challenge to get started."}
            </p>
          </div>
        ) : (
          <div className="space-y-3 pb-12">
            {displayChallenges.map((c) => (
              <ChallengeCard key={c.id} challenge={c} currentUserId={currentUser?.id ?? ""} />
            ))}
          </div>
        )}
      </div>

      {/* Puzzle picker modal */}
      <AnimatePresence>
        {showPicker && (
          <PuzzlePickerModal
            puzzles={eligiblePuzzles}
            loading={loadingPuzzles}
            onSelect={handleSelectPuzzle}
            onClose={() => setShowPicker(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function WarzLobbyPage() {
  return (
    <Suspense>
      <WarzLobbyInner />
    </Suspense>
  );
}
