"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRegisterModal } from "@/hooks/useRegisterModal";
import {
  COUNTER_DURATION,
  ModalFireworksOverlay,
  normalizeCompletionAnimation,
  runCompletionCelebration,
} from "./celebrationEffects";

// ─── Shared reward-line rendering (XP / Points) ───────────────────────────────
// Grid + min-w-0 + whitespace-nowrap + a viewport-clamped font size keeps "+100 pts" and
// "+50 XP" from overflowing a 320px modal — the amount can never grow past what its own
// grid column (a fixed fraction of the modal's own content width) actually has room for,
// and the clamp keeps individual glyphs from getting wide enough to force that column to
// overflow in the first place. Two size tiers: "normal" for the standalone completion modal
// (where the reward is the visual headline) and "levelup" for the level-up modal (secondary
// to the big level number above it) — both share the exact same overflow-safe structure.
function RewardColumns({
  displayXp, displayPts, hasPoints, size,
}: {
  displayXp: number;
  displayPts: number;
  hasPoints: boolean;
  size: "normal" | "levelup";
}) {
  const amountStyle = size === "normal"
    ? { fontSize: "clamp(2rem, 10vw, 3rem)", lineHeight: 1 }
    : { fontSize: "clamp(1.4rem, 7vw, 1.875rem)", lineHeight: 1 };
  const unitStyle = size === "normal"
    ? { fontSize: "clamp(0.875rem, 4.5vw, 1.5rem)", lineHeight: 1 }
    : { fontSize: "clamp(0.75rem, 3.5vw, 1.25rem)", lineHeight: 1 };
  const xpColor = size === "normal" ? "#FDE74C" : "#FFB86B";
  const xpUnitColor = size === "normal" ? "#FFB86B" : "#AB9F9D";

  return (
    <>
      <div className="puzzle-xp-reward min-w-0 text-center">
        <div className="puzzle-xp-reward-line flex min-w-0 items-baseline justify-center whitespace-nowrap">
          <span className="puzzle-xp-reward-amount font-extrabold tabular-nums" style={{ ...amountStyle, color: xpColor }}>
            +{displayXp}
          </span>
          <span className="puzzle-xp-reward-unit font-bold ml-1" style={{ ...unitStyle, color: xpUnitColor }}>XP</span>
        </div>
        <div className="text-xs mt-1" style={{ color: "#6b7280" }}>Experience</div>
      </div>
      {hasPoints && (
        <div className="puzzle-xp-reward min-w-0 text-center">
          <div className="puzzle-xp-reward-line flex min-w-0 items-baseline justify-center whitespace-nowrap">
            <span className="puzzle-xp-reward-amount font-extrabold tabular-nums" style={{ ...amountStyle, color: "#38D399" }}>
              +{displayPts}
            </span>
            <span className="puzzle-xp-reward-unit font-bold ml-1" style={{ ...unitStyle, color: "#6EE7B7" }}>pts</span>
          </div>
          <div className="text-xs mt-1" style={{ color: "#6b7280" }}>Points</div>
        </div>
      )}
    </>
  );
}

export interface PuzzleXpModalProps {
  xpGained: number;
  /** Points (coins/score) awarded for this solve — shown alongside XP. */
  pointsEarned?: number;
  oldLevel: number;
  newLevel: number;
  newTitle: string;
  /** Progress percentage (0-100) within the OLD level, before XP was added. */
  oldProgress: number;
  /** Progress percentage (0-100) within the NEW level, after XP was added. */
  newProgress: number;
  /** Equipped completion animation from cosmetics (default | confetti | lightning | fireworks). */
  completionAnimation?: string;
  onDismiss: () => void;
}

