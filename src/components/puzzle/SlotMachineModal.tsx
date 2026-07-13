"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

const REEL_CYCLES = 7;
const FIRST_SPIN_MS = 3400;
const MIN_SPIN_MS = 1100;
const SPEEDUP_STEP_MS = 550;

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
      <div className="flex flex-col">
        {SLOT_TIERS.map((tier, i) => {
          const colors = rarityColors[tier.colorKey];
          return (
            <div
              key={tier.id}
              className="py-2"
              style={i < SLOT_TIERS.length - 1 ? { borderBottom: "1px solid rgba(255,255,255,0.06)" } : undefined}
            >
              {/* Label + percent share a row (2 items, always aligns to the edges regardless
                  of label length); the description gets its own full-width line below instead
                  of fighting for a middle column — that's what was causing the misalignment
                  once a longer description (e.g. legendary's) wrapped to two lines. */}
              <div className="flex items-center justify-between gap-2 text-xs font-bold">
                <span className="flex items-center gap-1.5" style={{ color: colors.text }}>
                  <span aria-hidden>{TIER_ICON[tier.id]}</span>
                  {tier.label}
                </span>
                <span className="tabular-nums shrink-0" style={{ color: colors.text }}>
                  {tier.oddsPercent}%
                </span>
              </div>
              <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "#9ca3af" }}>
                {tier.rewardDescription}
              </p>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// Screen cutout in slot-machine-cabinet-trimmed.png, measured against the trimmed source art
// (as % of the cabinet image's own box, so this stays correct at any render size).
const SCREEN_LEFT_PCT = 17.107;
const SCREEN_TOP_PCT = 22.6;
const SCREEN_WIDTH_PCT = 65.535;
const SCREEN_HEIGHT_PCT = 20.827;

// slot-machine-cabinet-trimmed.png's own aspect ratio (height / width) — the trimmed art is no
// longer square, so anything sized off the cabinet needs this to convert a measured width into
// the cabinet's actual rendered height.
const CABINET_ASPECT = 1354 / 795;


type SpinPhase = "idle" | "spinning" | "landed";

function Reel({
  tier,
  spinMs,
  phase,
  onLanded,
  itemHeight,
}: {
  tier: SlotTierId;
  spinMs: number;
  phase: SpinPhase;
  onLanded: () => void;
  itemHeight: number;
}) {
  const strip = useMemo(() => {
    const ids = SLOT_TIERS.map((t) => t.id);
    const items: SlotTierId[] = [];
    for (let i = 0; i < REEL_CYCLES; i++) items.push(...ids);
    items.push(tier); // guaranteed final landing item
    return items;
  }, [tier]);

  const targetOffset = -(strip.length - 1) * itemHeight;
  // "landed" must keep targeting targetOffset, same as "spinning" — only "idle" rests at 0.
  // Collapsing landed into the same bucket as idle (both just "not spinning") would snap the
  // strip back to the first item the instant it finishes, hiding whatever tier was actually won.
  const y = phase === "idle" ? 0 : targetOffset;

  return (
    <div className="relative w-full h-full">
      <motion.div
        initial={{ y: 0 }}
        animate={{ y }}
        transition={phase === "spinning" ? { duration: spinMs / 1000, ease: [0.1, 0.8, 0.25, 1] } : { duration: 0 }}
        onAnimationComplete={() => {
          if (phase === "spinning") onLanded();
        }}
      >
        {strip.map((id, i) => (
          <div
            key={i}
            className="flex items-center justify-center"
            style={{ height: itemHeight, fontSize: Math.max(16, itemHeight * 0.62) }}
          >
            {TIER_ICON[id]}
          </div>
        ))}
      </motion.div>
      {/* Fades to white at top/bottom edges of the window — the cabinet's screen is white,
          not the old dark bezel, so the vignette flips light instead of dark. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.65) 0%, transparent 25%, transparent 75%, rgba(255,255,255,0.65) 100%)" }}
      />
    </div>
  );
}

/**
 * "SPIN" trigger — docked at the bottom of the modal card, below the cabinet, instead of
 * overlaid on the artwork. A real gold pill button (not bare text) with a flashing glow/scale
 * pulse to draw the eye, matching the card's other CTA buttons (Continue / Next spin).
 */
function SpinButton({ disabled, onSpin }: { disabled: boolean; onSpin: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onSpin}
      disabled={disabled}
      animate={disabled ? { scale: 1 } : { scale: [1, 1.035, 1] }}
      transition={disabled ? { duration: 0.2 } : { duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      className="mt-6 mb-1 w-full py-3.5 rounded-xl font-black text-base tracking-[0.18em] disabled:cursor-not-allowed"
      style={{
        background: disabled ? "linear-gradient(135deg, #8a7a3f, #7a6538)" : "linear-gradient(135deg, #FDE74C, #FFB86B)",
        color: "#020202",
        boxShadow: disabled ? "none" : "0 0 28px rgba(253,231,76,0.45)",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      SPIN
    </motion.button>
  );
}

/**
 * The cabinet artwork (slot-machine-cabinet-trimmed.png) is a static image — the reel remains
 * fully code-driven, positioned/sized against the cabinet's own measured render size (via
 * ResizeObserver) rather than hardcoded pixels, so it scales correctly at any width.
 */
function SlotCabinet({
  resetKey,
  tier,
  spinMs,
  phase,
  onLanded,
}: {
  resetKey: number;
  tier: SlotTierId;
  spinMs: number;
  phase: SpinPhase;
  onLanded: () => void;
}) {
  const cabinetRef = useRef<HTMLDivElement>(null);
  const [cabinetWidth, setCabinetWidth] = useState(0);

  useLayoutEffect(() => {
    const el = cabinetRef.current;
    if (!el) return;
    // offsetWidth (layout box), not getBoundingClientRect (visual/post-transform box) — the
    // modal card plays a scale(0.6 → 1) spring entrance, and a rect-based read taken while
    // that's still animating would bake in whatever scale was mid-flight at that instant, with
    // nothing to correct it afterward since the transform never actually changes the element's
    // real layout size (so ResizeObserver has nothing to fire on once the spring settles).
    const measure = () => setCabinetWidth(el.offsetWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cabinetHeight = cabinetWidth * CABINET_ASPECT;
  const windowHeight = cabinetHeight * (SCREEN_HEIGHT_PCT / 100);

  return (
    <div ref={cabinetRef} className="relative mx-auto w-[240px] sm:w-[300px]">
      <img
        src="/images/slot-machine-cabinet-trimmed.png"
        alt=""
        draggable={false}
        className="block w-full h-auto select-none"
      />
      {cabinetWidth > 0 && (
        <div
          className="absolute overflow-hidden"
          style={{
            left: `${SCREEN_LEFT_PCT}%`,
            top: `${SCREEN_TOP_PCT}%`,
            width: `${SCREEN_WIDTH_PCT}%`,
            height: `${SCREEN_HEIGHT_PCT}%`,
          }}
        >
          <Reel key={resetKey} tier={tier} spinMs={spinMs} phase={phase} onLanded={onLanded} itemHeight={windowHeight} />
        </div>
      )}
    </div>
  );
}

/**
 * Level-up slot machine — reel-spin animation lands on a result the server already
 * decided (POST /api/user/claim-level-reward via resolveLevelUpSpins). The animation
 * never re-rolls or second-guesses that result, it only reveals it.
 */
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
            className="inline-block mb-4 px-5 py-1.5 rounded-full text-xs font-black tracking-[0.2em] uppercase"
            style={{ background: "linear-gradient(90deg, #FDE74C, #FFB86B)", color: "#020202" }}
          >
            🎰 Level {spin.level} Spin{spins.length > 1 ? ` (${index + 1}/${spins.length})` : ""}
          </div>

          <SlotCabinet
            resetKey={index}
            tier={spin.tier}
            spinMs={spinMs}
            phase={phase}
            onLanded={() => setPhase("landed")}
          />

          {phase !== "landed" && (
            <SpinButton disabled={phase !== "idle"} onSpin={() => setPhase("spinning")} />
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
