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
import StoreProductCard, { getStoreItemDisplayName, type StoreProductItem } from "@/components/store/StoreProductCard";
import StorePurchaseSuccessModal from "@/components/store/StorePurchaseSuccessModal";
import { ShoppingBag } from "lucide-react";

type StoreItem = StoreProductItem;

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

  const handleClosePurchaseSuccess = () => {
    setBalancePoints(user?.totalPoints ?? 0);
    setShowGlow(true);
    setTimeout(() => setShowGlow(false), 1500);
    setPurchaseSuccess(null);
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
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, #1c0f30 0%, #170B26 45%, #0d0714 100%)" }}
        />
        <div
          className="absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(139,61,255,0.16) 0%, rgba(139,61,255,0) 70%)" }}
        />
        <div
          className="absolute -top-16 -right-24 w-[420px] h-[420px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(255,201,60,0.12) 0%, rgba(255,201,60,0) 70%)" }}
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

        {/* Catalog heading */}
        <div className="mb-4 flex flex-col min-[480px]:flex-row min-[480px]:items-end min-[480px]:justify-between gap-1">
          <div>
            <h2 className="text-xl font-extrabold text-white">Vault Collection</h2>
            <p className="text-xs mt-0.5" style={{ color: "#AB9F9D" }}>
              Choose power-ups, upgrades, and cosmetics worthy of your collection.
            </p>
          </div>
          {!loading && (
            <p className="text-xs font-semibold shrink-0" style={{ color: "#6b7280" }}>
              {CATEGORIES.find((c) => c.key === activeCategory)?.label ?? "All Items"} · {filtered.length} {filtered.length === 1 ? "item" : "items"}
            </p>
          )}
        </div>

        {/* Items grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true">
            <span className="sr-only">Loading store items</span>
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="rounded-2xl p-4 min-[390px]:p-5 flex flex-col gap-3 shadow-skeu-panel motion-safe:animate-pulse motion-reduce:animate-none"
                style={{ backgroundColor: "rgba(36,22,64,0.97)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="h-28 md:h-32 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
                <div className="h-3.5 w-2/3 rounded" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
                <div className="h-2.5 w-1/3 rounded" style={{ backgroundColor: "rgba(255,255,255,0.05)" }} />
                <div className="h-2.5 w-full rounded" style={{ backgroundColor: "rgba(255,255,255,0.05)" }} />
                <div className="h-2.5 w-4/5 rounded" style={{ backgroundColor: "rgba(255,255,255,0.05)" }} />
                <div className="h-4 w-20 rounded" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
                <div className="h-11 w-full rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item) => {
              const owned = item.owned > 0;
              const equipped = user ? isEquipped(item, user) : false;
              const canAfford = (user?.totalPoints ?? 0) >= item.price;
              const isBuying = purchasing === item.key;
              const isEquipping = equipping === item.key;

              return (
                <StoreProductCard
                  key={item.id}
                  item={item}
                  displayName={getStoreItemDisplayName(item)}
                  equipped={equipped}
                  canAfford={canAfford}
                  isBuying={isBuying}
                  isEquipping={isEquipping}
                  tripleOrNothingActive={user?.tripleOrNothingActive ?? false}
                  activatingTriple={activatingTriple}
                  onPreview={() => setPreviewItem(item)}
                  onPurchase={() => handlePurchase(item)}
                  onEquip={() => handleEquip(item)}
                  onUnequip={() => handleEquip(item, true)}
                  onActivateTriple={handleActivateTriple}
                  onDeactivateTriple={handleDeactivateTriple}
                />
              );
            })}

            {filtered.length === 0 && (
              <div className="col-span-1 sm:col-span-2 lg:col-span-3 py-20 text-center flex flex-col items-center gap-2">
                <ShoppingBag size={28} aria-hidden="true" style={{ color: "#6b7280" }} />
                <p className="text-white font-bold">Nothing in this vault yet</p>
                <p className="text-sm max-w-xs" style={{ color: "#AB9F9D" }}>
                  The {CATEGORIES.find((c) => c.key === activeCategory)?.label ?? "All Items"} category is empty right now — check back soon or browse another category.
                </p>
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
      {purchaseSuccess && (
        <StorePurchaseSuccessModal points={purchaseSuccess.points} onClose={handleClosePurchaseSuccess} />
      )}
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
