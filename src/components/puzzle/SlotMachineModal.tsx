"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRegisterModal } from "@/hooks/useRegisterModal";
import { rarityColors } from "@/lib/rarity";
import { SLOT_TIERS, type SlotTierId } from "@/lib/slotMachine/tiers";
import { runCompletionCelebration } from "./celebrationEffects";

export interface SlotSpinResultLike {
  level: number;
  tier: SlotTierId;
  label: string;
  colorKey: SlotTierId;
  prizeType: "points" | "hint_tokens" | "skip_tokens" | "cosmetic";
  prizeKey?: string;
  prizeAmount?: number;
  pityTriggered: boolean;
}

interface SlotMachineModalProps {
  spins: SlotSpinResultLike[];
  onDismiss: () => void;
}

const TIER_ICON: Record<SlotTierId, string> = {
  common: "🪙",
  uncommon: "🎟️",
  rare: "💠",
  epic: "🏆",
  legendary: "💎",
};

const REEL_CYCLES = 4;
const ITEM_HEIGHT = 88;
const FIRST_SPIN_MS = 1800;
const MIN_SPIN_MS = 500;
const SPEEDUP_STEP_MS = 350;

function prizeLabel(spin: SlotSpinResultLike): string {
  const parts: string[] = [];
  if (spin.prizeType === "cosmetic") parts.push("Exclusive cosmetic unlocked!");
  if (spin.prizeAmount) parts.push(`+${spin.prizeAmount.toLocaleString()} points`);
  if (spin.prizeType === "hint_tokens") parts.push("+1 hint token");
  if (spin.prizeType === "skip_tokens") parts.push("+1 skip token");
  return parts.join(" · ");
}

