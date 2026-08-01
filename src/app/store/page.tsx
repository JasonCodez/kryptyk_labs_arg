"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import CosmeticPreviewModal from "@/components/CosmeticPreviewModal";
import { FEATURE_STORE_ENABLED } from "@/lib/featureFlags";
import { juice } from "@/lib/juice";
import GameButton from "@/components/game-ui/GameButton";
import StorefrontHero, { StoreCategoryRail } from "@/components/store/StorefrontHero";

interface StoreItem {
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

interface StoreUser {
  totalPoints: number;
  activeTheme: string;
  activeFrame: string;
  activeSkin: string;
  activeFlair: string;
  teamBannerColor: string;
  activeNameColor: string;
  activeCompletionAnimation: string;
  streakShields: number;
  hintTokens: number;
  skipTokens: number;
  warzChallengeSlots: number;
  warzRematchTokens: number;
  tripleOrNothingTokens: number;
  tripleOrNothingActive: boolean;
  xpBoostExpiresAt: string | null;
}

const CATEGORIES = [
  { key: "all",      label: "All Items",    emoji: "🛍️" },
  { key: "streak",   label: "Streak",       emoji: "🔥" },
  { key: "puzzle",   label: "Puzzle",       emoji: "🧩" },
  { key: "warz",     label: "Warz",         emoji: "⚔️" },
  { key: "cosmetic", label: "Cosmetics",    emoji: "✨" },
  { key: "social",   label: "Team",         emoji: "🏆" },
];

const POINT_BUNDLES = [
  { key: "starter_pack", emoji: "💰", name: "Starter Pack",   points: 500,  price: "$1.99", popular: false },
  { key: "value_pack",   emoji: "💎", name: "Value Pack",     points: 1700, price: "$4.99", popular: true,  bonus: "+200 bonus" },
  { key: "pro_pack",     emoji: "🏆", name: "Pro Pack",       points: 4000, price: "$9.99", popular: false, bonus: "+500 bonus" },
  { key: "elite_pack",   emoji: "👑", name: "Elite Pack",     points: 9000, price: "$19.99", popular: false, bonus: "+1,000 bonus" },
];

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

function getActiveValue(item: StoreItem, user: StoreUser): string | null {
  if (item.subcategory === "theme") return user.activeTheme;
  if (item.subcategory === "frame") return user.activeFrame;
  if (item.subcategory === "skin") return user.activeSkin;
  if (item.subcategory === "flair") return user.activeFlair;
  if (item.subcategory === "banner") return user.teamBannerColor;
  if (item.subcategory === "name_color") return user.activeNameColor;
  if (item.subcategory === "anim") return user.activeCompletionAnimation;
  return null;
}

function isEquipped(item: StoreItem, user: StoreUser): boolean {
  const meta = item.metadata as { value?: string; emoji?: string } | null;
  // Flair items store the emoji in activeFlair; other items store the plain value.
  const value = item.subcategory === "flair"
    ? (meta?.emoji ?? meta?.value ?? item.key)
    : (meta?.value ?? item.key);
  const active = getActiveValue(item, user);
  return active !== null && active === value;
}

function getRarity(price: number): { label: string; color: string; glow: string } | null {
  // Thresholds scale with the 5x store price increase -- keep these in sync
  // with that multiplier so the rarity mix doesn't drift again next time.
  if (price >= 3500) return { label: "Legendary", color: "#FFC93C", glow: "rgba(255,201,60,0.3)" };
  if (price >= 2500) return { label: "Epic",       color: "#8B3DFF", glow: "rgba(139,61,255,0.25)" };
  if (price >= 1750) return { label: "Rare",       color: "#2FE6E0", glow: "rgba(47,230,224,0.2)" };
  return null;
}

function getItemAccent(item: StoreItem): string | null {
  const meta = item.metadata as Record<string, string> | null;
  return meta?.primaryColor ?? meta?.color ?? null;
}

function normalizeSkinValue(value: string | null | undefined): string {
  if (!value) return "";
  return value === "ice" || value === "skin_ice" ? "christmas" : value;
}

function getStoreItemDisplayName(item: StoreItem): string {
  if (item.subcategory !== "skin") return item.name;
  const meta = item.metadata as { value?: string } | null;
  const skinValue = normalizeSkinValue(meta?.value ?? "");
  if (skinValue === "christmas" || skinValue === "skin_christmas") {
    if (/ice/i.test(item.name)) return item.name.replace(/ice/gi, "Christmas");
    if (!/christmas/i.test(item.name)) return "Christmas Skin";
  }
  return item.name;
}

function CosmeticPreview({ item }: { item: StoreItem }) {
  const meta = item.metadata as Record<string, string> | null;
  const sub = item.subcategory;

  if (sub === "theme" || sub === "team_theme") {
    const p = meta?.primaryColor ?? "#FDE74C";
    const a = meta?.accentColor ?? "#FFB86B";
    return (
      <div className="rounded-xl h-16 relative mb-3 flex items-end p-2.5 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${p}18, ${a}22, rgba(10,12,16,0.9))` }}>
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${p}25, ${a}18)`, borderBottom: `1px solid ${p}33` }} />
        <div className="relative flex items-center gap-2">
          <div className="w-7 h-7 rounded-full shrink-0" style={{ background: `linear-gradient(135deg, ${p}, ${a})`, boxShadow: `0 0 8px ${p}66` }} />
          <div>
            <div className="h-2 w-20 rounded-full mb-1.5" style={{ background: `linear-gradient(90deg, ${p}, ${a})` }} />
            <div className="h-1.5 w-12 rounded-full" style={{ backgroundColor: a, opacity: 0.45 }} />
          </div>
          <div className="ml-auto flex gap-1">
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
      gold:  { ring: "linear-gradient(135deg, #FDE74C, #FFB86B, #FDE74C)", glow: "rgba(253,231,76,0.55)" },
      neon:  { ring: "linear-gradient(135deg, #00FFFF, #CC00FF, #00FFFF)",  glow: "rgba(0,255,255,0.45)" },
      flame: { ring: "linear-gradient(135deg, #FF4500, #FDE74C, #FF4500)",  glow: "rgba(255,69,0,0.55)" },
    };
    const fs = frameStyles[meta?.value ?? ""] ?? frameStyles.gold;
    return (
      <div className="h-16 flex items-center justify-center mb-3">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full" style={{ background: fs.ring, padding: "3px", boxShadow: `0 0 18px ${fs.glow}` }}>
            <div className="w-full h-full rounded-full flex items-center justify-center text-lg" style={{ background: "#0d1117" }}>
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
      <div className="h-16 flex items-center justify-center mb-3 rounded-xl"
        style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="font-extrabold text-white text-sm tracking-wide">
          PlayerName <span className="text-base">{emoji}</span>
        </p>
      </div>
    );
  }

  if (sub === "skin") {
    type SkinDef = { bg: string; border: string; cell: string; cellGlow: string; alt: string; label: string; accent: string; shadow: string };
    const skinDefs: Record<string, SkinDef> = {
      retro:   { bg: "#0a0020",  border: "#B43CFF", cell: "#B43CFF",  cellGlow: "rgba(180,60,255,0.7)",  alt: "#120030", label: "#00FF88", accent: "rgba(0,255,136,0.6)", shadow: "0 0 0 2px #B43CFF, 0 0 18px rgba(180,60,255,0.5)" },
      minimal: { bg: "#080808",  border: "rgba(255,255,255,0.12)", cell: "rgba(255,255,255,0.55)", cellGlow: "none", alt: "rgba(255,255,255,0.05)", label: "#aaaaaa", accent: "rgba(255,255,255,0.3)", shadow: "none" },
      neon:    { bg: "#050d1c",  border: "#4FE5FF", cell: "#35DDFF",  cellGlow: "rgba(79,229,255,0.45)",  alt: "rgba(79,229,255,0.08)", label: "#B7F5FF", accent: "rgba(217,77,255,0.56)", shadow: "0 0 0 1px rgba(79,229,255,0.55), 0 0 14px rgba(79,229,255,0.28), inset 0 0 14px rgba(217,77,255,0.14)" },
      lava:    { bg: "#060100",  border: "#FF5500", cell: "#FF5500",  cellGlow: "rgba(255,85,0,0.75)",  alt: "rgba(255,85,0,0.07)",  label: "#FF9030", accent: "rgba(255,160,0,0.65)", shadow: "0 0 0 2px #FF5500, 0 0 18px rgba(255,85,0,0.5)" },
      galaxy:  { bg: "#04001a",  border: "#8B5CF6", cell: "#8B5CF6",  cellGlow: "rgba(139,92,246,0.75)", alt: "rgba(139,92,246,0.08)", label: "#D8B4FE", accent: "rgba(200,0,255,0.6)", shadow: "0 0 0 2px #8B5CF6, 0 0 18px rgba(139,92,246,0.55)" },
      christmas: { bg: "#000d1f",  border: "#67E8F9", cell: "#67E8F9",  cellGlow: "rgba(103,232,249,0.7)", alt: "rgba(103,232,249,0.06)", label: "#E0F9FF", accent: "rgba(103,232,249,0.5)", shadow: "0 0 0 2px #67E8F9, 0 0 18px rgba(103,232,249,0.45)" },
      skin_christmas: { bg: "#000d1f",  border: "#67E8F9", cell: "#67E8F9",  cellGlow: "rgba(103,232,249,0.7)", alt: "rgba(103,232,249,0.06)", label: "#E0F9FF", accent: "rgba(103,232,249,0.5)", shadow: "0 0 0 2px #67E8F9, 0 0 18px rgba(103,232,249,0.45)" },
      ice:     { bg: "#000d1f",  border: "#67E8F9", cell: "#67E8F9",  cellGlow: "rgba(103,232,249,0.7)", alt: "rgba(103,232,249,0.06)", label: "#E0F9FF", accent: "rgba(103,232,249,0.5)", shadow: "0 0 0 2px #67E8F9, 0 0 18px rgba(103,232,249,0.45)" },
    };
    const normalizedSkinValue = normalizeSkinValue(meta?.value ?? "");
    const sd = skinDefs[normalizedSkinValue] ?? skinDefs.minimal;
    const tiles = [1,0,1,0,1,1,0,1,0,1,1,0,1,0,0,1];
    return (
      <div className="h-16 flex items-center justify-center mb-3 rounded-xl overflow-hidden relative"
        style={{ backgroundColor: sd.bg, border: `1px solid ${sd.border}55`, boxShadow: sd.shadow }}>
        <div className="grid gap-0.5" style={{ gridTemplateColumns: "repeat(4, 1.1rem)" }}>
          {tiles.map((filled, i) => (
            <div key={i} className="h-4 rounded-sm transition-all"
              style={{
                backgroundColor: filled ? sd.cell : sd.alt,
                border: `1px solid ${filled ? sd.border : sd.border}44`,
                boxShadow: filled ? `0 0 5px ${sd.cellGlow}` : "none",
              }} />
          ))}
        </div>
        <div className="absolute bottom-1.5 right-2.5 text-xs font-bold tracking-wider" style={{ color: sd.label, fontFamily: normalizedSkinValue === "retro" || normalizedSkinValue === "neon" ? "'Courier New', monospace" : "inherit" }}>
          {normalizedSkinValue.replace(/^skin_/, "").toUpperCase()}
        </div>
      </div>
    );
  }

  if (sub === "name_color") {
    const val = meta?.value ?? "";
    const isRainbow = val === "rainbow";
    return (
      <div className="h-16 flex items-center justify-center mb-3 rounded-xl overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p
          className={`font-extrabold text-lg tracking-wide${isRainbow ? " rainbow-name" : ""}`}
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
      <div className="h-16 flex items-center px-3 gap-3 rounded-xl overflow-hidden mb-3 relative"
        style={{ background: `linear-gradient(135deg, ${color}18, rgba(10,12,16,0.9))`, border: `1px solid ${color}33` }}>
        <div className="w-1.5 self-stretch rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
        <div>
          <p className="text-xs font-extrabold text-white">Team Name</p>
          <p className="text-xs font-semibold mt-0.5" style={{ color }}>Banner Color Unlocked</p>
        </div>
        <div className="ml-auto w-6 h-6 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}88` }} />
      </div>
    );
  }

  return null;
}

