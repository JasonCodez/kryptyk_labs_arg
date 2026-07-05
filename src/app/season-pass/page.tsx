"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import LoadingSpinner from "@/components/LoadingSpinner";
import CosmeticPreviewModal from "@/components/CosmeticPreviewModal";
import { FEATURE_SEASONS_ENABLED } from "@/lib/featureFlags";

interface SeasonTier {
  id: string;
  tierNumber: number;
  xpRequired: number;
  freeRewardType: string | null;
  freeRewardKey: string | null;
  freeRewardQty: number;
  premRewardType: string | null;
  premRewardKey: string | null;
  premRewardQty: number;
}

interface Season {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  premiumPrice: number;
  tiers: SeasonTier[];
}

interface UserPass {
  isPremium: boolean;
  seasonXp: number;
  currentTier: number;
  claimedFree: number[];
  claimedPrem: number[];
  userPoints: number;
}

interface ClaimCelebration {
  icon: string;
  label: string;
  qty: number;
  x: number;
  y: number;
}

const REWARD_ICONS: Record<string, string> = {
  hint_tokens: "💡",
  points: "⭐",
  skip_tokens: "⏭️",
  streak_shields: "🛡️",
  cosmetic: "🎨",
};

const REWARD_LABELS: Record<string, string> = {
  hint_tokens: "Hint Tokens",
  points: "Points",
  skip_tokens: "Skip Tokens",
  streak_shields: "Streak Shields",
  cosmetic: "Cosmetic",
};

const COSMETIC_NAMES: Record<string, string> = {
  frame_ignition_bronze: "Ignition Common Avatar Frame",
  frame_ignition_silver: "Ignition Rare Avatar Frame",
  frame_ignition_gold: "Ignition Epic Avatar Frame",
  frame_ignition_legendary: "Ignition Legendary Avatar Frame",
  theme_ignition_ember: "Ember Theme",
  theme_ignition_inferno: "Inferno Theme",
};

// Matches each cosmetic reward key to the subcategory/value CosmeticPreviewModal expects
// (mirrors the StoreItem.metadata.value seeded for these keys in prisma/seed.ts).
const COSMETIC_PREVIEW_META: Record<string, { subcategory: string; value: string; iconEmoji: string }> = {
  frame_ignition_bronze: { subcategory: "frame", value: "ignition_bronze", iconEmoji: "🟫" },
  frame_ignition_silver: { subcategory: "frame", value: "ignition_silver", iconEmoji: "⬜" },
  frame_ignition_gold: { subcategory: "frame", value: "ignition_gold", iconEmoji: "🟡" },
  frame_ignition_legendary: { subcategory: "frame", value: "ignition_legendary", iconEmoji: "🔶" },
  theme_ignition_ember: { subcategory: "theme", value: "ignition_ember", iconEmoji: "🔥" },
  theme_ignition_inferno: { subcategory: "theme", value: "ignition_inferno", iconEmoji: "🌋" },
};

