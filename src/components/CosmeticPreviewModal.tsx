"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { THEME_CONFIGS, FRAME_CONFIGS } from "@/lib/profileThemes";
import { getSkinTokens } from "@/lib/puzzleSkins";
import { findWordInGrid } from "@/lib/wordSearchCore";

const LavaBackground = dynamic(() => import("@/components/LavaBackground"), { ssr: false });
const GalaxyBackground = dynamic(() => import("@/components/GalaxyBackground"), { ssr: false });
const IceBackground = dynamic(() => import("@/components/IceBackground"), { ssr: false });
const NeonBackground = dynamic(() => import("@/components/NeonBackground"), { ssr: false });
const RetroBackground = dynamic(() => import("@/components/RetroBackground"), { ssr: false });

function ThemePreviewContent({ themeKey }: { themeKey: string }) {
  const t = THEME_CONFIGS[themeKey] ?? THEME_CONFIGS.default;
  return (
    <div className="w-full max-w-sm mx-auto rounded-2xl overflow-hidden" style={{ backgroundColor: t.pageBg, border: `1px solid ${t.cardBorder}44` }}>
      {/* Header */}
      <div className="h-20 relative overflow-hidden" style={{ background: t.headerGradient }}>
        <div className="absolute inset-0 flex items-end px-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-lg"
              style={{ background: t.avatarRing ? `linear-gradient(135deg, ${t.avatarRing}, ${t.secondary})` : undefined, boxShadow: t.avatarGlow ? `0 0 14px ${t.avatarGlow}` : undefined }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: t.pageBg }}>👤</div>
            </div>
            <div>
              <p className="text-sm font-extrabold text-white leading-tight">PlayerName</p>
              <p className="text-xs" style={{ color: t.subtleText }}>Level 42</p>
            </div>
          </div>
        </div>
      </div>
      {/* Stats row */}
      <div className="px-4 py-3 flex gap-2">
        {["Puzzles", "Wins", "Streak"].map((label, i) => (
          <div key={label} className="flex-1 rounded-lg px-2 py-2 text-center" style={{ backgroundColor: t.statCardBg, border: `1px solid ${t.statCardBorder}` }}>
            <p className="text-base font-extrabold" style={{ color: t.accentText }}>{[127, 84, 15][i]}</p>
            <p className="text-xs" style={{ color: t.subtleText }}>{label}</p>
          </div>
        ))}
      </div>
      {/* Card section */}
      <div className="px-4 pb-3">
        <div className="rounded-xl p-3" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}44` }}>
          <p className="text-xs font-semibold mb-2" style={{ color: t.primary }}>Recent Activity</p>
          {["Solved Sudoku #482", "Won Warz vs Rival"].map((txt) => (
            <div key={txt} className="flex items-center gap-2 mb-1.5 last:mb-0">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.secondary }} />
              <p className="text-xs" style={{ color: t.subtleText }}>{txt}</p>
            </div>
          ))}
        </div>
      </div>
      {/* XP bar */}
      <div className="px-4 pb-3">
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${t.primary}22` }}>
          <div className="h-full w-3/5 rounded-full" style={{ background: t.xpBarGradient }} />
        </div>
      </div>
      {/* Button */}
      <div className="px-4 pb-4">
        <div className="text-center py-2 rounded-lg text-xs font-bold"
          style={{ background: t.btnPrimary.startsWith("linear") ? t.btnPrimary : undefined, backgroundColor: t.btnPrimary.startsWith("linear") ? undefined : t.btnPrimary, color: t.btnPrimaryText }}>
          View Full Profile
        </div>
      </div>
    </div>
  );
}