function StorePageInner() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<StoreItem[]>([]);
  const [user, setUser] = useState<StoreUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [equipping, setEquipping] = useState<string | null>(null);
  const [buyingBundle, setBuyingBundle] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<{ points: number; bundleKey: string } | null>(null);
  const [balancePoints, setBalancePoints] = useState(0);
  const [showGlow, setShowGlow] = useState(false);
  const [previewItem, setPreviewItem] = useState<StoreItem | null>(null);
  const [activatingTriple, setActivatingTriple] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftUsername, setGiftUsername] = useState("");
  const [giftAmount, setGiftAmount] = useState("");
  const [sendingGift, setSendingGift] = useState(false);

  // Keep displayed balance in sync during normal browsing; freeze it while modal is open
  useEffect(() => {
    if (!purchaseSuccess) setBalancePoints(user?.totalPoints ?? 0);
  }, [user?.totalPoints, purchaseSuccess]);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchStore = useCallback(async () => {
    try {
      const res = await fetch("/api/store", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? []);
      setUser(data.user ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") fetchStore();
    else if (status === "unauthenticated") setLoading(false);
  }, [status, fetchStore]);

  // Handle Stripe redirect back to the store
  useEffect(() => {
    const purchase = searchParams.get("purchase");
    const bundle = searchParams.get("bundle");
    const sessionId = searchParams.get("session_id");
    const BUNDLE_POINTS: Record<string, number> = {
      starter_pack: 500, value_pack: 1700, pro_pack: 4000, elite_pack: 9000,
    };
    if (purchase === "success") {
      juice.reward();
      setPurchaseSuccess({ points: BUNDLE_POINTS[bundle ?? ""] ?? 0, bundleKey: bundle ?? "" });
      router.replace("/store");
      // Verify + credit points idempotently (fallback if webhook fires late or not at all)
      if (sessionId) {
        fetch("/api/stripe/verify-purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        }).finally(() => fetchStore());
      } else {
        fetchStore();
      }
    } else if (purchase === "cancelled") {
      showToast("Purchase cancelled.", "error");
      router.replace("/store");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleBuyBundle = async (bundleKey: string) => {
    if (buyingBundle) return;
    setBuyingBundle(bundleKey);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundleKey }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        showToast(data.error ?? "Failed to start checkout", "error");
        return;
      }
      window.location.href = data.url;
    } finally {
      setBuyingBundle(null);
    }
  };

  const handlePurchase = async (item: StoreItem) => {
    if (purchasing) return;
    setPurchasing(item.key);
    try {
      const res = await fetch("/api/store/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemKey: item.key }),
      });
      const data = await res.json();
      if (!res.ok) {
        juice.error();
        showToast(data.error ?? "Purchase failed", "error");
        return;
      }
      juice.reward();
      showToast(`${item.iconEmoji} ${getStoreItemDisplayName(item)} purchased!`);
      fetchStore();
    } finally {
      setPurchasing(null);
    }
  };

  const handleEquip = async (item: StoreItem, unequip = false) => {
    if (equipping) return;
    setEquipping(item.key);
    try {
      const res = await fetch("/api/store/equip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemKey: unequip ? `unequip_${item.subcategory}` : item.key }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Failed to equip", "error");
        return;
      }
      showToast(unequip ? "Unequipped" : `${item.iconEmoji} ${getStoreItemDisplayName(item)} equipped!`);
      fetchStore();
    } finally {
      setEquipping(null);
    }
  };

  const handleActivateTriple = async () => {
    if (activatingTriple) return;
    setActivatingTriple(true);
    try {
      const res = await fetch("/api/store/use/triple-or-nothing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activate: true }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Failed to activate", "error"); return; }
      showToast("🎲 Triple-or-Nothing activated! Solve your next puzzle on the first try for 3× rewards.");
      fetchStore();
    } finally {
      setActivatingTriple(false);
    }
  };

  const handleDeactivateTriple = async () => {
    await fetch("/api/store/use/triple-or-nothing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activate: false }),
    });
    fetchStore();
  };

  const handleSendGift = async () => {
    if (sendingGift) return;
    const amount = parseInt(giftAmount, 10);
    if (!giftUsername.trim() || !amount) { showToast("Enter a username and amount", "error"); return; }
    setSendingGift(true);
    try {
      const res = await fetch("/api/social/gift-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUsername: giftUsername.trim(), amount }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Failed to send gift", "error"); return; }
      showToast(`🎁 Sent ${amount} pts to ${data.to}!`);
      setGiftUsername("");
      setGiftAmount("");
      setShowGiftModal(false);
      fetchStore();
    } finally {
      setSendingGift(false);
    }
  };

  const filtered = activeCategory === "all"
    ? items
    : items.filter((i) => i.category === activeCategory);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/auth/signin');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (!FEATURE_STORE_ENABLED) router.replace('/dashboard');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!FEATURE_STORE_ENABLED) return null;
  if (status === "unauthenticated") return null;

  return (
    <div className="min-h-screen px-4 pt-28 pb-12 relative overflow-x-hidden" style={{ backgroundColor: "#170B26" }}>
      {/* Layered vault backdrop */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(139,61,255,0.16) 0%, rgba(139,61,255,0) 70%)" }}
        />
        <div
          className="absolute -top-16 -right-24 w-[420px] h-[420px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(255,201,60,0.12) 0%, rgba(255,201,60,0) 70%)" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, #1c0f30 0%, #170B26 45%, #0d0714 100%)" }}
        />
      </div>

      <div className="max-w-5xl mx-auto relative">

        <StorefrontHero
          balance={balancePoints}
          user={user}
          loading={loading}
          showGlow={showGlow}
          onGiftPoints={() => setShowGiftModal(true)}
        />

        {/* Gift Points Modal */}
        {showGiftModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowGiftModal(false)}>
            <div className="rounded-2xl border p-6 w-full max-w-sm mx-4" style={{ borderColor: "rgba(255,201,60,0.3)", backgroundColor: "rgba(23,11,38,0.98)" }} onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">🎁 Gift Points</h3>
                <button onClick={() => setShowGiftModal(false)} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
              </div>
              <p className="text-sm mb-4" style={{ color: "#AB9F9D" }}>Send points to any player. Minimum 10 pts, maximum 5,000 pts.</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "#6b7280" }}>Username</label>
                  <input
                    type="text"
                    value={giftUsername}
                    onChange={e => setGiftUsername(e.target.value)}
                    placeholder="Player username..."
                    className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none"
                    style={{ backgroundColor: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "#6b7280" }}>Amount (pts)</label>
                  <input
                    type="number"
                    value={giftAmount}
                    onChange={e => setGiftAmount(e.target.value)}
                    placeholder="e.g. 100"
                    min={10}
                    max={5000}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none"
                    style={{ backgroundColor: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
                  />
                </div>
                <GameButton
                  variant="gold"
                  size="sm"
                  fullWidth
                  disabled={sendingGift}
                  onClick={handleSendGift}
                >
                  {sendingGift ? "Sending…" : "🎁 Send Gift"}
                </GameButton>
              </div>
            </div>
          </div>
        )}

        {/* Buy Points section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-bold text-white">💳 Buy Points</h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ backgroundColor: "rgba(47,230,224,0.15)", color: "#2FE6E0" }}>
              Real money → in-game points
            </span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {POINT_BUNDLES.map((bundle) => (
              <div
                key={bundle.key}
                className="relative overflow-hidden rounded-2xl p-4 flex flex-col gap-2 shadow-skeu-panel"
                style={{
                  backgroundColor: bundle.popular ? "rgba(47,230,224,0.12)" : "rgba(36,22,64,0.95)",
                  border: `1px solid ${bundle.popular ? "rgba(47,230,224,0.5)" : "rgba(255,255,255,0.1)"}`,
                  boxShadow: bundle.popular ? "0 0 16px rgba(47,230,224,0.1)" : undefined,
                }}
              >
                <span className="game-gloss-overlay" aria-hidden style={{ opacity: 0.5 }} />
                {bundle.popular && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap z-10"
                    style={{ backgroundColor: "#2FE6E0", color: "#0B2E2C" }}>
                    Most Popular
                  </span>
                )}
                <div className="relative flex items-center gap-2">
                  <span className="text-2xl">{bundle.emoji}</span>
                  <div>
                    <p className="font-bold text-white text-sm">{bundle.name}</p>
                    {bundle.bonus && (
                      <p className="text-xs font-semibold" style={{ color: "#3ED97A" }}>{bundle.bonus}</p>
                    )}
                  </div>
                </div>
                <p className="relative text-xl font-extrabold" style={{ color: "#FFC93C" }}>
                  {bundle.points.toLocaleString()} <span className="text-sm font-semibold">pts</span>
                </p>
                <GameButton
                  variant="gold"
                  size="sm"
                  fullWidth
                  pulse={bundle.popular}
                  disabled={buyingBundle === bundle.key}
                  onClick={() => handleBuyBundle(bundle.key)}
                  className="relative mt-1"
                >
                  {buyingBundle === bundle.key ? "Redirecting…" : bundle.price}
                </GameButton>
              </div>
            ))}
          </div>

          {/* Fair play disclaimer */}
          <div
            className="mt-4 flex items-start gap-3 rounded-xl px-4 py-3"
            style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <span className="text-lg mt-0.5">⚖️</span>
            <div>
              <p className="text-sm font-semibold text-white">Fair Play Guarantee</p>
              <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>
                Points acquired through purchases are <span className="font-semibold" style={{ color: "#FFC93C" }}>never counted on the leaderboards</span>. Only points earned through solving puzzles and gameplay contribute to your rank — keeping competition fair for everyone.
              </p>
            </div>
          </div>
        </div>

        <StoreCategoryRail
          categories={CATEGORIES}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
        />

        {/* Items grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-white text-lg">Loading store…</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item) => {
              const owned = item.owned > 0;
              const equipped = user ? isEquipped(item, user) : false;
              const canAfford = (user?.totalPoints ?? 0) >= item.price;
              const isCosmetic = ["theme", "frame", "skin", "flair", "banner", "team_theme", "name_color", "anim"].includes(item.subcategory);
              const isTeamTheme = item.subcategory === "team_theme";
              const isBuying = purchasing === item.key;
              const isEquipping = equipping === item.key;
              const rarity = isCosmetic ? getRarity(item.price) : null;
              const accent = getItemAccent(item);
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
                  : "none";

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -3, scale: 1.012 }}
                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                  className="rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden shadow-skeu-panel"
                  style={{
                    backgroundColor: "rgba(36,22,64,0.97)",
                    border: `1px solid ${borderColor}`,
                    boxShadow: glowColor !== "none" ? glowColor : undefined,
                  }}
                >
                  <span className="game-gloss-overlay" aria-hidden style={{ opacity: 0.5 }} />
                  {/* Cosmetic preview strip */}
                  {isCosmetic && <div className="relative"><CosmeticPreview item={item} /></div>}

                  {/* Top row */}
                  <div className="relative flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{item.iconEmoji}</span>
                      <div>
                        <p className="font-bold text-white text-sm leading-tight">{getStoreItemDisplayName(item)}</p>
                        <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>
                          {SUBCATEGORY_LABELS[item.subcategory] ?? item.subcategory}
                          {item.isConsumable && " · Consumable"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 items-end shrink-0">
                      {rarity && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                          style={{ backgroundColor: `${rarity.color}20`, color: rarity.color, border: `1px solid ${rarity.color}44` }}>
                          {rarity.label}
                        </span>
                      )}
                      {equipped && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                          style={{ backgroundColor: "rgba(255,201,60,0.2)", color: "#FFC93C" }}>
                          Equipped
                        </span>
                      )}
                      {!equipped && owned && !item.isConsumable && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                          style={{ backgroundColor: "rgba(62,217,122,0.12)", color: "#3ED97A" }}>
                          Owned
                        </span>
                      )}
                      {item.isConsumable && owned && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                          style={{ backgroundColor: "rgba(139,61,255,0.15)", color: "#B98CFF" }}>
                          ×{item.owned}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="relative text-xs leading-relaxed flex-1" style={{ color: "#DDDBF1" }}>
                    {item.description}
                  </p>

                  {/* Price + actions */}
                  <div className="relative flex items-center justify-between gap-2 mt-1">
                    <span className="font-extrabold text-sm" style={{ color: canAfford ? "#FFC93C" : "#9ca3af" }}>
                      {item.price.toLocaleString()} pts
                    </span>

                    <div className="flex gap-1.5">
                      {/* Preview button for themes, frames, skins, name colors */}
                      {["theme", "frame", "skin", "name_color"].includes(item.subcategory) && (
                        <button
                          onClick={() => setPreviewItem(item)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                          style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.1)" }}
                        >
                          👁 Preview
                        </button>
                      )}

                      {/* Buy button — always shown for consumables, only if not owned for non-consumable */}
                      {(item.isConsumable || !owned) && (
                        <GameButton
                          variant="gold"
                          size="sm"
                          disabled={!canAfford || isBuying}
                          onClick={() => handlePurchase(item)}
                        >
                          {isBuying ? "…" : "Buy"}
                        </GameButton>
                      )}

                      {/* Equip/Unequip button for owned cosmetics (not team themes — those equip on team page) */}
                      {isCosmetic && !isTeamTheme && owned && !item.isConsumable && (
                        equipped ? (
                          <button
                            disabled={!!isEquipping}
                            onClick={() => handleEquip(item, true)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                            style={{ backgroundColor: "rgba(255,255,255,0.07)", color: "#9ca3af" }}
                          >
                            {isEquipping ? "…" : "Unequip"}
                          </button>
                        ) : (
                          <GameButton
                            variant="gold"
                            size="sm"
                            disabled={!!isEquipping}
                            onClick={() => handleEquip(item)}
                          >
                            {isEquipping ? "…" : "Equip"}
                          </GameButton>
                        )
                      )}

                      {/* Activate/Deactivate for Triple-or-Nothing */}
                      {item.key === "triple_or_nothing" && owned && user && (
                        user.tripleOrNothingActive ? (
                          <button
                            disabled={activatingTriple}
                            onClick={handleDeactivateTriple}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                            style={{ backgroundColor: "rgba(255,90,90,0.15)", color: "#FF5A5A", border: "1px solid rgba(255,90,90,0.3)" }}
                          >
                            🔥 Active — Cancel
                          </button>
                        ) : (
                          <button
                            disabled={activatingTriple}
                            onClick={handleActivateTriple}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                            style={{ backgroundColor: "rgba(255,201,60,0.12)", color: "#FFC93C", border: "1px solid rgba(255,201,60,0.25)" }}
                          >
                            {activatingTriple ? "…" : "🎲 Activate"}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {filtered.length === 0 && (
              <div className="col-span-3 py-20 text-center">
                <p className="text-2xl mb-2">🤔</p>
                <p style={{ color: "#AB9F9D" }}>No items in this category.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cosmetic preview modal */}
      <AnimatePresence>
        {previewItem && (
          <CosmeticPreviewModal
            subcategory={previewItem.subcategory}
            value={(previewItem.metadata as Record<string, string> | null)?.value ?? ""}
            displayName={getStoreItemDisplayName(previewItem)}
            iconEmoji={previewItem.iconEmoji}
            onClose={() => setPreviewItem(null)}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl text-sm font-semibold shadow-xl z-50"
            style={{
              bottom: "max(2rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))",
              backgroundColor: toast.type === "success" ? "rgba(36,22,64,0.98)" : "rgba(50,10,10,0.95)",
              border: `1px solid ${toast.type === "success" ? "rgba(255,201,60,0.4)" : "rgba(255,90,90,0.4)"}`,
              color: toast.type === "success" ? "#FFC93C" : "#FF8F8F",
            }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Purchase success celebration overlay */}
      <AnimatePresence>
        {purchaseSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}
            onClick={() => {
              setBalancePoints(user?.totalPoints ?? 0);
              setShowGlow(true);
              setTimeout(() => setShowGlow(false), 1500);
              setPurchaseSuccess(null);
            }}
          >
            {/* Particle burst — purely CSS rings */}
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full pointer-events-none"
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 4 + i * 0.6, opacity: 0 }}
                transition={{ duration: 1.2 + i * 0.08, ease: "easeOut", delay: i * 0.04 }}
                style={{
                  width: 12, height: 12,
                  background: i % 3 === 0 ? "#FFC93C" : i % 3 === 1 ? "#FF4FA3" : "#2FE6E0",
                  rotate: `${i * 30}deg`,
                  originX: "50%", originY: "50%",
                  left: "calc(50% - 6px)", top: "calc(50% - 6px)",
                }}
              />
            ))}

            {/* Floating coins */}
            {[...Array(16)].map((_, i) => (
              <motion.div
                key={`coin-${i}`}
                className="absolute text-2xl pointer-events-none select-none"
                initial={{ opacity: 1, y: 0, x: 0, scale: 0.5 }}
                animate={{
                  opacity: 0,
                  y: -180 - Math.random() * 120,
                  x: (Math.random() - 0.5) * 300,
                  scale: 1.2,
                  rotate: (Math.random() - 0.5) * 360,
                }}
                transition={{ duration: 1.4 + Math.random() * 0.6, ease: "easeOut", delay: 0.1 + i * 0.06 }}
                style={{ left: `${30 + Math.random() * 40}%`, top: "55%" }}
              >
                {i % 4 === 0 ? "💰" : i % 4 === 1 ? "⭐" : i % 4 === 2 ? "✨" : "💎"}
              </motion.div>
            ))}

            {/* Main card */}
            <motion.div
              initial={{ scale: 0.4, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="relative text-center px-10 py-10 rounded-3xl max-w-sm w-full mx-4 overflow-hidden shadow-skeu-panel"
              style={{
                background: "linear-gradient(145deg, rgba(36,22,64,0.98) 0%, rgba(50,32,90,0.98) 100%)",
                border: "2px solid rgba(255,201,60,0.6)",
                boxShadow: "0 0 60px rgba(255,201,60,0.25), 0 0 120px rgba(255,201,60,0.1)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="game-gloss-overlay" aria-hidden style={{ opacity: 0.4 }} />
              {/* Glow ring */}
              <motion.div
                className="absolute inset-0 rounded-3xl pointer-events-none"
                animate={{ boxShadow: ["0 0 30px rgba(255,201,60,0.3)", "0 0 60px rgba(255,201,60,0.6)", "0 0 30px rgba(255,201,60,0.3)"] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              />

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.3, 1] }}
                transition={{ delay: 0.15, duration: 0.5, times: [0, 0.6, 1] }}
                className="text-6xl mb-3"
              >
                🎉
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="text-sm font-semibold mb-1"
                style={{ color: "#2FE6E0" }}
              >
                Thank you for your purchase!
              </motion.p>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="text-lg font-bold mb-1"
                style={{ color: "#AB9F9D" }}
              >
                Points Added!
              </motion.p>

              <motion.p
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, type: "spring", stiffness: 280 }}
                className="text-6xl font-black mb-1"
                style={{ color: "#FFC93C", textShadow: "0 0 30px rgba(255,201,60,0.6)" }}
              >
                +{purchaseSuccess.points.toLocaleString()}
              </motion.p>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55 }}
                className="text-sm font-semibold mb-6"
                style={{ color: "#E0960B" }}
              >
                points added to your balance
              </motion.p>

              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setBalancePoints(user?.totalPoints ?? 0);
                  setShowGlow(true);
                  setTimeout(() => setShowGlow(false), 1500);
                  setPurchaseSuccess(null);
                }}
                className="px-8 py-3 rounded-xl font-extrabold text-sm"
                style={{
                  background: "linear-gradient(135deg, #FFE58A, #FFC93C)",
                  color: "#1a1400",
                  boxShadow: "0 4px 20px rgba(255,201,60,0.35)",
                }}
              >
                Awesome! 🚀
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function StorePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#170B26" }}>
        <div className="text-white text-xl">Loading store...</div>
      </div>
    }>
      <StorePageInner />
    </Suspense>
  );
}