// ─── Sub-component: standard puzzle-complete modal ────────────────────────────
function NormalModal({
  xpGained,
  pointsEarned,
  newLevel,
  newTitle,
  newProgress,
  oldProgress,
  completionAnimation,
  onDismiss,
}: Omit<PuzzleXpModalProps, "oldLevel">) {
    const normalizedAnimation = normalizeCompletionAnimation(completionAnimation);

  const [displayXp, setDisplayXp] = useState(0);
  const [displayPts, setDisplayPts] = useState(0);
  const [barWidth, setBarWidth] = useState(oldProgress);
  const rafRef = useRef<number | null>(null);
  const ptsRafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const ptsStartRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = null;
    const animate = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const t = Math.min((ts - startRef.current) / COUNTER_DURATION, 1);
      setDisplayXp(Math.round((1 - Math.pow(1 - t, 3)) * xpGained));
      if (t < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [xpGained]);

  useEffect(() => {
    if (!pointsEarned) return;
    ptsStartRef.current = null;
    const animate = (ts: number) => {
      if (ptsStartRef.current === null) ptsStartRef.current = ts;
      const t = Math.min((ts - ptsStartRef.current) / COUNTER_DURATION, 1);
      setDisplayPts(Math.round((1 - Math.pow(1 - t, 3)) * pointsEarned));
      if (t < 1) ptsRafRef.current = requestAnimationFrame(animate);
    };
    ptsRafRef.current = requestAnimationFrame(animate);
    return () => { if (ptsRafRef.current !== null) cancelAnimationFrame(ptsRafRef.current); };
  }, [pointsEarned]);

  useEffect(() => {
    const t = setTimeout(() => setBarWidth(newProgress), 350);
    return () => clearTimeout(t);
  }, [newProgress]);

  useEffect(() => {
    if (normalizedAnimation === "default" || normalizedAnimation === "fireworks") return;
    return runCompletionCelebration(normalizedAnimation);
  }, [normalizedAnimation]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[75] overflow-y-auto bg-black/65 backdrop-blur-sm"
    >
      {normalizedAnimation === "fireworks" && <ModalFireworksOverlay />}
      <div className="flex min-h-[100dvh] items-center justify-center px-4 py-4">
        <motion.div
          initial={{ scale: 0.75, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.75, opacity: 0, y: 24 }}
          transition={{ type: "spring", stiffness: 240, damping: 22 }}
          className="puzzle-xp-modal-card relative z-10 w-full max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border-2 p-4 text-center shadow-2xl sm:max-w-sm sm:p-8"
          style={{ backgroundColor: "rgba(2,2,2,0.97)", borderColor: "#FDE74C", boxSizing: "border-box" }}
        >
        <div className="text-5xl mb-3 select-none">🏆</div>
        <h2 className="text-2xl font-extrabold text-white mb-2">Puzzle Complete!</h2>
        <p className="text-sm mb-5" style={{ color: "#DDDBF1" }}>Lv.{newLevel} · {newTitle}</p>

        {/* XP + Points counters side by side */}
        <div className={`puzzle-xp-rewards grid w-full mb-5 ${(pointsEarned ?? 0) > 0 ? "grid-cols-2 gap-2" : "grid-cols-1"}`}>
          <RewardColumns displayXp={displayXp} displayPts={displayPts} hasPoints={(pointsEarned ?? 0) > 0} size="normal" />
        </div>

        {/* XP progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1.5" style={{ color: "#AB9F9D" }}>
            <span>Level {newLevel}</span>
            <span>{newProgress}%</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: "#1a1a2e" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${barWidth}%`,
                background: "linear-gradient(90deg, #FDE74C, #FFB86B)",
                transition: "width 1.3s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="w-full py-2.5 rounded-xl font-bold text-sm tracking-wide transition-colors"
          style={{ backgroundColor: "#FDE74C", color: "#020202" }}
        >
          Continue
        </button>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Sub-component: LEVEL-UP celebration modal ────────────────────────────────
function LevelUpModal({
  xpGained,
  pointsEarned,
  oldLevel,
  newLevel,
  newTitle,
  newProgress,
  completionAnimation,
  onDismiss,
}: Omit<PuzzleXpModalProps, "oldProgress">) {
  const [displayXp, setDisplayXp] = useState(0);
  const [displayPts, setDisplayPts] = useState(0);
  const [barWidth, setBarWidth] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  const normalizedAnimation = normalizeCompletionAnimation(completionAnimation);

  // Level-up keeps confetti as default, but respects equipped completion animation.
  useEffect(() => {
    const animation = normalizedAnimation === "default" ? "confetti" : normalizedAnimation;
    if (animation === "fireworks") return;
    return runCompletionCelebration(animation);
  }, [normalizedAnimation]);

  // XP counter
  useEffect(() => {
    startRef.current = null;
    const animate = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const t = Math.min((ts - startRef.current) / COUNTER_DURATION, 1);
      setDisplayXp(Math.round((1 - Math.pow(1 - t, 3)) * xpGained));
      if (t < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [xpGained]);

  // Points counter
  useEffect(() => {
    if (!pointsEarned) return;
    const ptsRef = { id: 0, start: null as number | null };
    const animate = (ts: number) => {
      if (ptsRef.start === null) ptsRef.start = ts;
      const t = Math.min((ts - ptsRef.start) / COUNTER_DURATION, 1);
      setDisplayPts(Math.round((1 - Math.pow(1 - t, 3)) * pointsEarned));
      if (t < 1) ptsRef.id = requestAnimationFrame(animate);
    };
    ptsRef.id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(ptsRef.id);
  }, [pointsEarned]);

  // XP bar — starts at 0 (bar just filled!) then animates to newProgress
  useEffect(() => {
    const t = setTimeout(() => setBarWidth(newProgress), 700);
    return () => clearTimeout(t);
  }, [newProgress]);

  // Show subtitle details after the big number lands
  useEffect(() => {
    const t = setTimeout(() => setShowDetails(true), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[75] overflow-y-auto backdrop-blur-sm"
      style={{ background: "radial-gradient(ellipse at center, rgba(30,20,0,0.92) 0%, rgba(2,2,2,0.97) 100%)" }}
    >
      {normalizedAnimation === "fireworks" && <ModalFireworksOverlay />}
      <div className="flex min-h-[100dvh] items-center justify-center px-4 py-4">
        {/* Animated gold shimmer ring — lives inside the card so it clips to card shape */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.6, opacity: 0, y: 30 }}
          transition={{ type: "spring", stiffness: 180, damping: 18 }}
          className="puzzle-xp-modal-card relative z-10 w-full max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl p-4 text-center shadow-2xl sm:max-w-md sm:p-8"
          style={{
            backgroundColor: "rgba(10, 8, 0, 0.98)",
            border: "2px solid #FDE74C",
            boxShadow: "0 0 60px rgba(253,231,76,0.25), 0 0 120px rgba(253,231,76,0.1)",
            boxSizing: "border-box",
          }}
        >
        {/* Inner glow overlay */}
        <div
          className="absolute inset-0 pointer-events-none rounded-3xl"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(253,231,76,0.08) 0%, transparent 70%)" }}
        />

        {/* LEVEL UP label */}
        <motion.div
          initial={{ scale: 0, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 350, damping: 18 }}
          className="inline-block mb-2 px-5 py-1.5 rounded-full text-xs font-black tracking-[0.2em] uppercase"
          style={{ background: "linear-gradient(90deg, #FDE74C, #FFB86B)", color: "#020202" }}
        >
          ⬆ Level Up!
        </motion.div>

        {/* New level number */}
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 260, damping: 16 }}
          className="my-2"
        >
          <span
            className="font-black tabular-nums leading-none"
            style={{
              fontSize: "clamp(3rem, 15vw, 6rem)",
              background: "linear-gradient(180deg, #FDE74C 30%, #FF8C00 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 24px rgba(253,231,76,0.5))",
            }}
          >
            {newLevel}
          </span>
        </motion.div>

        {/* "Lv.X → Lv.Y" and new title */}
        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="mb-5"
            >
              <div className="text-sm font-semibold mb-1" style={{ color: "#AB9F9D" }}>
                Lv.{oldLevel} → Lv.{newLevel}
              </div>
              <div
                className="text-xl font-extrabold tracking-wide"
                style={{ color: "#FDE74C" }}
              >
                {newTitle}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* XP + Points counters */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className={`puzzle-xp-rewards grid w-full mb-5 ${(pointsEarned ?? 0) > 0 ? "grid-cols-2 gap-2" : "grid-cols-1"}`}
        >
          <RewardColumns displayXp={displayXp} displayPts={displayPts} hasPoints={(pointsEarned ?? 0) > 0} size="levelup" />
        </motion.div>

        {/* XP progress bar for new level */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mb-5"
        >
          <div className="flex justify-between text-xs mb-1.5" style={{ color: "#6b7280" }}>
            <span>Level {newLevel} progress</span>
            <span>{newProgress}%</span>
          </div>
          <div className="h-4 rounded-full overflow-hidden" style={{ backgroundColor: "#1a1a2e" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, #FDE74C, #FFB86B, #FF8C00)" }}
              initial={{ width: "0%" }}
              animate={{ width: `${barWidth}%` }}
              transition={{ delay: 0.75, duration: 1.4, ease: [0.4, 0, 0.2, 1] }}
            />
          </div>
        </motion.div>

        <button
          onClick={onDismiss}
          className="w-full py-2.5 rounded-xl font-bold text-sm tracking-wide transition-colors"
          style={{ backgroundColor: "#FDE74C", color: "#020202" }}
        >
          Continue
        </button>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Public component ──────────────────────────────────────────────────────────
export default function PuzzleXpModal(props: PuzzleXpModalProps) {  useRegisterModal('puzzle-xp-modal');  if (props.newLevel > props.oldLevel) {
    return <LevelUpModal {...props} />;
  }
  return <NormalModal {...props} />;
}
