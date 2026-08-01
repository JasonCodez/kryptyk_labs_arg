"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Gem,
  Gift,
  Lightbulb,
  ShieldCheck,
  SkipForward,
  Swords,
  Repeat,
  Dices,
  Sparkles,
  Zap,
  ShoppingBag,
  Flame,
  Puzzle as PuzzleIcon,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface StoreWalletUser {
  streakShields: number;
  hintTokens: number;
  skipTokens: number;
  warzChallengeSlots: number;
  warzRematchTokens: number;
  tripleOrNothingTokens: number;
  tripleOrNothingActive: boolean;
  xpBoostExpiresAt: string | null;
}

export interface StorefrontHeroProps {
  balance: number;
  user: StoreWalletUser | null;
  loading: boolean;
  showGlow: boolean;
  onGiftPoints: () => void;
}

export interface StoreCategory {
  key: string;
  label: string;
}

export interface StoreCategoryRailProps {
  categories: StoreCategory[];
  activeCategory: string;
  onCategoryChange: (key: string) => void;
}

/** Smoothly counts from one number to another; jumps straight to the target under reduced motion. */
function useAnimatedCounter(target: number, prefersReducedMotion: boolean, duration = 1200) {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    const from = prevRef.current;
    if (from === target) return;
    prevRef.current = target;

    if (prefersReducedMotion) {
      setDisplay(target);
      return;
    }

    const startTime = performance.now();
    let raf: number;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, prefersReducedMotion]);

  return display;
}

function AnimatedBalance({ value, prefersReducedMotion }: { value: number; prefersReducedMotion: boolean }) {
  const display = useAnimatedCounter(value, prefersReducedMotion);
  return <span>{display.toLocaleString()}</span>;
}

interface WalletCell {
  key: string;
  label: string;
  value: number;
  icon: LucideIcon;
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  all: ShoppingBag,
  streak: Flame,
  puzzle: PuzzleIcon,
  warz: Swords,
  cosmetic: Sparkles,
  social: Users,
};