function OddsTable({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="mt-4 rounded-xl border p-4 text-left"
      style={{ borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(0,0,0,0.35)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-black tracking-widest uppercase" style={{ color: "#FDE74C" }}>
          Spin odds
        </span>
        <button onClick={onClose} className="text-xs opacity-60 hover:opacity-100" style={{ color: "#fff" }}>
          ✕
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        {SLOT_TIERS.map((tier) => {
          const colors = rarityColors[tier.colorKey];
          return (
            <div key={tier.id} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5" style={{ color: colors.text }}>
                {TIER_ICON[tier.id]} {tier.label}
              </span>
              <span style={{ color: "#9ca3af" }}>{tier.rewardDescription}</span>
              <span className="font-bold tabular-nums" style={{ color: colors.text }}>
                {tier.oddsPercent}%
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function Reel({
  tier,
  spinMs,
  spinning,
  onLanded,
}: {
  tier: SlotTierId;
  spinMs: number;
  spinning: boolean;
  onLanded: () => void;
}) {
  const strip = useMemo(() => {
    const ids = SLOT_TIERS.map((t) => t.id);
    const items: SlotTierId[] = [];
    for (let i = 0; i < REEL_CYCLES; i++) items.push(...ids);
    items.push(tier); // guaranteed final landing item
    return items;
  }, [tier]);

  const targetOffset = -(strip.length - 1) * ITEM_HEIGHT;

  return (
    <div
      className="relative mx-auto overflow-hidden rounded-2xl border-2"
      style={{ width: 180, height: ITEM_HEIGHT, borderColor: "#FDE74C", backgroundColor: "rgba(0,0,0,0.4)" }}
    >
      <motion.div
        initial={{ y: 0 }}
        animate={{ y: spinning ? targetOffset : 0 }}
        transition={spinning ? { duration: spinMs / 1000, ease: [0.1, 0.8, 0.25, 1] } : { duration: 0 }}
        onAnimationComplete={() => {
          if (spinning) onLanded();
        }}
      >
        {strip.map((id, i) => (
          <div key={i} className="flex items-center justify-center" style={{ height: ITEM_HEIGHT, fontSize: 40 }}>
            {TIER_ICON[id]}
          </div>
        ))}
      </motion.div>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.5) 100%)" }}
      />
    </div>
  );
}

/**
 * Level-up slot machine — reel-spin animation lands on a result the server already
 * decided (POST /api/user/claim-level-reward via resolveLevelUpSpins). The animation
 * never re-rolls or second-guesses that result, it only reveals it.
 */
type SpinPhase = "idle" | "spinning" | "landed";

export default function SlotMachineModal({ spins, onDismiss }: SlotMachineModalProps) {
  useRegisterModal("slot-machine-modal");
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<SpinPhase>("idle");
  const [showOdds, setShowOdds] = useState(false);
  const [skippedTo, setSkippedTo] = useState<number | null>(null);

  const spin = spins[index];
  const isLast = index === spins.length - 1;
  const spinMs = Math.max(MIN_SPIN_MS, FIRST_SPIN_MS - index * SPEEDUP_STEP_MS);

  useEffect(() => {
    setPhase("idle");
  }, [index]);

  useEffect(() => {
    if (phase !== "landed" || !spin) return;
    if (spin.tier === "rare") return runCompletionCelebration("confetti");
    if (spin.tier === "epic" || spin.tier === "legendary") return runCompletionCelebration("confetti");
  }, [phase, spin]);

  if (skippedTo !== null) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] overflow-y-auto backdrop-blur-sm"
        style={{ background: "radial-gradient(ellipse at center, rgba(30,20,0,0.92) 0%, rgba(2,2,2,0.97) 100%)" }}
      >
        <div className="flex min-h-[100dvh] items-center justify-center px-4 py-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative z-10 w-full max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl p-6 text-center sm:max-w-md"
            style={{ backgroundColor: "rgba(10, 8, 0, 0.98)", border: "2px solid #FDE74C" }}
          >
            <h2 className="text-lg font-black mb-4" style={{ color: "#FDE74C" }}>
              🎰 {spins.length} Spins Complete
            </h2>
            <div className="flex flex-col gap-2 mb-5 text-left">
              {spins.map((s, i) => {
                const colors = rarityColors[s.colorKey];
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                    style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}
                  >
                    <span style={{ color: colors.text }}>
                      {TIER_ICON[s.tier]} Lv.{s.level} — {s.label}
                    </span>
                    <span className="text-xs" style={{ color: "#9ca3af" }}>
                      {prizeLabel(s)}
                    </span>
                  </div>
                );
              })}
            </div>
            <button
              onClick={onDismiss}
              className="w-full py-2.5 rounded-xl font-bold text-sm"
              style={{ backgroundColor: "#FDE74C", color: "#020202" }}
            >
              Continue
            </button>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  if (!spin) return null;
  const colors = rarityColors[spin.colorKey];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] overflow-y-auto backdrop-blur-sm"
      style={{ background: "radial-gradient(ellipse at center, rgba(30,20,0,0.92) 0%, rgba(2,2,2,0.97) 100%)" }}
    >
      <div className="flex min-h-[100dvh] items-center justify-center px-4 py-4">
        <motion.div
          initial={{ scale: 0.6, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.6, opacity: 0, y: 30 }}
          transition={{ type: "spring", stiffness: 180, damping: 18 }}
          className="relative z-10 w-full max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl p-5 text-center shadow-2xl sm:max-w-md sm:p-8"
          style={{
            backgroundColor: "rgba(10, 8, 0, 0.98)",
            border: "2px solid #FDE74C",
            boxShadow: "0 0 60px rgba(253,231,76,0.25), 0 0 120px rgba(253,231,76,0.1)",
          }}
        >
          <div
            className="inline-block mb-3 px-5 py-1.5 rounded-full text-xs font-black tracking-[0.2em] uppercase"
            style={{ background: "linear-gradient(90deg, #FDE74C, #FFB86B)", color: "#020202" }}
          >
            🎰 Level {spin.level} Spin{spins.length > 1 ? ` (${index + 1}/${spins.length})` : ""}
          </div>

          <Reel
            key={index}
            tier={spin.tier}
            spinMs={spinMs}
            spinning={phase === "spinning"}
            onLanded={() => setPhase("landed")}
          />

          {phase === "idle" && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setPhase("spinning")}
              className="mt-5 w-full py-3 rounded-xl font-black text-sm tracking-wide"
              style={{
                background: "linear-gradient(135deg, #FDE74C, #FFB86B)",
                color: "#020202",
                boxShadow: "0 0 24px rgba(253,231,76,0.35)",
              }}
            >
              🎰 Pull to Spin
            </motion.button>
          )}

          <AnimatePresence>
            {phase === "landed" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-5"
              >
                <div
                  className="inline-block rounded-full px-4 py-1 text-sm font-black uppercase tracking-wide mb-2"
                  style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
                >
                  {spin.label}
                </div>
                {spin.pityTriggered && (
                  <p className="text-xs mb-2" style={{ color: "#FDE74C" }}>
                    ✨ Guaranteed win — the odds were on your side this time!
                  </p>
                )}
                <p className="text-sm font-semibold mb-5" style={{ color: "#DDDBF1" }}>
                  {prizeLabel(spin)}
                </p>

                <div className="flex gap-2">
                  {spins.length > 1 && !isLast && (
                    <button
                      onClick={() => setSkippedTo(spins.length)}
                      className="flex-1 py-2.5 rounded-xl font-semibold text-xs"
                      style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.1)" }}
                    >
                      Skip remaining
                    </button>
                  )}
                  <button
                    onClick={() => (isLast ? onDismiss() : setIndex((i) => i + 1))}
                    className="flex-1 py-2.5 rounded-xl font-bold text-sm"
                    style={{ backgroundColor: "#FDE74C", color: "#020202" }}
                  >
                    {isLast ? "Continue" : "Next spin →"}
                  </button>
                </div>

                <button
                  onClick={() => setShowOdds((v) => !v)}
                  className="mt-3 text-xs underline opacity-70 hover:opacity-100"
                  style={{ color: "#9ca3af" }}
                >
                  {showOdds ? "Hide odds" : "View odds"}
                </button>
                <AnimatePresence>{showOdds && <OddsTable onClose={() => setShowOdds(false)} />}</AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
}
