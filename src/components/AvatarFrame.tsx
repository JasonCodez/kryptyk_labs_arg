"use client";

/**
 * AvatarFrame — conic-gradient spinning ring frame for avatars.
 *
 * Uses a spinning conic-gradient border with a counter-spinning inner
 * container so the avatar stays upright while the frame rotates smoothly.
 * No pageBg gap — the ring hugs the avatar edge cleanly.
 *
 * Richness scales additively with `frame.rarity`: common is the bare ring,
 * rare adds a glint sweep, epic adds orbiting sparkles, legendary adds a
 * counter-rotating outer aura. Frames with no rarity tag (the regular
 * purchasable gold/neon/flame frames) get the bare ring too.
 */

import React from "react";
import type { Rarity } from "@/lib/rarity";

export interface FrameConfig {
  colorA: string;
  colorB: string;
  glow: string;
  rarity?: Rarity;
}

interface AvatarFrameProps {
  frame: FrameConfig;
  size: number;          // pixel size of the outer wrapper (e.g. 80 or 96)
  strokeWidth?: number;  // ring thickness in px — defaults to ~5% of size
  pageBg?: string;       // kept for API compatibility, no longer used
  className?: string;
  children: React.ReactNode;
}

const RARITY_RANK: Record<Rarity, number> = {
  common: 0,
  uncommon: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
  exclusive: 2,
};

export default function AvatarFrame({
  frame,
  size,
  strokeWidth,
  className = "",
  children,
}: AvatarFrameProps) {
  const stroke = strokeWidth ?? Math.max(3, Math.round(size * 0.05));
  const padding = stroke + 1;
  const rank = frame.rarity ? RARITY_RANK[frame.rarity] : 0;
  const showGlint = rank >= 1;
  const showSparkle = rank >= 2;
  const showAura = rank >= 3;

  const orbitRadius = size / 2 + stroke + 2;
  const sparkleSize = Math.max(3, Math.round(size * 0.045));
  const auraInset = -(stroke + 3);
  const auraBorderWidth = Math.max(1, Math.round(stroke * 0.3));

  return (
    <div
      className={`relative flex-shrink-0 avatar-frame-root ${className}`}
      style={{ width: size, height: size, "--af-orbit-r": `${orbitRadius}px` } as React.CSSProperties}
    >
      {/* Outer counter-rotating aura ring — legendary only */}
      {showAura && (
        <div
          style={{
            position: "absolute",
            inset: auraInset,
            borderRadius: "9999px",
            border: `${auraBorderWidth}px solid ${frame.colorA}88`,
            boxShadow: `0 0 14px ${frame.colorB}66`,
            animation: "af-aura-spin 7s linear infinite",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Pulsing glow layer — separate so it never affects avatar opacity */}
      <div
        style={{
          position: "absolute",
          inset: -2,
          borderRadius: "9999px",
          boxShadow: frame.glow,
          animation: "af-pulse 2.4s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />

      {/* Spinning conic-gradient ring — last stop matches the first so the
          loop closes smoothly instead of hard-cutting once per rotation. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "9999px",
          padding,
          background: `conic-gradient(
            ${frame.colorA} 0deg,
            ${frame.colorB} 90deg,
            rgba(255,255,255,0.92) 155deg,
            ${frame.colorB} 220deg,
            ${frame.colorA} 300deg,
            ${frame.colorB} 340deg,
            ${frame.colorA} 360deg
          )`,
          animation: "af-spin 3.6s linear infinite",
        }}
      >
        {/* Counter-spin keeps avatar content visually stationary */}
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "9999px",
            overflow: "hidden",
            animation: "af-counter-spin 3.6s linear infinite",
          }}
        >
          {children}
        </div>
      </div>

      {/* Glint sweep — rare and above. Second conic layer, masked to just the
          ring band via the padding + mask-composite punch-out trick. */}
      {showGlint && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "9999px",
            padding,
            background: "conic-gradient(transparent 0deg, transparent 310deg, rgba(255,255,255,0.9) 335deg, transparent 360deg)",
            WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            animation: "af-spin-fast 1.7s linear infinite",
            mixBlendMode: "screen",
            opacity: 0.9,
            pointerEvents: "none",
          } as React.CSSProperties}
        />
      )}

      {/* Orbiting sparkles — epic and above. Position via `orbit` (transform),
          brightness via `twinkle` (opacity only) — the two must never both
          animate `transform` on one element, or the later-listed animation
          silently wins and the other's motion is dropped. */}
      {showSparkle &&
        [0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: sparkleSize,
              height: sparkleSize,
              borderRadius: "9999px",
              background: "#fff",
              top: "50%",
              left: "50%",
              boxShadow: `0 0 6px 1.5px ${frame.colorB}`,
              animation: `af-orbit 4.4s linear infinite ${-(i * 1.47)}s, af-twinkle 1.3s ease-in-out infinite ${-(i * 0.4)}s`,
              pointerEvents: "none",
            }}
          />
        ))}

      <style>{`
        @keyframes af-spin         { to { transform: rotate(360deg);  } }
        @keyframes af-spin-fast    { to { transform: rotate(360deg);  } }
        @keyframes af-counter-spin { to { transform: rotate(-360deg); } }
        @keyframes af-aura-spin    { to { transform: rotate(-360deg); } }
        @keyframes af-pulse        { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes af-twinkle      { 0%,100% { opacity: 0.25; } 50% { opacity: 1; } }
        @keyframes af-orbit {
          from { transform: rotate(0deg) translateX(var(--af-orbit-r)) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(var(--af-orbit-r)) rotate(-360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .avatar-frame-root, .avatar-frame-root * {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
