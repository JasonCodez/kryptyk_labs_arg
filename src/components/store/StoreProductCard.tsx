"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  Eye,
  CheckCircle2,
  Flame,
  Puzzle as PuzzleIcon,
  Swords,
  Users,
  Dices,
} from "lucide-react";

export interface StoreProductItem {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  price: number;
  isConsumable: boolean;
  iconEmoji: string;
  metadata: Record<string, unknown> | null;
  owned: number;
}

export interface StoreProductCardProps {
  item: StoreProductItem;
  displayName: string;
  equipped: boolean;
  canAfford: boolean;
  isBuying: boolean;
  isEquipping: boolean;
  tripleOrNothingActive: boolean;
  activatingTriple: boolean;
  onPreview: () => void;
  onPurchase: () => void;
  onEquip: () => void;
  onUnequip: () => void;
  onActivateTriple: () => void;
  onDeactivateTriple: () => void;
}

const SUBCATEGORY_LABELS: Record<string, string> = {
  token: "Token",
  slot: "Slot Upgrade",
  boost: "Boost",
  theme: "Profile Theme",
  team_theme: "Team Page Theme",
  frame: "Avatar Frame",
  skin: "Puzzle Style",
  flair: "Name Flair",
  banner: "Team Banner",
  name_color: "Name Color",
  anim: "Completion Animation",
};

const COSMETIC_SUBCATEGORIES = ["theme", "frame", "skin", "flair", "banner", "team_theme", "name_color", "anim"];
const PREVIEWABLE_SUBCATEGORIES = ["theme", "frame", "skin", "name_color"];

const CATEGORY_ACCENT: Record<string, { a: string; b: string; icon: typeof Flame }> = {
  streak: { a: "#3ED97A", b: "#0f2e1c", icon: Flame },
  puzzle: { a: "#2FE6E0", b: "#3a2c06", icon: PuzzleIcon },
  warz: { a: "#FF5A5A", b: "#3a0d0d", icon: Swords },
  social: { a: "#B98CFF", b: "#101a3a", icon: Users },
};

function getRarity(price: number): { label: string; color: string; glow: string } | null {
  // Thresholds scale with the 5x store price increase -- keep these in sync
  // with that multiplier so the rarity mix doesn't drift again next time.
  if (price >= 3500) return { label: "Legendary", color: "#FFC93C", glow: "rgba(255,201,60,0.3)" };
  if (price >= 2500) return { label: "Epic", color: "#8B3DFF", glow: "rgba(139,61,255,0.25)" };
  if (price >= 1750) return { label: "Rare", color: "#2FE6E0", glow: "rgba(47,230,224,0.2)" };
  return null;
}

function getItemAccent(item: StoreProductItem): string | null {
  const meta = item.metadata as Record<string, string> | null;
  return meta?.primaryColor ?? meta?.color ?? null;
}

function normalizeSkinValue(value: string | null | undefined): string {
  if (!value) return "";
  return value === "ice" || value === "skin_ice" ? "christmas" : value;
}

export function getStoreItemDisplayName(item: StoreProductItem): string {
  if (item.subcategory !== "skin") return item.name;
  const meta = item.metadata as { value?: string } | null;
  const skinValue = normalizeSkinValue(meta?.value ?? "");
  if (skinValue === "christmas" || skinValue === "skin_christmas") {
    if (/ice/i.test(item.name)) return item.name.replace(/ice/gi, "Christmas");
    if (!/christmas/i.test(item.name)) return "Christmas Skin";
  }
  return item.name;
}