function FramePreviewContent({ frameKey }: { frameKey: string }) {
  const f = FRAME_CONFIGS[frameKey] ?? FRAME_CONFIGS.gold;
  const hasFrame = !!(f.colorA && f.colorB);
  return (
    <>
      {/* Inline keyframes for spinning frame animation */}
      <style>{`
        @keyframes store-frame-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes store-frame-counter-spin { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
        .store-frame-animated {
          border-radius: 9999px;
          padding: 5px;
          /* Last stop matches the first so 360deg loops back into 0deg smoothly
             instead of hard-cutting once per rotation. */
          background: conic-gradient(
            var(--sf-color-a) 0deg,
            var(--sf-color-b) 85deg,
            rgba(255,255,255,0.85) 150deg,
            var(--sf-color-b) 215deg,
            var(--sf-color-a) 300deg,
            var(--sf-color-b) 340deg,
            var(--sf-color-a) 360deg
          );
          animation: store-frame-spin 3s linear infinite;
        }
        .store-frame-animated .store-frame-inner {
          width: 100%; height: 100%; border-radius: 9999px; overflow: hidden;
          animation: store-frame-counter-spin 3s linear infinite;
        }
        @keyframes store-frame-glow-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
      <div className="flex flex-col items-center gap-6">
        {/* Large animated frame */}
        <div className="relative" style={{ width: 140, height: 140 }}>
          {hasFrame ? (
            <div
              className="store-frame-animated"
              style={{
                width: 140, height: 140,
                '--sf-color-a': f.colorA,
                '--sf-color-b': f.colorB,
                boxShadow: f.glow,
                animation: "store-frame-spin 3s linear infinite, store-frame-glow-pulse 2s ease-in-out infinite",
              } as React.CSSProperties}
            >
              <div className="store-frame-inner flex items-center justify-center" style={{ backgroundColor: "#0d1117" }}>
                <span className="text-5xl">👤</span>
              </div>
            </div>
          ) : (
            <div className="w-full h-full rounded-full flex items-center justify-center" style={{ backgroundColor: "#0d1117", border: "2px solid rgba(255,255,255,0.1)" }}>
              <span className="text-5xl">👤</span>
            </div>
          )}
        </div>
        {/* Small contextual preview */}
        <div className="w-full max-w-xs rounded-xl p-4 flex items-center gap-3" style={{ backgroundColor: "rgba(15,18,25,0.95)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="shrink-0" style={{ width: 44, height: 44 }}>
            {hasFrame ? (
              <div
                className="store-frame-animated"
                style={{
                  width: 44, height: 44,
                  '--sf-color-a': f.colorA,
                  '--sf-color-b': f.colorB,
                  boxShadow: f.glow,
                  padding: 3,
                } as React.CSSProperties}
              >
                <div className="store-frame-inner flex items-center justify-center" style={{ backgroundColor: "#0d1117" }}>
                  <span className="text-base">👤</span>
                </div>
              </div>
            ) : (
              <div className="w-full h-full rounded-full flex items-center justify-center" style={{ backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.1)" }}>
                <span className="text-base">👤</span>
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-white">PlayerName</p>
            <p className="text-xs" style={{ color: "#6b7280" }}>As seen on leaderboards</p>
          </div>
        </div>
      </div>
    </>
  );
}

function SkinPreviewContent({ skinKey }: { skinKey: string }) {
  const s = getSkinTokens(skinKey);
  const resolvedKeyRaw = skinKey.replace(/^skin_/, "");
  const resolvedKey = resolvedKeyRaw === "ice" ? "christmas" : resolvedKeyRaw;
  const hasAnimatedBg = ["lava", "galaxy", "christmas", "ice", "neon", "retro"].includes(resolvedKey);
  const grid = [
    ["P", "U", "Z", "Z", "L", "E"],
    ["W", "Q", "R", "T", "Y", "C"],
    ["A", "A", "G", "B", "N", "O"],
    ["R", "H", "R", "D", "F", "D"],
    ["Z", "I", "I", "S", "X", "E"],
    ["J", "L", "D", "P", "Q", "R"],
  ];

  const words = ["PUZZLE", "WARZ", "GRID", "CODE"];
  const foundWords = new Set(["PUZZLE", "WARZ"]);
  const wordColors = [
    { bg: "rgba(34,197,94,0.28)", border: "#22c55e", text: "#4ade80" },
    { bg: "rgba(59,130,246,0.28)", border: "#3b82f6", text: "#60a5fa" },
    { bg: "rgba(234,179,8,0.28)", border: "#eab308", text: "#facc15" },
    { bg: "rgba(239,68,68,0.28)", border: "#ef4444", text: "#f87171" },
  ];

  const foundCellMap = new Map<string, number>();
  for (let wi = 0; wi < words.length; wi++) {
    const word = words[wi];
    if (!foundWords.has(word)) continue;
    const cells = findWordInGrid(word, grid);
    if (!cells) continue;
    for (const { row, col } of cells) {
      foundCellMap.set(`${row},${col}`, wi);
    }
  }

  const activeCell = "";

  return (
    <div className="w-full">
      <div
        className="relative rounded-2xl overflow-hidden"
        data-skin={s._key ?? "default"}
        style={{
          borderRadius: "1rem",
          width: "100%",
          maxWidth: "100%",
        }}
      >
        {hasAnimatedBg && (
          <div className="absolute inset-0 z-0">
            {resolvedKey === "lava" && <LavaBackground />}
            {resolvedKey === "galaxy" && <GalaxyBackground />}
            {(resolvedKey === "christmas" || resolvedKey === "ice") && <IceBackground />}
            {resolvedKey === "neon" && <NeonBackground />}
            {resolvedKey === "retro" && <RetroBackground />}
          </div>
        )}

        {!hasAnimatedBg && (
          <div
            className="absolute inset-0 z-0"
            style={{
              background: `linear-gradient(180deg, ${s.boardBg}, rgba(10,12,16,0.95))`,
            }}
          />
        )}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: s.backdropScrim,
            zIndex: 0,
          }}
        />

        <div
          className="relative z-10 flex flex-col items-center gap-4 pb-4 pt-4 px-3"
          style={{
            overflowX: "hidden",
            fontFamily:
              s.tileFontFamily !== "inherit"
                ? s.tileFontFamily
                : "'Clear Sans', 'Helvetica Neue', Arial, sans-serif",
          }}
        >
          <h3
            className="text-lg font-black tracking-[0.2em] text-center"
            style={{
              backgroundImage: "linear-gradient(135deg, #FDE74C, #FFB86B, #3891A6)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 12px rgba(253,231,76,0.4))",
            }}
          >
            WORD TROVE
          </h3>

          <p
            className="text-xs font-medium"
            style={{
              color: "#e2e8f0",
              textShadow: "0 1px 6px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.9)",
            }}
          >
            2 / 4 words found
          </p>

          <div className="flex flex-col sm:flex-row gap-3 items-start w-full">
            <div
              className="mx-auto sm:mx-0"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 3,
                background: "rgba(0,0,0,0.55)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                borderRadius: "0.75rem",
                padding: "10px",
                width: "fit-content",
                maxWidth: "100%",
              }}
            >
              {grid.map((row, ri) => (
                <div key={ri} style={{ display: "flex", gap: 3 }}>
                  {row.map((letter, ci) => {
                    const key = `${ri},${ci}`;
                    const colorIdx = foundCellMap.get(key);
                    const isFound = colorIdx !== undefined;
                    const color = isFound ? wordColors[colorIdx] : null;
                    const isActive = key === activeCell;

                    return (
                      <div
                        key={key}
                        className="flex items-center justify-center font-black rounded"
                        style={{
                          width: "clamp(1.4rem, 6vw, 1.8rem)",
                          height: "clamp(1.4rem, 6vw, 1.8rem)",
                          fontSize: "clamp(0.62rem, 2.8vw, 0.86rem)",
                          background: isActive
                            ? s.accentActive
                            : isFound
                            ? color!.bg
                            : s.tileBg,
                          border: isActive
                            ? `2px solid ${s.boardBorder}`
                            : isFound
                            ? `2px solid ${color!.border}`
                            : `2px solid ${s.tileBorder}`,
                          color: isActive
                            ? "#ffffff"
                            : isFound
                            ? color!.text
                            : s.tileText,
                          boxShadow: isFound ? `0 0 6px ${color!.border}40` : "none",
                          userSelect: "none",
                          WebkitUserSelect: "none",
                        }}
                      >
                        {letter}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="w-full sm:w-auto flex-1 flex flex-col gap-1.5 sm:gap-2">
              <p
                className="text-[11px] sm:text-xs font-semibold tracking-[0.12em]"
                style={{
                  color: "#cbd5e1",
                  textShadow: "0 1px 6px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.9)",
                }}
              >
                FIND THESE WORDS
              </p>

              <div className="w-full flex flex-wrap sm:flex-col gap-1.5 sm:gap-2">
                {words.map((word, wi) => {
                  const found = foundWords.has(word);
                  const color = found ? wordColors[wi % wordColors.length] : null;

                  return (
                    <div
                      key={word}
                      className="px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-md sm:rounded-lg text-[11px] sm:text-sm font-semibold leading-tight"
                      style={{
                        background: found ? color!.bg : s.tileBg,
                        border: `1px solid ${found ? color!.border : "rgba(148,163,184,0.4)"}`,
                        color: found ? color!.text : "#cbd5e1",
                        textDecoration: found ? "line-through" : "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {word}
                    </div>
                  );
                })}
              </div>

              <button
                className="w-full px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{
                  background: "rgba(56,145,166,0.15)",
                  border: "1px solid rgba(56,145,166,0.4)",
                  color: "#3891A6",
                }}
              >
                💡 Hint (3)
              </button>

              <button
                className="w-full px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{
                  background: "rgba(253,231,76,0.08)",
                  border: "1px solid rgba(253,231,76,0.3)",
                  color: "#FDE74C",
                }}
              >
                ? How to play
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NameColorPreviewContent({ value }: { value: string }) {
  const isRainbow = value === "rainbow";
  const sampleNames = ["PlayerName", "Warlord42", "CrypticAce"];
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      {/* Profile header mock */}
      <div className="px-5 py-4" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))" }}>
        <p className="text-xs font-semibold mb-3" style={{ color: "#6b7280" }}>Profile header</p>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>👤</div>
          <div>
            <p
              className={`text-2xl font-extrabold leading-tight${isRainbow ? " rainbow-name" : ""}`}
              style={!isRainbow && value ? { color: value } : undefined}
            >
              PlayerName
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>LVL 42 · Veteran</p>
          </div>
        </div>
      </div>
      {/* Leaderboard mock */}
      <div className="px-5 py-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <p className="text-xs font-semibold mb-3" style={{ color: "#6b7280" }}>Leaderboard</p>
        <div className="space-y-2">
          {sampleNames.map((name, i) => (
            <div key={name} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ backgroundColor: i === 0 ? "rgba(255,255,255,0.05)" : "transparent" }}>
              <span className="text-xs font-bold w-5 text-center" style={{ color: "#6b7280" }}>#{i + 1}</span>
              <p
                className={`text-sm font-bold flex-1${i === 0 && isRainbow ? " rainbow-name" : ""}`}
                style={i === 0 && !isRainbow && value ? { color: value } : { color: i === 0 ? "#fff" : "#9ca3af" }}
              >
                {name}
              </p>
              <span className="text-xs" style={{ color: "#6b7280" }}>1,240 pts</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface CosmeticPreviewModalProps {
  /** StoreItem.subcategory — "theme" | "team_theme" | "frame" | "skin" | "name_color" */
  subcategory: string;
  /** StoreItem.metadata.value */
  value: string;
  displayName: string;
  iconEmoji: string;
  onClose: () => void;
}

export default function CosmeticPreviewModal({ subcategory, value, displayName, iconEmoji, onClose }: CosmeticPreviewModalProps) {
  const isSkin = subcategory === "skin";

  let content: React.ReactNode = null;
  if (subcategory === "theme" || subcategory === "team_theme") {
    content = <ThemePreviewContent themeKey={value || "default"} />;
  } else if (subcategory === "frame") {
    content = <FramePreviewContent frameKey={value || "gold"} />;
  } else if (subcategory === "skin") {
    content = <SkinPreviewContent skinKey={value || "default"} />;
  } else if (subcategory === "name_color") {
    content = <NameColorPreviewContent value={value} />;
  }

  if (!content) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: "spring", stiffness: 340, damping: 26 }}
        className={`rounded-2xl p-6 w-full max-h-[85vh] overflow-y-auto relative ${isSkin ? "max-w-xl" : "max-w-md"}`}
        style={{ backgroundColor: "rgba(15,18,25,0.98)", border: "1px solid rgba(255,255,255,0.12)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors"
          style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "#9ca3af" }}
        >
          ✕
        </button>
        {/* Title */}
        <div className="flex items-center gap-2 mb-5">
          <span className="text-xl">{iconEmoji}</span>
          <div>
            <p className="text-lg font-extrabold text-white">{displayName}</p>
            <p className="text-xs" style={{ color: "#6b7280" }}>Preview how this looks in-game</p>
          </div>
        </div>
        {/* Preview content */}
        {content}
      </motion.div>
    </motion.div>
  );
}