function formatTimeLeft(endDate: string): string {
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return "Season ended";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h left`;
  return `${hours}h left`;
}

/* ── Particle burst on claim ────────────────────────────────── */
function ClaimBurst({ celebration, onDone }: { celebration: ClaimCelebration; onDone: () => void }) {
  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2;
    const dist = 60 + Math.random() * 40;
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, delay: Math.random() * 0.1 };
  });

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 pointer-events-none"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onAnimationComplete={() => setTimeout(onDone, 1800)}
      >
        {/* Center reward pop */}
        <motion.div
          className="absolute flex flex-col items-center"
          style={{ left: celebration.x, top: celebration.y, transform: "translate(-50%, -50%)" }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.4, 1], opacity: [0, 1, 1] }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <motion.div
            className="text-5xl"
            animate={{ rotate: [0, -10, 10, 0] }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {celebration.icon}
          </motion.div>
          <motion.div
            className="mt-1 px-3 py-1 rounded-full text-sm font-black"
            style={{ background: "linear-gradient(135deg, #FDE74C, #f59e0b)", color: "#000" }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            +{celebration.qty} {celebration.label}
          </motion.div>
        </motion.div>

        {/* Particles */}
        {particles.map((p, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full"
            style={{
              left: celebration.x,
              top: celebration.y,
              background: i % 3 === 0 ? "#FDE74C" : i % 3 === 1 ? "#a855f7" : "#38d399",
            }}
            initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            animate={{ x: p.x, y: p.y, scale: 0, opacity: 0 }}
            transition={{ duration: 0.8, delay: p.delay, ease: "easeOut" }}
          />
        ))}

        {/* Ring pulse */}
        <motion.div
          className="absolute rounded-full border-2 border-yellow-400"
          style={{ left: celebration.x, top: celebration.y, transform: "translate(-50%, -50%)" }}
          initial={{ width: 0, height: 0, opacity: 0.8 }}
          animate={{ width: 160, height: 160, opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Compact reward card (two-column battle pass layout) ────── */
function CompactRewardCard({
  type,
  rewardKey,
  qty,
  claimed,
  unlocked,
  locked,
  track,
  onClaim,
  claiming,
  onPreview,
}: {
  type: string | null;
  rewardKey: string | null;
  qty: number;
  claimed: boolean;
  unlocked: boolean;
  locked: boolean;
  track: "free" | "premium";
  onClaim: (e: React.MouseEvent) => void;
  claiming: boolean;
  onPreview: (rewardKey: string) => void;
}) {
  const icon = type ? REWARD_ICONS[type] || "🎁" : null;
  const label = type ? REWARD_LABELS[type] || type : null;
  const displayName = (rewardKey && COSMETIC_NAMES[rewardKey]) || label || "";
  const isPrem = track === "premium";
  const isPreviewable = type === "cosmetic" && !!rewardKey && !!COSMETIC_PREVIEW_META[rewardKey];

  if (!type) {
    return (
      <div className="min-h-[96px] rounded-xl border border-white/[0.03] flex items-center justify-center">
        <span className="text-white/10 text-xs">—</span>
      </div>
    );
  }

  const isLocked = !unlocked || locked;
  const isClaimable = unlocked && !locked && !claimed;

  // Card style
  let borderColor: string;
  let bgStyle: React.CSSProperties;
  let topBeamColor: string;
  let iconGlowColor: string;
  if (claimed) {
    borderColor = "rgba(52,211,153,0.45)";
    bgStyle = {
      background: "linear-gradient(160deg, rgba(52,211,153,0.1) 0%, rgba(52,211,153,0.04) 100%)",
      boxShadow: "inset 0 1px 0 rgba(52,211,153,0.55), 0 4px 16px rgba(52,211,153,0.06)",
    };
    topBeamColor = "rgba(52,211,153,0.7)";
    iconGlowColor = "rgba(52,211,153,0.3)";
  } else if (isClaimable) {
    borderColor = isPrem ? "rgba(192,132,252,0.6)" : "rgba(253,231,76,0.6)";
    bgStyle = {
      background: isPrem
        ? "linear-gradient(160deg, rgba(168,85,247,0.14) 0%, rgba(88,28,135,0.06) 100%)"
        : "linear-gradient(160deg, rgba(253,231,76,0.12) 0%, rgba(245,158,11,0.04) 100%)",
      boxShadow: isPrem
        ? "inset 0 1px 0 rgba(192,132,252,0.8), 0 4px 20px rgba(168,85,247,0.1)"
        : "inset 0 1px 0 rgba(253,231,76,0.85), 0 4px 20px rgba(253,231,76,0.1)",
    };
    topBeamColor = isPrem ? "rgba(192,132,252,0.9)" : "rgba(253,231,76,0.9)";
    iconGlowColor = isPrem ? "rgba(168,85,247,0.35)" : "rgba(253,231,76,0.35)";
  } else if (locked) {
    borderColor = "rgba(168,85,247,0.3)";
    bgStyle = {
      background: "linear-gradient(160deg, rgba(88,28,135,0.16) 0%, rgba(168,85,247,0.06) 100%)",
      boxShadow: "inset 0 1px 0 rgba(168,85,247,0.25)",
    };
    topBeamColor = "rgba(168,85,247,0.35)";
    iconGlowColor = "rgba(168,85,247,0.2)";
  } else {
    borderColor = "rgba(56,145,166,0.35)";
    bgStyle = {
      background: "linear-gradient(160deg, rgba(56,145,166,0.12) 0%, rgba(56,145,166,0.03) 100%)",
      boxShadow: "inset 0 1px 0 rgba(56,145,166,0.3)",
    };
    topBeamColor = "rgba(56,145,166,0.4)";
    iconGlowColor = "rgba(56,145,166,0.2)";
  }

  return (
    <div
      className="relative min-h-[96px] rounded-xl flex flex-col items-center justify-between gap-1.5 p-3 transition-all duration-300 overflow-hidden"
      style={{ border: `1px solid ${borderColor}`, ...bgStyle }}
    >
      {/* Top edge light beam */}
      <div
        className="absolute top-0 left-4 right-4 h-[1px] rounded-full pointer-events-none"
        style={{ background: `linear-gradient(90deg, transparent, ${topBeamColor}, transparent)` }}
      />

      {/* Shimmer sweep on claimable */}
      {isClaimable && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
          <div
            className="absolute inset-0 animate-shimmer"
            style={{
              background: `linear-gradient(105deg, transparent 30%, ${isPrem ? "rgba(168,85,247,0.15)" : "rgba(253,231,76,0.15)"} 50%, transparent 70%)`,
              backgroundSize: "250% 100%",
            }}
          />
        </div>
      )}

      {/* Lock badge overlay (top-right) */}
      {isLocked && !claimed && (
        <div className="absolute top-1.5 right-1.5 text-[11px] leading-none opacity-60">
          {locked ? "✨" : "🔒"}
        </div>
      )}

      {/* Preview button (top-left) — lets players see the cosmetic before earning it */}
      {isPreviewable && (
        <button
          onClick={(e) => { e.stopPropagation(); onPreview(rewardKey as string); }}
          title="Preview"
          className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] leading-none transition-transform hover:scale-110 active:scale-95"
          style={{ background: "rgba(255,255,255,0.1)", color: "#e2e8f0" }}
        >
          👁
        </button>
      )}

      {/* Icon with radial glow spot + float on claimable */}
      <div className="relative flex items-center justify-center mt-0.5">
        {/* Radial glow spot behind icon */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 40, height: 40,
            background: `radial-gradient(circle, ${iconGlowColor} 0%, transparent 70%)`,
            left: "50%", top: "50%", transform: "translate(-50%, -50%)",
          }}
        />
        <motion.span
          className="relative text-2xl leading-none"
          animate={isClaimable ? { y: [0, -4, 0] } : {}}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          {icon}
        </motion.span>
      </div>

      {/* Name */}
      <p className={`text-[10px] font-bold text-center leading-tight w-full px-0.5 ${
        claimed
          ? "text-emerald-300"
          : isClaimable
          ? isPrem ? "text-purple-100" : "text-yellow-100"
          : locked
          ? "text-purple-200/70"
          : "text-white/80"
      }`}>
        {qty > 1 ? `${qty}× ` : ""}{displayName}
      </p>

      {/* Status / CTA */}
      {claimed ? (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-6 h-6 rounded-full flex items-center justify-center text-emerald-400 text-xs font-bold"
          style={{ background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.45)" }}
        >
          ✓
        </motion.div>
      ) : isClaimable ? (
        <motion.button
          onClick={onClaim}
          disabled={claiming}
          whileHover={{ scale: 1.04, brightness: 1.1 } as any}
          whileTap={{ scale: 0.95 }}
          className={`w-full py-1 text-[10px] font-black rounded-lg transition-all disabled:opacity-40 ${
            isPrem
              ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
              : "bg-gradient-to-r from-yellow-400 to-amber-500 text-black"
          }`}
          style={{
            boxShadow: isPrem
              ? "0 2px 12px rgba(168,85,247,0.45)"
              : "0 2px 12px rgba(253,231,76,0.4)",
          }}
        >
          {claiming ? "···" : "CLAIM"}
        </motion.button>
      ) : locked ? (
        <span className="text-[9px] font-black text-purple-300/50 tracking-widest uppercase">Premium</span>
      ) : (
        <div
          className="h-[22px] w-full rounded-lg flex items-center justify-center"
          style={{ background: "rgba(56,145,166,0.08)", border: "1px solid rgba(56,145,166,0.2)" }}
        >
          <span className="text-[9px] font-black tracking-widest" style={{ color: "rgba(56,145,166,0.75)" }}>EARN XP</span>
        </div>
      )}
    </div>
  );
}

/* ── Tier row — two-column battle pass layout ────────────────── */
function TierRow({
  tier,
  index,
  unlocked,
  isNext,
  isMilestone,
  isCurrent,
  progressPct,
  xp,
  isLastUnlocked,
  isLast,
  claimedFree,
  claimedPrem,
  isPremium,
  claiming,
  onClaim,
  onPreview,
}: {
  tier: SeasonTier;
  index: number;
  unlocked: boolean;
  isNext: boolean;
  isMilestone: boolean;
  isCurrent: boolean;
  isLastUnlocked: boolean;
  isLast: boolean;
  progressPct: number;
  xp: number;
  claimedFree: Set<number>;
  claimedPrem: Set<number>;
  isPremium: boolean;
  claiming: string | null;
  onClaim: (tierNumber: number, track: "free" | "premium", e: React.MouseEvent) => void;
  onPreview: (rewardKey: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {/* ── Milestone banner ── */}
      {isMilestone && (
        <motion.div
          initial={{ opacity: 0, scaleX: 0.85 }}
          animate={inView ? { opacity: 1, scaleX: 1 } : {}}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative mx-2 mb-2 rounded-lg overflow-hidden"
          style={{
            background: "linear-gradient(90deg, rgba(168,85,247,0.06) 0%, rgba(168,85,247,0.15) 50%, rgba(168,85,247,0.06) 100%)",
            border: "1px solid rgba(168,85,247,0.25)",
          }}
        >
          {/* Sweep shimmer — translateX avoids background-position loop stutter */}
          <motion.div
            className="absolute inset-y-0 pointer-events-none"
            style={{
              width: "40%",
              background: "linear-gradient(90deg, transparent 0%, rgba(192,132,252,0.18) 50%, transparent 100%)",
            }}
            animate={{ x: ["-100%", "350%"] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "linear", repeatDelay: 1.2 }}
          />
          <div className="relative flex items-center justify-center gap-2 py-1.5">
            <span className="text-[9px] font-black tracking-[0.2em] text-purple-300/70 uppercase">◆ Milestone Tier {tier.tierNumber} ◆</span>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-[1fr_52px_1fr] items-stretch">
        {/* ── Free reward (left) ── */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ delay: 0.06, duration: 0.4, ease: "easeOut" }}
          className="pr-3 pb-5"
        >
          <CompactRewardCard
            type={tier.freeRewardType}
            rewardKey={tier.freeRewardKey}
            qty={tier.freeRewardQty}
            claimed={claimedFree.has(tier.tierNumber)}
            unlocked={unlocked}
            locked={false}
            track="free"
            onClaim={(e) => onClaim(tier.tierNumber, "free", e)}
            claiming={claiming === `free-${tier.tierNumber}`}
            onPreview={onPreview}
          />
        </motion.div>

        {/* ── Center spine ── */}
        <div className="relative flex flex-col items-center">
          {/* Pixel-accurate connectors — no percentage math, guaranteed aligned */}
          {(() => {
            const nodeRadius = unlocked ? (isMilestone ? 24 : 18) : isNext ? 18 : 16;
            const nodeCenterY = 22 + nodeRadius;
            const gold = "#f59e0b";
            const dim = "rgba(255,255,255,0.07)";
            const isFirst = index === 0;
            return (
              <>
                {/* Top connector — skip for very first row */}
                {!isFirst && (
                  <div
                    className="absolute left-1/2 top-0 pointer-events-none overflow-hidden"
                    style={{ width: 4, marginLeft: -2, height: nodeCenterY, background: unlocked ? gold : dim, zIndex: 0, borderRadius: 2 }}
                  >
                    {unlocked && <div className="absolute inset-0 animate-track-bead" />}
                  </div>
                )}
                {/* Bottom connector — skip for very last row */}
                {!isLast && (
                  <div
                    className="absolute left-1/2 pointer-events-none overflow-hidden"
                    style={{ width: 4, marginLeft: -2, top: nodeCenterY, bottom: 0, background: unlocked ? gold : dim, zIndex: 0, borderRadius: 2 }}
                  >
                    {unlocked && <div className="absolute inset-0 animate-track-bead" />}
                  </div>
                )}
                {/* Pulsing frontier dot at the top of the next-to-unlock row */}
                {isNext && (
                  <motion.div
                    className="absolute left-1/2 rounded-full pointer-events-none"
                    style={{ width: 10, height: 10, marginLeft: -5, top: 0, background: "#FDE74C", boxShadow: "0 0 10px rgba(253,231,76,1), 0 0 22px rgba(253,231,76,0.5)", zIndex: 20 }}
                    animate={{ scale: [1, 1.55, 1], opacity: [0.8, 1, 0.8] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
              </>
            );
          })()}

          {/* Milestone / Next badge */}
          <div className="h-5 relative z-10 flex items-center justify-center mb-0.5">
            {isNext && !isMilestone ? (
              <span className="text-[7px] font-black text-yellow-400/60 tracking-widest animate-pulse">▲ NEXT</span>
            ) : null}
          </div>

          {/* Tier node with glow rings */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={inView ? { scale: 1, opacity: 1 } : {}}
            transition={{ delay: 0.04, duration: 0.3, type: "spring", stiffness: 280, damping: 18 }}
            className="relative z-10 flex items-center justify-center flex-shrink-0"
          >
            {/* Pulsing ambient glow (unlocked) */}
            {unlocked && (
              <motion.div
                className="absolute rounded-full pointer-events-none"
                style={{
                  inset: isMilestone ? -14 : -10,
                  background: isMilestone
                    ? "radial-gradient(circle, rgba(168,85,247,0.4) 0%, transparent 70%)"
                    : "radial-gradient(circle, rgba(253,231,76,0.3) 0%, transparent 70%)",
                }}
                animate={{ opacity: [0.5, 1, 0.5], scale: [0.9, 1.1, 0.9] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
              />
            )}

            {/* "Next" pulsing ring */}
            {isNext && (
              <motion.div
                className="absolute rounded-full pointer-events-none"
                style={{
                  inset: -6,
                  border: "1.5px solid rgba(253,231,76,0.5)",
                }}
                animate={{ opacity: [0.3, 0.9, 0.3], scale: [1, 1.18, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
            )}

            {/* Node itself */}
            <div
              className={`relative z-10 rounded-full flex items-center justify-center font-black transition-all duration-300 ${
                unlocked
                  ? isMilestone
                    ? "w-12 h-12 text-base text-white"
                    : "w-9 h-9 text-xs text-black"
                  : isNext
                  ? "w-9 h-9 text-xs text-yellow-400/80"
                  : "w-8 h-8 text-xs text-white/45"
              }`}
              style={{
                background: unlocked
                  ? isMilestone
                    ? "linear-gradient(135deg, #a855f7, #ec4899)"
                    : "linear-gradient(135deg, #FDE74C, #f59e0b)"
                  : isNext
                  ? "rgba(253,231,76,0.07)"
                  : "rgba(255,255,255,0.04)",
                border: unlocked
                  ? isMilestone
                    ? "2px solid rgba(192,132,252,0.6)"
                    : "none"
                  : isNext
                  ? "1.5px solid rgba(253,231,76,0.3)"
                  : "1.5px solid rgba(255,255,255,0.06)",
                boxShadow: unlocked
                  ? isMilestone
                    ? "0 0 22px rgba(168,85,247,0.55), 0 0 8px rgba(168,85,247,0.8)"
                    : "0 0 14px rgba(253,231,76,0.5), 0 0 5px rgba(253,231,76,0.8)"
                  : "none",
              }}
            >
              {isMilestone && unlocked ? "💎" : tier.tierNumber}
            </div>
          </motion.div>

          {/* XP label — shows remaining XP for the next tier, threshold for future tiers */}
          <span className={`relative z-10 text-[8px] mt-0.5 font-medium tabular-nums ${
            unlocked ? "text-white/40" : isNext ? "text-yellow-400/80" : "text-white/25"
          }`}>
            {isNext
              ? `+${(tier.xpRequired - xp).toLocaleString()} xp`
              : tier.xpRequired >= 1000
              ? `${(tier.xpRequired / 1000).toFixed(1)}k`
              : tier.xpRequired}
          </span>

          {/* Connector spacer — grows to match card column height */}
          <div className="flex-1 mt-1" style={{ minHeight: 20 }} />
        </div>

        {/* ── Premium reward (right) ── */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ delay: 0.06, duration: 0.4, ease: "easeOut" }}
          className="pl-3 pb-5"
        >
          <CompactRewardCard
            type={tier.premRewardType}
            rewardKey={tier.premRewardKey}
            qty={tier.premRewardQty}
            claimed={claimedPrem.has(tier.tierNumber)}
            unlocked={unlocked}
            locked={!isPremium}
            track="premium"
            onClaim={(e) => onClaim(tier.tierNumber, "premium", e)}
            claiming={claiming === `premium-${tier.tierNumber}`}
            onPreview={onPreview}
          />
        </motion.div>
      </div>
    </div>
  );
}

/* ── Fireworks canvas ─────────────────────────────────────── */
function FireworksCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Capture as non-null for use inside closures
    const c: HTMLCanvasElement = canvas;
    const g: CanvasRenderingContext2D = ctx;

    let animId: number;

    const resize = () => {
      c.width = c.offsetWidth;
      c.height = c.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    interface FWParticle {
      x: number; y: number;
      vx: number; vy: number;
      color: string;
      alpha: number;
      radius: number;
      trail: { x: number; y: number }[];
      isRocket: boolean;
      explodeY: number;
    }
    interface Spark {
      x: number; y: number;
      vx: number; vy: number;
      color: string;
      alpha: number;
      radius: number;
    }

    const rockets: FWParticle[] = [];
    const sparks: Spark[] = [];
    const palette = ["#a855f7","#ec4899","#FDE74C","#c084fc","#f472b6","#3891A6","#60a5fa","#ffffff","#fb7185"];

    function spawnRocket() {
      const x = c.width * (0.08 + Math.random() * 0.84);
      const explodeY = c.height * (0.1 + Math.random() * 0.42);
      const vy = -((c.height - explodeY) / 52);
      rockets.push({
        x, y: c.height,
        vx: (Math.random() - 0.5) * 0.9,
        vy,
        color: palette[Math.floor(Math.random() * palette.length)],
        alpha: 1,
        radius: 2.5,
        trail: [],
        isRocket: true,
        explodeY,
      });
    }

    function explode(x: number, y: number) {
      const c1 = palette[Math.floor(Math.random() * palette.length)];
      const c2 = palette[Math.floor(Math.random() * palette.length)];
      const count = 65 + Math.floor(Math.random() * 45);
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.15;
        const speed = 1.8 + Math.random() * 3.2;
        sparks.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed * 0.75,
          color: Math.random() > 0.45 ? c1 : c2,
          alpha: 1,
          radius: 1.6 + Math.random() * 2.2,
        });
      }
    }

    // Initial burst + recurring
    spawnRocket();
    setTimeout(spawnRocket, 250);
    const interval = setInterval(spawnRocket, 550);

    function loop() {
      g.clearRect(0, 0, c.width, c.height);

      // Rockets
      for (let i = rockets.length - 1; i >= 0; i--) {
        const p = rockets[i];
        p.trail.unshift({ x: p.x, y: p.y });
        if (p.trail.length > 10) p.trail.length = 10;

        p.trail.forEach((pt, ti) => {
          g.beginPath();
          g.arc(pt.x, pt.y, p.radius * (1 - ti / 10), 0, Math.PI * 2);
          g.fillStyle = p.color;
          g.globalAlpha = p.alpha * (1 - ti / 10) * 0.45;
          g.fill();
        });

        g.beginPath();
        g.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        g.fillStyle = p.color;
        g.globalAlpha = 1;
        g.fill();
        g.globalAlpha = 1;

        p.x += p.vx;
        p.y += p.vy;

        if (p.y <= p.explodeY) {
          explode(p.x, p.y);
          rockets.splice(i, 1);
        }
      }

      // Sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        g.beginPath();
        g.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        g.fillStyle = s.color;
        g.globalAlpha = s.alpha;
        g.fill();
        g.globalAlpha = 1;

        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.055; // gravity
        s.vx *= 0.976; // drag
        s.alpha -= 0.016;
        s.radius *= 0.994;
        if (s.alpha <= 0) sparks.splice(i, 1);
      }

      animId = requestAnimationFrame(loop);
    }

    loop();

    return () => {
      cancelAnimationFrame(animId);
      clearInterval(interval);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.75 }}
    />
  );
}

/* ── Premium unlock celebration modal ──────────────────────── */
function PremiumUnlockModal({ seasonName, onDone }: { seasonName: string; onDone: () => void }) {
  const particles = Array.from({ length: 30 }, (_, i) => {
    const angle = (i / 30) * Math.PI * 2;
    const dist = 80 + Math.random() * 120;
    const colors = ["#a855f7", "#ec4899", "#FDE74C", "#c084fc", "#f472b6", "#e879f9"];
    return {
      x: Math.cos(angle) * dist * (0.8 + Math.random() * 0.4),
      y: Math.sin(angle) * dist * (0.8 + Math.random() * 0.4),
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.3,
      size: 4 + Math.random() * 6,
    };
  });

  const perks = [
    { icon: "🎨", label: "Exclusive cosmetics at every milestone" },
    { icon: "💡", label: "Bonus hint & skip tokens" },
    { icon: "⭐", label: "Extra points at premium tiers" },
    { icon: "✨", label: "Premium rewards for the full season" },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={onDone}
    >
      {/* Fireworks canvas — full backdrop */}
      <FireworksCanvas />

      {/* Particle burst */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        {particles.map((p, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{ width: p.size, height: p.size, background: p.color }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: p.x, y: p.y, opacity: 0, scale: 0 }}
            transition={{ duration: 1.2, delay: 0.3 + p.delay, ease: "easeOut" }}
          />
        ))}
      </div>

      {/* Modal card */}
      <motion.div
        className="relative w-full max-w-md mx-4 rounded-3xl overflow-hidden"
        style={{ border: "1px solid rgba(168,85,247,0.4)", background: "linear-gradient(160deg, #0e0a1a 0%, #120820 50%, #0a0a14 100%)" }}
        initial={{ scale: 0.7, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 240, damping: 20, delay: 0.05 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow backdrop */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(168,85,247,0.25) 0%, transparent 70%)",
        }} />

        {/* Animated top border shine */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-[2px] rounded-t-3xl"
          style={{ background: "linear-gradient(90deg, transparent, #a855f7, #ec4899, #a855f7, transparent)" }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative z-10 p-8 flex flex-col items-center text-center">
          {/* Crown + sparkle */}
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.2 }}
            className="relative mb-4"
          >
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl"
              style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.25), rgba(236,72,153,0.2))", border: "1.5px solid rgba(168,85,247,0.35)" }}>
              👑
            </div>
            <motion.div
              className="absolute -top-1 -right-1 text-2xl"
              animate={{ rotate: [0, 15, -10, 0], scale: [1, 1.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
            >✨</motion.div>
          </motion.div>

          {/* Title */}
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="text-3xl font-black text-white mb-1 tracking-tight"
          >
            Premium Unlocked!
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="text-sm font-medium mb-6"
            style={{ color: "rgba(192,132,252,0.8)" }}
          >
            {seasonName}
          </motion.p>

          {/* Perks list */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="w-full space-y-2.5 mb-7"
          >
            {perks.map((perk, i) => (
              <motion.div
                key={perk.label}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.08 }}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-left"
                style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.15)" }}
              >
                <span className="text-xl flex-shrink-0">{perk.icon}</span>
                <span className="text-sm text-white/80 font-medium">{perk.label}</span>
                <span className="ml-auto text-emerald-400 text-base flex-shrink-0">✓</span>
              </motion.div>
            ))}
          </motion.div>

          {/* CTA */}
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.9 }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={onDone}
            className="w-full py-3.5 rounded-xl font-black text-base text-white tracking-wide"
            style={{ background: "linear-gradient(135deg, #a855f7, #ec4899)", boxShadow: "0 0 30px rgba(168,85,247,0.4)" }}
          >
            Start Claiming Rewards 🎁
          </motion.button>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
            className="text-[11px] text-white/50 mt-3"
          >
            Click anywhere to dismiss
          </motion.p>
        </div>
      </motion.div>
    </motion.div>
  );
}


export default function SeasonPassPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [season, setSeason] = useState<Season | null>(null);
  const [userPass, setUserPass] = useState<UserPass | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<ClaimCelebration | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Redirect if feature is disabled — must come after all hook declarations
  useEffect(() => {
    if (!FEATURE_SEASONS_ENABLED) router.replace('/dashboard');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!FEATURE_SEASONS_ENABLED) return null;

  const fetchSeason = useCallback(async () => {
    try {
      const res = await fetch("/api/season");
      if (!res.ok) throw new Error("Failed to load season");
      const data = await res.json();
      setSeason(data.season);
      setUserPass(data.userPass);
    } catch {
      setError("Failed to load season data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }
    if (status === "authenticated") {
      fetchSeason();
    }
  }, [status, router, fetchSeason]);

  // Handle Stripe return URL params
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (status !== "authenticated") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("purchase") === "success") {
      setPurchaseSuccess(true);
      window.history.replaceState({}, "", "/season-pass");
      const sessionId = params.get("session_id");
      (async () => {
        try {
          const res = await fetch("/api/season/verify-purchase", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sessionId ? { sessionId } : {}),
          });
          const data = await res.json();
          if (!res.ok) {
            setError(data.error || "Premium purchase verification failed");
          }
        } catch {
          setError("Premium purchase verification failed");
        } finally {
          await fetchSeason();
        }
      })();
    } else if (params.get("purchase") === "cancelled") {
      window.history.replaceState({}, "", "/season-pass");
    }
  }, [status, fetchSeason]);

  const handleClaim = async (tierNumber: number, track: "free" | "premium", e: React.MouseEvent) => {
    const key = `${track}-${tierNumber}`;
    setClaiming(key);

    // Capture click position for celebration
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    try {
      const res = await fetch("/api/season/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierNumber, track }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Claim failed");
        return;
      }

      // Show celebration
      const rewardType = data.reward?.type || "points";
      const icon = REWARD_ICONS[rewardType] || "🎁";
      const label = REWARD_LABELS[rewardType] || rewardType;
      setCelebration({ icon, label, qty: data.reward?.qty || 1, x: cx, y: cy });

      // Refresh navbar badge
      window.dispatchEvent(new Event("puzzlewarz:xp-updated"));

      await fetchSeason();
    } catch {
      setError("Claim failed");
    } finally {
      setClaiming(null);
    }
  };

  const handlePurchasePremium = async () => {
    setPurchasing(true);
    setError(null);
    try {
      const res = await fetch("/api/season/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Purchase failed");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError("Failed to start checkout");
    } finally {
      setPurchasing(false);
    }
  };

  if (status === "loading" || loading) {
    return <LoadingSpinner size={180} />;
  }

  if (!season) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: "#020202" }}>
        <span className="text-6xl">🏅</span>
        <h1 className="text-2xl font-bold text-white">No Active Season</h1>
        <p className="text-white/50 text-sm">Check back soon for the next season!</p>
        <Link href="/dashboard" className="text-yellow-400 hover:underline text-sm mt-2">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  const tiers = season.tiers;
  const xp = userPass?.seasonXp ?? 0;
  const currentTier = userPass?.currentTier ?? 0;
  const claimedFree = new Set(userPass?.claimedFree ?? []);
  const claimedPrem = new Set(userPass?.claimedPrem ?? []);
  const isPremium = userPass?.isPremium ?? false;

  // XP progress
  const nextTier = tiers.find((t) => t.xpRequired > xp);
  const prevTierXp = currentTier > 0 ? (tiers.find((t) => t.tierNumber === currentTier)?.xpRequired ?? 0) : 0;
  const nextTierXp = nextTier?.xpRequired ?? prevTierXp;
  const progressPct =
    nextTierXp > prevTierXp ? Math.min(100, Math.round(((xp - prevTierXp) / (nextTierXp - prevTierXp)) * 100)) : 100;

  // Total track fill — only reaches the last *unlocked* node; never visually crosses a locked node
  const unlockedCount = tiers.filter((t) => xp >= t.xpRequired).length;
  // Last unlocked tier number (used to stop the per-row gold connector at the right node)
  const lastUnlockedTierNumber = tiers.reduce<number>((last, t) => xp >= t.xpRequired ? t.tierNumber : last, -1);

  // Milestone tiers (cosmetic rewards)
  const milestoneTiers = new Set([5, 10, 15, 20, 25, 30]);

  // Count claimable-but-unclaimed rewards for the alert banner
  const unclaimedCount = tiers.reduce((count, t) => {
    if (xp < t.xpRequired) return count;
    let n = 0;
    if (t.freeRewardType && !claimedFree.has(t.tierNumber)) n++;
    if (t.premRewardType && isPremium && !claimedPrem.has(t.tierNumber)) n++;
    return count + n;
  }, 0);

  return (
    <div className="min-h-screen pb-20 pt-20" style={{ backgroundColor: "#020202" }}>
      {/* Claim celebration overlay */}
      {celebration && (
        <ClaimBurst celebration={celebration} onDone={() => setCelebration(null)} />
      )}

      {/* Cosmetic reward preview modal */}
      {previewKey && COSMETIC_PREVIEW_META[previewKey] && (
        <CosmeticPreviewModal
          subcategory={COSMETIC_PREVIEW_META[previewKey].subcategory}
          value={COSMETIC_PREVIEW_META[previewKey].value}
          displayName={COSMETIC_NAMES[previewKey] ?? previewKey}
          iconEmoji={COSMETIC_PREVIEW_META[previewKey].iconEmoji}
          onClose={() => setPreviewKey(null)}
        />
      )}

      {/* Unclaimed rewards alert banner */}
      {unclaimedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-14 z-30 mx-auto max-w-2xl px-4 pt-3"
        >
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm"
            style={{
              background: "linear-gradient(135deg, rgba(253,231,76,0.14), rgba(245,158,11,0.08))",
              border: "1px solid rgba(253,231,76,0.35)",
              boxShadow: "0 0 20px rgba(253,231,76,0.08)",
            }}
          >
            <span className="text-xl flex-shrink-0">🎁</span>
            <span className="text-yellow-200">
              You have{" "}
              <span className="font-black text-yellow-400">{unclaimedCount}</span>{" "}
              unclaimed reward{unclaimedCount !== 1 ? "s" : ""}! Scroll down to claim.
            </span>
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.8 }}
              className="ml-auto text-yellow-400 font-black text-xs tracking-widest"
            >
              ↓ CLAIM
            </motion.span>
          </div>
        </motion.div>
      )}

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden">
        <div
          className="px-4 py-8 md:px-8"
          style={{
            background: "linear-gradient(180deg, rgba(253,231,76,0.06) 0%, rgba(168,85,247,0.03) 40%, rgba(2,2,2,1) 100%)",
          }}
        >
          <div className="max-w-6xl mx-auto">
            {/* Title row */}
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(253,231,76,0.2), rgba(245,158,11,0.2))" }}>
                <span className="text-xl">🏅</span>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">{season.name}</h1>
                {season.description && (
                  <p className="text-white/40 text-xs mt-0.5">{season.description}</p>
                )}
              </div>
              {isPremium && (
                <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white tracking-wider ml-auto">
                  PREMIUM
                </span>
              )}
            </div>

            {/* Stats row */}
            <div className="mt-6 grid grid-cols-3 gap-3 max-w-md">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <div className="text-lg font-black text-yellow-400">{currentTier}</div>
                <div className="text-[10px] text-white/40 font-medium">TIER</div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <div className="text-lg font-black text-white">{xp.toLocaleString()}</div>
                <div className="text-[10px] text-white/40 font-medium">SEASON XP</div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <div className="text-lg font-black text-white/60">{formatTimeLeft(season.endDate)}</div>
                <div className="text-[10px] text-white/40 font-medium">REMAINING</div>
              </div>
            </div>

            {/* XP progress bar */}
            <div className="mt-4 max-w-2xl">
              <div className="flex items-center justify-between text-[10px] text-white/40 mb-1.5 font-medium">
                <span>TIER {currentTier}</span>
                <span>
                  {nextTier
                    ? `${(nextTier.xpRequired - xp).toLocaleString()} XP to Tier ${nextTier.tierNumber}`
                    : "MAX TIER"}
                </span>
              </div>
              <div className="h-2.5 bg-white/[0.06] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full rounded-full relative"
                  style={{ background: "linear-gradient(90deg, #FDE74C, #f59e0b)" }}
                >
                  <div className="absolute inset-0 rounded-full" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)" }} />
                </motion.div>
              </div>
            </div>

            {/* Premium upsell */}
            {!isPremium && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-xl border border-purple-500/20"
                style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.06), rgba(236,72,153,0.04))" }}
              >
                <div className="flex-1">
                  <p className="text-white font-bold text-sm flex items-center gap-2">
                    <span className="inline-block w-6 h-6 rounded-md bg-gradient-to-br from-purple-500 to-pink-500 text-center text-xs leading-6">✨</span>
                    Unlock the Premium Track
                  </p>
                  <p className="text-white/40 text-xs mt-0.5 ml-8">
                    Exclusive cosmetics, bonus tokens, and more at every tier.
                  </p>
                </div>
                <button
                  onClick={handlePurchasePremium}
                  disabled={purchasing}
                  className="px-5 py-2.5 rounded-lg font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  style={{ background: "linear-gradient(135deg, #a855f7, #ec4899)", color: "white" }}
                >
                  {purchasing ? "Redirecting…" : "Upgrade — $4.99"}
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-6xl mx-auto px-4 mt-4"
          >
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-red-400/40 hover:text-red-400 ml-4">✕</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium unlock celebration */}
      <AnimatePresence>
        {purchaseSuccess && (
          <PremiumUnlockModal
            seasonName={season.name}
            onDone={() => setPurchaseSuccess(false)}
          />
        )}
      </AnimatePresence>

      {/* How it works */}
      <div className="max-w-2xl mx-auto px-4 mt-10">
        <h2 className="text-sm font-bold text-white/60 tracking-wider uppercase mb-4">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: "🧩", title: "Solve Puzzles", desc: "Earn XP by completing any puzzle type", color: "#3891A6" },
            { icon: "📈", title: "Climb Tiers", desc: "Your XP unlocks new rewards each tier", color: "#FDE74C" },
            { icon: "🎁", title: "Claim Rewards", desc: "Collect tokens, points, and exclusive cosmetics", color: "#a855f7" },
          ].map((item) => (
            <div
              key={item.title}
              className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.03] transition-colors"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: `${item.color}15` }}>
                <span className="text-lg">{item.icon}</span>
              </div>
              <h3 className="text-white font-bold text-sm">{item.title}</h3>
              <p className="text-white/40 text-xs mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tier Track (vertical timeline) ─────────────────── */}
      <div className="max-w-2xl mx-auto px-4 mt-10" ref={trackRef}>
        {/* Section header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white/60 tracking-wider uppercase">Season Rewards</h2>
          <div className="flex gap-3 text-[10px] text-white/55">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400/70" /> Unlocked</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500/70" /> Claimed</span>
          </div>
        </div>

        {/* Track column headers */}
        <div className="grid grid-cols-[1fr_52px_1fr] mb-3">
          <div className="pr-3 flex justify-start">
            <span className="text-[11px] font-black tracking-widest uppercase text-yellow-400/55">🆓 Free</span>
          </div>
          <div />
          <div className="pl-3">
            {isPremium ? (
              <span className="text-[11px] font-black tracking-widest uppercase text-purple-400/65">✨ Premium ✓</span>
            ) : (
              <button
                onClick={handlePurchasePremium}
                disabled={purchasing}
                className="text-[11px] font-black tracking-widest uppercase text-purple-400/55 hover:text-purple-300 transition-colors disabled:opacity-40"
              >
                ✨ Premium{" "}<span className="text-purple-500/70">$4.99</span>
              </button>
            )}
          </div>
        </div>

        {/* Vertical timeline */}
        <div className="relative">
          {/* ── Premium column ambient purple haze ── */}
          <div
            className="absolute inset-y-0 right-0 pointer-events-none z-0"
            style={{
              width: "calc(50% - 26px)",
              background: "linear-gradient(180deg, rgba(88,28,135,0.0) 0%, rgba(88,28,135,0.07) 20%, rgba(88,28,135,0.07) 80%, rgba(88,28,135,0.0) 100%)",
            }}
          />
          {/* Right edge soft glow line */}
          <div
            className="absolute inset-y-0 right-0 w-[2px] pointer-events-none z-0"
            style={{
              background: "linear-gradient(180deg, transparent, rgba(168,85,247,0.18) 20%, rgba(168,85,247,0.18) 80%, transparent)",
            }}
          />
          {tiers.map((tier, i) => {
            const unlocked = xp >= tier.xpRequired;
            const isNext = !unlocked && (i === 0 || xp >= tiers[i - 1].xpRequired);
            const isMilestone = milestoneTiers.has(tier.tierNumber);
            const isCurrent = isNext;

            return (
              <TierRow
                key={tier.id}
                tier={tier}
                index={i}
                unlocked={unlocked}
                isNext={isNext}
                isMilestone={isMilestone}
                isCurrent={isCurrent}
                isLastUnlocked={tier.tierNumber === lastUnlockedTierNumber}
                isLast={i === tiers.length - 1}
                progressPct={progressPct}
                xp={xp}
                claimedFree={claimedFree}
                claimedPrem={claimedPrem}
                isPremium={isPremium}
                claiming={claiming}
                onClaim={handleClaim}
                onPreview={setPreviewKey}
              />
            );
          })}
        </div>
      </div>

      {/* Keyframes */}
      <style jsx global>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .animate-shimmer {
          animation: shimmer 2.8s infinite linear;
        }
        /* Track bead — all segments share the same duration+no delay so bead is continuous across rows */
        @keyframes track-bead {
          0%   { background: linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 12%, rgba(255,255,255,0) 24%); background-position: 0 -100%; }
          100% { background: linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 12%, rgba(255,255,255,0) 24%); background-position: 0 500%; }
        }
        .animate-track-bead {
          background: linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0) 100%);
          background-size: 100% 40px;
          background-repeat: no-repeat;
          animation: track-bead-move 2.4s linear infinite;
        }
        @keyframes track-bead-move {
          0%   { background-position: 0 -40px; }
          100% { background-position: 0 400px; }
        }
      `}</style>
    </div>
  );
}
