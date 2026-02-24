"use client";
import React, { useEffect, useRef } from "react";

export type CelebrationVariant = "none" | "confetti" | "flash" | "starburst" | "dramatic";

interface StageCelebrationProps {
  variant: CelebrationVariant;
  onDone?: () => void;
}

export default function StageCelebration({ variant, onDone }: StageCelebrationProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (variant === "none") return;

    if (variant === "confetti") {
      import("canvas-confetti")
        .then((mod) => {
          const confetti = mod.default;
          confetti({
            particleCount: 140,
            spread: 85,
            origin: { x: 0.5, y: 0.36 },
            colors: ["#fbbf24", "#f59e0b", "#34d399", "#60a5fa", "#f87171", "#a78bfa"],
          });
          setTimeout(() => {
            confetti({ particleCount: 65, spread: 140, origin: { x: 0.22, y: 0.52 }, startVelocity: 30 });
            confetti({ particleCount: 65, spread: 140, origin: { x: 0.78, y: 0.52 }, startVelocity: 30 });
          }, 180);
        })
        .catch(() => {});
    }

    const duration =
      variant === "dramatic" ? 2700 : variant === "confetti" ? 2300 : 1100;

    timerRef.current = setTimeout(() => {
      onDone?.();
    }, duration);

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [variant, onDone]);

  return (
    <>
      {/* Global styles — always rendered so CSS is available */}
      <style jsx global>{`
        .celebrate-flash-overlay {
          position: fixed;
          inset: 0;
          background: radial-gradient(circle at center, rgba(251,191,36,0.92) 0%, rgba(251,191,36,0) 68%);
          animation: celebFlash 1.0s ease-out forwards;
          pointer-events: none;
          z-index: 210;
        }
        .celebrate-starburst {
          position: absolute;
          width: 0; height: 0;
          border-radius: 50%;
          animation: celebStarburst 0.85s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
        .celebrate-starburst-ring {
          position: absolute;
          width: 160px; height: 160px;
          border-radius: 50%;
          border: 5px solid rgba(251,191,36,0.7);
          animation: celebStarburstRing 1.0s ease-out forwards;
          margin-left: -80px; margin-top: -80px;
        }
        .celebrate-letterbox-top {
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 17vh;
          background: #000;
          animation: letterboxDrop 0.24s ease-out forwards;
          z-index: 210;
        }
        .celebrate-letterbox-bottom {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          height: 17vh;
          background: #000;
          animation: letterboxRise 0.24s ease-out forwards;
          z-index: 210;
        }
        .celebrate-dramatic-flash {
          position: fixed;
          inset: 0;
          background: white;
          animation: dramaticFlash 0.55s ease-out forwards;
          animation-delay: 0.2s;
          opacity: 0;
          z-index: 211;
        }
        .celebrate-dramatic-text {
          position: fixed;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          font-size: clamp(3rem, 10vw, 6.5rem);
          font-weight: 900;
          letter-spacing: 0.22em;
          color: #fbbf24;
          text-shadow: 0 0 40px #fbbf24, 0 0 80px #f59e0b, 0 4px 30px rgba(0,0,0,0.95);
          animation: dramaticTextReveal 0.45s cubic-bezier(0.2, 0.8, 0.25, 1) forwards;
          animation-delay: 0.38s;
          opacity: 0;
          z-index: 212;
          pointer-events: none;
        }
        @keyframes celebFlash {
          0%   { opacity: 0; }
          18%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes celebStarburst {
          0%   { width: 0; height: 0; opacity: 1; box-shadow: 0 0 0 0 rgba(251,191,36,0.9); }
          55%  { width: 300px; height: 300px; opacity: 0.75; box-shadow: 0 0 55px 25px rgba(251,191,36,0.45); }
          100% { width: 400px; height: 400px; opacity: 0; box-shadow: 0 0 80px 40px rgba(251,191,36,0); margin-left: -200px; margin-top: -200px; }
        }
        @keyframes celebStarburstRing {
          0%   { transform: scale(0); opacity: 1; }
          100% { transform: scale(3.8); opacity: 0; }
        }
        @keyframes letterboxDrop {
          from { transform: translateY(-100%); }
          to   { transform: translateY(0); }
        }
        @keyframes letterboxRise {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes dramaticFlash {
          0%   { opacity: 0; }
          28%  { opacity: 0.88; }
          100% { opacity: 0; }
        }
        @keyframes dramaticTextReveal {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(1.55); filter: blur(8px); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); filter: blur(0); }
        }
      `}</style>

      {/* Flash */}
      {variant === "flash" && (
        <div className="celebrate-flash-overlay" />
      )}

      {/* Starburst */}
      {variant === "starburst" && (
        <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center">
          <div className="celebrate-starburst" />
          <div className="celebrate-starburst-ring" />
        </div>
      )}

      {/* Dramatic */}
      {variant === "dramatic" && (
        <div className="fixed inset-0 z-[200] pointer-events-none">
          <div className="celebrate-letterbox-top" />
          <div className="celebrate-letterbox-bottom" />
          <div className="celebrate-dramatic-flash" />
          <div className="celebrate-dramatic-text">SOLVED</div>
        </div>
      )}
    </>
  );
}