export default function StorefrontHero({ balance, user, loading, showGlow, onGiftPoints }: StorefrontHeroProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;

  const walletCells: WalletCell[] = [
    { key: "hintTokens", label: "Hint Tokens", value: user?.hintTokens ?? 0, icon: Lightbulb },
    { key: "streakShields", label: "Streak Shields", value: user?.streakShields ?? 0, icon: ShieldCheck },
    { key: "skipTokens", label: "Skip Tokens", value: user?.skipTokens ?? 0, icon: SkipForward },
    { key: "warzChallengeSlots", label: "Warz Slots", value: user?.warzChallengeSlots ?? 0, icon: Swords },
    { key: "warzRematchTokens", label: "Rematch Tokens", value: user?.warzRematchTokens ?? 0, icon: Repeat },
    { key: "tripleOrNothingTokens", label: "Triple Tokens", value: user?.tripleOrNothingTokens ?? 0, icon: Dices },
  ];

  const xpBoostActive =
    !!user?.xpBoostExpiresAt &&
    new Date(user.xpBoostExpiresAt).getTime() > Date.now();
  const tripleActive = !!user?.tripleOrNothingActive;

  const entranceInitial = prefersReducedMotion ? false : { opacity: 0, y: 16 };
  const entranceAnimate = prefersReducedMotion ? undefined : { opacity: 1, y: 0 };

  return (
    <motion.section
      initial={entranceInitial}
      animate={entranceAnimate}
      transition={{ duration: 0.5, ease: "easeOut" }}
      aria-label="Storefront"
      className="mb-8 lg:flex lg:items-start lg:gap-10"
    >
      {/* Identity */}
      <div className="lg:flex-1">
        <p className="text-xs font-bold tracking-[0.2em] uppercase mb-2" style={{ color: "#2FE6E0" }}>
          PuzzleWarz Point Store
        </p>
        <h1 className="font-black text-white mb-3 text-3xl min-[390px]:text-4xl lg:text-5xl xl:text-6xl leading-tight">
          THE VAULT
        </h1>
        <p className="text-sm min-[390px]:text-base max-w-md" style={{ color: "#AB9F9D" }}>
          Power up your play. Collect rare cosmetics. Spend what you earned.
        </p>
      </div>

      {/* Wallet command center */}
      <div className="mt-6 lg:mt-0 lg:w-[380px] lg:shrink-0 flex flex-col gap-4" aria-busy={loading}>
        {/* Balance panel */}
        <motion.div
          className="relative overflow-hidden rounded-2xl px-4 min-[390px]:px-5 py-4 shadow-skeu-panel"
          style={{
            background: "linear-gradient(145deg, rgba(36,22,64,0.97) 0%, rgba(50,32,90,0.97) 100%)",
            border: "1px solid rgba(255,201,60,0.25)",
          }}
          animate={
            showGlow && !prefersReducedMotion
              ? {
                  boxShadow: ["0 0 0px rgba(255,201,60,0)", "0 0 40px rgba(255,201,60,0.5)", "0 0 16px rgba(255,201,60,0.15)"],
                  borderColor: ["rgba(255,201,60,0.25)", "rgba(255,201,60,0.9)", "rgba(255,201,60,0.35)"],
                }
              : {}
          }
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <span className="game-gloss-overlay" aria-hidden style={{ opacity: 0.5 }} />
          <div className="relative flex items-center gap-2 mb-1">
            <Gem size={16} aria-hidden="true" style={{ color: "#FFC93C" }} />
            <p className="text-sm font-semibold" style={{ color: "#AB9F9D" }}>
              Available Balance
            </p>
          </div>
          {loading ? (
            <div className="relative h-10 w-40 rounded-lg animate-pulse" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
          ) : (
            <p className="relative text-3xl min-[390px]:text-4xl font-extrabold break-all" style={{ color: "#FFC93C" }}>
              <AnimatedBalance value={balance} prefersReducedMotion={prefersReducedMotion} />{" "}
              <span className="text-base font-semibold">pts</span>
            </p>
          )}
          <p className="relative text-xs mt-1.5" style={{ color: "#6b7280" }}>
            Earned and spendable rewards
          </p>

          {(tripleActive || xpBoostActive) && (
            <div className="relative flex flex-wrap gap-2 mt-3">
              {tripleActive && (
                <span
                  className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: "rgba(255,201,60,0.15)", color: "#FFC93C" }}
                >
                  <Dices size={12} aria-hidden="true" /> Triple-or-Nothing Active
                </span>
              )}
              {xpBoostActive && (
                <span
                  className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: "rgba(139,61,255,0.18)", color: "#B98CFF" }}
                >
                  <Zap size={12} aria-hidden="true" /> 2× XP Boost Active
                </span>
              )}
            </div>
          )}
        </motion.div>

        {/* Inventory summary */}
        <div
          className="grid grid-cols-2 min-[380px]:grid-cols-3 gap-2 rounded-2xl p-3 shadow-skeu-panel"
          style={{ backgroundColor: "rgba(36,22,64,0.9)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {walletCells.map((cell) => {
            const Icon = cell.icon;
            return (
              <div
                key={cell.key}
                className="rounded-xl px-2 py-2 flex flex-col items-start gap-1 min-w-0"
                style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <Icon size={14} aria-hidden="true" style={{ color: "#2FE6E0" }} />
                <span className="text-[11px] leading-tight font-semibold break-words" style={{ color: "#9ca3af" }}>
                  {cell.label}
                </span>
                {loading ? (
                  <span className="h-4 w-10 rounded animate-pulse block" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
                ) : (
                  <span className="text-sm font-extrabold break-all text-white">{cell.value.toLocaleString()}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Gift Points */}
        <button
          onClick={onGiftPoints}
          className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all hover:opacity-90"
          style={{
            backgroundColor: "rgba(255,201,60,0.12)",
            color: "#FFC93C",
            border: "1px solid rgba(255,201,60,0.3)",
            minHeight: 44,
          }}
        >
          <Gift size={16} aria-hidden="true" />
          Gift Points
        </button>
      </div>
    </motion.section>
  );
}

export function StoreCategoryRail({ categories, activeCategory, onCategoryChange }: StoreCategoryRailProps) {
  return (
    <div
      role="tablist"
      aria-label="Store categories"
      className="flex gap-2 overflow-x-auto pb-1 mb-8 px-4 -mx-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:justify-center lg:justify-start"
      style={{ scrollbarWidth: "thin" }}
    >
      {categories.map((cat) => {
        const Icon = CATEGORY_ICONS[cat.key] ?? ShoppingBag;
        const active = activeCategory === cat.key;
        return (
          <button
            key={cat.key}
            role="tab"
            aria-selected={active}
            onClick={() => onCategoryChange(cat.key)}
            className="shrink-0 flex items-center gap-1.5 whitespace-nowrap px-4 rounded-xl text-sm font-semibold transition-all"
            style={{
              minHeight: 44,
              backgroundColor: active ? "rgba(255,201,60,0.18)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${active ? "rgba(255,201,60,0.5)" : "rgba(255,255,255,0.1)"}`,
              color: active ? "#FFC93C" : "#9ca3af",
              boxShadow: active ? "inset 0 1px 0 rgba(255,255,255,0.15)" : undefined,
            }}
          >
            <Icon size={15} aria-hidden="true" />
            {cat.label}
          </button>
        );
      })}
      <span className="shrink-0 w-1" aria-hidden="true" />
    </div>
  );
}