function CosmeticPreviewStage({ item }: { item: StoreProductItem }) {
  const meta = item.metadata as Record<string, string> | null;
  const sub = item.subcategory;

  if (sub === "theme" || sub === "team_theme") {
    const p = meta?.primaryColor ?? "#FDE74C";
    const a = meta?.accentColor ?? "#FFB86B";
    return (
      <div className="rounded-xl h-28 md:h-32 relative flex items-end p-3 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${p}18, ${a}22, rgba(10,12,16,0.9))`, border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${p}25, ${a}18)`, borderBottom: `1px solid ${p}33` }} />
        <div className="relative flex items-center gap-2 w-full">
          <div className="w-9 h-9 rounded-full shrink-0" style={{ background: `linear-gradient(135deg, ${p}, ${a})`, boxShadow: `0 0 10px ${p}66` }} />
          <div className="min-w-0 flex-1">
            <div className="h-2 w-24 rounded-full mb-1.5" style={{ background: `linear-gradient(90deg, ${p}, ${a})` }} />
            <div className="h-1.5 w-14 rounded-full" style={{ backgroundColor: a, opacity: 0.45 }} />
          </div>
          <div className="ml-auto flex gap-1 shrink-0">
            {[p, a, "#ffffff22"].map((c, i) => (
              <div key={i} className="w-4 h-4 rounded" style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (sub === "frame") {
    const frameStyles: Record<string, { ring: string; glow: string }> = {
      gold: { ring: "linear-gradient(135deg, #FDE74C, #FFB86B, #FDE74C)", glow: "rgba(253,231,76,0.55)" },
      neon: { ring: "linear-gradient(135deg, #00FFFF, #CC00FF, #00FFFF)", glow: "rgba(0,255,255,0.45)" },
      flame: { ring: "linear-gradient(135deg, #FF4500, #FDE74C, #FF4500)", glow: "rgba(255,69,0,0.55)" },
    };
    const fs = frameStyles[meta?.value ?? ""] ?? frameStyles.gold;
    return (
      <div className="h-28 md:h-32 flex items-center justify-center rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full" style={{ background: fs.ring, padding: "3px", boxShadow: `0 0 22px ${fs.glow}` }}>
            <div className="w-full h-full rounded-full flex items-center justify-center text-2xl" style={{ background: "#0d1117" }}>
              👤
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (sub === "flair") {
    const emoji = meta?.emoji ?? item.iconEmoji;
    return (
      <div className="h-28 md:h-32 flex items-center justify-center rounded-xl"
        style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="font-extrabold text-white text-base tracking-wide">
          PlayerName <span className="text-lg">{emoji}</span>
        </p>
      </div>
    );
  }

  if (sub === "skin") {
    type SkinDef = { bg: string; border: string; cell: string; cellGlow: string; alt: string; label: string; accent: string; shadow: string };
    const skinDefs: Record<string, SkinDef> = {
      retro: { bg: "#0a0020", border: "#B43CFF", cell: "#B43CFF", cellGlow: "rgba(180,60,255,0.7)", alt: "#120030", label: "#00FF88", accent: "rgba(0,255,136,0.6)", shadow: "0 0 0 2px #B43CFF, 0 0 18px rgba(180,60,255,0.5)" },
      minimal: { bg: "#080808", border: "rgba(255,255,255,0.12)", cell: "rgba(255,255,255,0.55)", cellGlow: "none", alt: "rgba(255,255,255,0.05)", label: "#aaaaaa", accent: "rgba(255,255,255,0.3)", shadow: "none" },
      neon: { bg: "#050d1c", border: "#4FE5FF", cell: "#35DDFF", cellGlow: "rgba(79,229,255,0.45)", alt: "rgba(79,229,255,0.08)", label: "#B7F5FF", accent: "rgba(217,77,255,0.56)", shadow: "0 0 0 1px rgba(79,229,255,0.55), 0 0 14px rgba(79,229,255,0.28), inset 0 0 14px rgba(217,77,255,0.14)" },
      lava: { bg: "#060100", border: "#FF5500", cell: "#FF5500", cellGlow: "rgba(255,85,0,0.75)", alt: "rgba(255,85,0,0.07)", label: "#FF9030", accent: "rgba(255,160,0,0.65)", shadow: "0 0 0 2px #FF5500, 0 0 18px rgba(255,85,0,0.5)" },
      galaxy: { bg: "#04001a", border: "#8B5CF6", cell: "#8B5CF6", cellGlow: "rgba(139,92,246,0.75)", alt: "rgba(139,92,246,0.08)", label: "#D8B4FE", accent: "rgba(200,0,255,0.6)", shadow: "0 0 0 2px #8B5CF6, 0 0 18px rgba(139,92,246,0.55)" },
      christmas: { bg: "#000d1f", border: "#67E8F9", cell: "#67E8F9", cellGlow: "rgba(103,232,249,0.7)", alt: "rgba(103,232,249,0.06)", label: "#E0F9FF", accent: "rgba(103,232,249,0.5)", shadow: "0 0 0 2px #67E8F9, 0 0 18px rgba(103,232,249,0.45)" },
      skin_christmas: { bg: "#000d1f", border: "#67E8F9", cell: "#67E8F9", cellGlow: "rgba(103,232,249,0.7)", alt: "rgba(103,232,249,0.06)", label: "#E0F9FF", accent: "rgba(103,232,249,0.5)", shadow: "0 0 0 2px #67E8F9, 0 0 18px rgba(103,232,249,0.45)" },
      ice: { bg: "#000d1f", border: "#67E8F9", cell: "#67E8F9", cellGlow: "rgba(103,232,249,0.7)", alt: "rgba(103,232,249,0.06)", label: "#E0F9FF", accent: "rgba(103,232,249,0.5)", shadow: "0 0 0 2px #67E8F9, 0 0 18px rgba(103,232,249,0.45)" },
    };
    const normalizedSkinValue = normalizeSkinValue(meta?.value ?? "");
    const sd = skinDefs[normalizedSkinValue] ?? skinDefs.minimal;
    const tiles = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1];
    return (
      <div className="h-28 md:h-32 flex items-center justify-center rounded-xl overflow-hidden relative"
        style={{ backgroundColor: sd.bg, border: `1px solid ${sd.border}55`, boxShadow: sd.shadow }}>
        <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(4, 1.4rem)" }}>
          {tiles.map((filled, i) => (
            <div key={i} className="h-5 rounded-sm transition-all"
              style={{
                backgroundColor: filled ? sd.cell : sd.alt,
                border: `1px solid ${filled ? sd.border : sd.border}44`,
                boxShadow: filled ? `0 0 5px ${sd.cellGlow}` : "none",
              }} />
          ))}
        </div>
        <div className="absolute bottom-2 right-3 text-xs font-bold tracking-wider" style={{ color: sd.label, fontFamily: normalizedSkinValue === "retro" || normalizedSkinValue === "neon" ? "'Courier New', monospace" : "inherit" }}>
          {normalizedSkinValue.replace(/^skin_/, "").toUpperCase()}
        </div>
      </div>
    );
  }

  if (sub === "name_color") {
    const val = meta?.value ?? "";
    const isRainbow = val === "rainbow";
    return (
      <div className="h-28 md:h-32 flex items-center justify-center rounded-xl overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p
          className={`font-extrabold text-xl tracking-wide${isRainbow ? " rainbow-name" : ""}`}
          style={!isRainbow && val ? { color: val } : undefined}
        >
          PlayerName
        </p>
      </div>
    );
  }

  if (sub === "banner") {
    const color = meta?.color ?? "#FDE74C";
    return (
      <div className="h-28 md:h-32 flex items-center px-4 gap-3 rounded-xl overflow-hidden relative"
        style={{ background: `linear-gradient(135deg, ${color}18, rgba(10,12,16,0.9))`, border: `1px solid ${color}33` }}>
        <div className="w-1.5 self-stretch rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-white">Team Name</p>
          <p className="text-xs font-semibold mt-0.5" style={{ color }}>Banner Color Unlocked</p>
        </div>
        <div className="ml-auto w-7 h-7 rounded-full shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}88` }} />
      </div>
    );
  }

  // "anim" (completion animation) and any other cosmetic subcategory
  const emoji = item.iconEmoji || "✨";
  return (
    <div className="h-28 md:h-32 flex items-center justify-center rounded-xl relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, rgba(139,61,255,0.12), rgba(47,230,224,0.08))", border: "1px solid rgba(255,255,255,0.07)" }}>
      <span className="text-3xl" aria-hidden="true">{emoji}</span>
    </div>
  );
}

function PowerUpStage({ item }: { item: StoreProductItem }) {
  const accent = CATEGORY_ACCENT[item.category] ?? CATEGORY_ACCENT.puzzle;
  const AccentIcon = accent.icon;
  return (
    <div className="h-28 md:h-32 flex items-center justify-center rounded-xl relative overflow-hidden"
      style={{ background: `radial-gradient(circle at 50% 40%, ${accent.a}22 0%, ${accent.b}00 70%)`, border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <div className="w-20 h-20 rounded-full" style={{ border: `1px solid ${accent.a}33` }} />
        <div className="absolute w-14 h-14 rounded-full" style={{ border: `1px solid ${accent.a}44` }} />
      </div>
      <div className="relative flex flex-col items-center gap-1">
        <span className="text-3xl leading-none" aria-hidden="true">{item.iconEmoji}</span>
        <AccentIcon size={14} aria-hidden="true" style={{ color: accent.a }} />
      </div>
    </div>
  );
}

export default function StoreProductCard({
  item,
  displayName,
  equipped,
  canAfford,
  isBuying,
  isEquipping,
  tripleOrNothingActive,
  activatingTriple,
  onPreview,
  onPurchase,
  onEquip,
  onUnequip,
  onActivateTriple,
  onDeactivateTriple,
}: StoreProductCardProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;

  const owned = item.owned > 0;
  const isCosmetic = COSMETIC_SUBCATEGORIES.includes(item.subcategory);
  const isTeamTheme = item.subcategory === "team_theme";
  const isPreviewable = PREVIEWABLE_SUBCATEGORIES.includes(item.subcategory);
  const rarity = isCosmetic ? getRarity(item.price) : null;
  const accent = getItemAccent(item);
  const isTripleOrNothing = item.key === "triple_or_nothing";

  const showEquip = isCosmetic && !isTeamTheme && owned && !item.isConsumable && !equipped;
  const showUnequip = isCosmetic && !isTeamTheme && owned && !item.isConsumable && equipped;
  const showBuy = item.isConsumable || !owned;

  const entranceInitial = prefersReducedMotion ? false : { opacity: 0, y: 8 };
  const entranceAnimate = prefersReducedMotion ? undefined : { opacity: 1, y: 0 };
  const hoverAnimate = prefersReducedMotion ? undefined : { y: -3 };

  const borderColor = equipped
    ? "rgba(255,201,60,0.6)"
    : rarity
      ? `${rarity.color}55`
      : owned
        ? "rgba(62,217,122,0.25)"
        : "rgba(255,255,255,0.1)";

  const glowColor = equipped
    ? "0 0 20px rgba(255,201,60,0.18)"
    : rarity && owned
      ? `0 0 20px ${rarity.glow}`
      : undefined;

  return (
    <motion.article
      aria-label={displayName}
      initial={entranceInitial}
      animate={entranceAnimate}
      whileHover={hoverAnimate}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="rounded-2xl p-4 min-[390px]:p-5 flex flex-col gap-3 relative overflow-hidden shadow-skeu-panel min-w-0"
      style={{
        backgroundColor: "rgba(36,22,64,0.97)",
        border: `1px solid ${borderColor}`,
        boxShadow: glowColor,
      }}
    >
      <span className="game-gloss-overlay" aria-hidden="true" style={{ opacity: 0.5 }} />

      {rarity && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 rounded-t-2xl"
          style={{ background: `linear-gradient(90deg, transparent, ${rarity.color}, transparent)` }}
        />
      )}

      {/* Preview / power-up stage */}
      <div className="relative">
        {isCosmetic ? <CosmeticPreviewStage item={item} /> : <PowerUpStage item={item} />}
        {rarity && (
          <span
            className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full font-bold"
            style={{ backgroundColor: `${rarity.color}25`, color: rarity.color, border: `1px solid ${rarity.color}55` }}
          >
            {rarity.label}
          </span>
        )}
      </div>

      {/* Status line */}
      {(equipped || (owned && !item.isConsumable) || (item.isConsumable && owned)) && (
        <div className="relative flex items-center gap-1.5 text-xs font-bold" style={{ minHeight: 18 }}>
          {equipped && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(255,201,60,0.2)", color: "#FFC93C" }}>
              <CheckCircle2 size={12} aria-hidden="true" /> Equipped
            </span>
          )}
          {!equipped && owned && !item.isConsumable && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(62,217,122,0.14)", color: "#3ED97A" }}>
              <CheckCircle2 size={12} aria-hidden="true" /> Owned
            </span>
          )}
          {item.isConsumable && owned && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(139,61,255,0.15)", color: "#B98CFF" }}>
              Owned ×{item.owned.toLocaleString()}
            </span>
          )}
        </div>
      )}

      {/* Identity */}
      <div className="relative min-w-0">
        <h3 className="font-bold text-white text-sm leading-tight break-words">{displayName}</h3>
        <p className="text-xs mt-0.5 break-words" style={{ color: accent ?? "#6b7280" }}>
          {SUBCATEGORY_LABELS[item.subcategory] ?? item.subcategory}
          {item.isConsumable && " · Consumable"}
        </p>
      </div>

      <p className="relative text-xs leading-relaxed flex-1 break-words" style={{ color: "#DDDBF1" }}>
        {item.description}
      </p>

      {/* Price */}
      <p className="relative font-extrabold text-sm break-all" style={{ color: canAfford ? "#FFC93C" : "#9ca3af" }}>
        {item.price.toLocaleString()} pts
      </p>

      {/* Actions */}
      <div className="relative flex flex-col min-[360px]:flex-row flex-wrap gap-2">
        {isPreviewable && (
          <button
            onClick={onPreview}
            className="flex-1 min-[360px]:flex-none flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-semibold transition-all"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.1)", minHeight: 44 }}
          >
            <Eye size={14} aria-hidden="true" /> Preview
          </button>
        )}

        {showBuy && (
          <button
            onClick={onPurchase}
            disabled={!canAfford || isBuying}
            className="flex-1 min-[360px]:flex-none flex items-center justify-center px-3 rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(135deg, #FFE58A, #FFC93C)",
              color: "#1a1400",
              minHeight: 44,
            }}
          >
            {isBuying ? "…" : "Buy"}
          </button>
        )}

        {showEquip && (
          <button
            onClick={onEquip}
            disabled={isEquipping}
            className="flex-1 min-[360px]:flex-none flex items-center justify-center px-3 rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #FFE58A, #FFC93C)", color: "#1a1400", minHeight: 44 }}
          >
            {isEquipping ? "…" : "Equip"}
          </button>
        )}

        {showUnequip && (
          <button
            onClick={onUnequip}
            disabled={isEquipping}
            className="flex-1 min-[360px]:flex-none flex items-center justify-center px-3 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: "rgba(255,255,255,0.07)", color: "#9ca3af", minHeight: 44 }}
          >
            {isEquipping ? "…" : "Unequip"}
          </button>
        )}

        {isTripleOrNothing && owned && (
          tripleOrNothingActive ? (
            <button
              onClick={onDeactivateTriple}
              disabled={activatingTriple}
              className="flex-1 min-[360px]:flex-none flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "rgba(255,90,90,0.15)", color: "#FF5A5A", border: "1px solid rgba(255,90,90,0.3)", minHeight: 44 }}
            >
              <Dices size={14} aria-hidden="true" /> Active — Cancel
            </button>
          ) : (
            <button
              onClick={onActivateTriple}
              disabled={activatingTriple}
              className="flex-1 min-[360px]:flex-none flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "rgba(255,201,60,0.12)", color: "#FFC93C", border: "1px solid rgba(255,201,60,0.25)", minHeight: 44 }}
            >
              {activatingTriple ? "…" : <><Dices size={14} aria-hidden="true" /> Activate</>}
            </button>
          )
        )}
      </div>
    </motion.article>
  );
}
