"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

export interface StorePurchaseSuccessModalProps {
  points: number;
  onClose: () => void;
}

// Deterministic particle/coin configuration — replaces the previous per-render
// Math.random() calls so server/client and repeated test renders match exactly.
const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  key: i,
  color: i % 3 === 0 ? "#FFC93C" : i % 3 === 1 ? "#FF4FA3" : "#2FE6E0",
  rotate: i * 30,
  scale: 4 + i * 0.6,
  duration: 1.2 + i * 0.08,
  delay: i * 0.04,
}));

const COINS = Array.from({ length: 16 }, (_, i) => ({
  key: i,
  emoji: i % 4 === 0 ? "💰" : i % 4 === 1 ? "⭐" : i % 4 === 2 ? "✨" : "💎",
  y: -180 - ((i * 37) % 120),
  x: ((i * 53) % 300) - 150,
  rotate: ((i * 41) % 360) - 180,
  duration: 1.4 + ((i * 13) % 60) / 100,
  delay: 0.1 + i * 0.06,
  left: 30 + ((i * 17) % 40),
}));

export default function StorePurchaseSuccessModal({ points, onClose }: StorePurchaseSuccessModalProps) {
  const reduceMotion = Boolean(useReducedMotion());
  const buttonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    buttonRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      returnFocusRef.current?.focus();
    };
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
      >
        {!reduceMotion && PARTICLES.map((p) => (
          <motion.div
            key={p.key}
            className="absolute rounded-full pointer-events-none"
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: p.scale, opacity: 0 }}
            transition={{ duration: p.duration, ease: "easeOut", delay: p.delay }}
            style={{
              width: 12, height: 12,
              background: p.color,
              rotate: `${p.rotate}deg`,
              originX: "50%", originY: "50%",
              left: "calc(50% - 6px)", top: "calc(50% - 6px)",
            }}
          />
        ))}

        {!reduceMotion && COINS.map((c) => (
          <motion.div
            key={`coin-${c.key}`}
            className="absolute text-2xl pointer-events-none select-none"
            initial={{ opacity: 1, y: 0, x: 0, scale: 0.5 }}
            animate={{ opacity: 0, y: c.y, x: c.x, scale: 1.2, rotate: c.rotate }}
            transition={{ duration: c.duration, ease: "easeOut", delay: c.delay }}
            style={{ left: `${c.left}%`, top: "55%" }}
          >
            {c.emoji}
          </motion.div>
        ))}

        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="store-purchase-success-title"
          initial={reduceMotion ? false : { scale: 0.4, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { scale: 0.8, opacity: 0 }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 22 }}
          className="relative text-center px-6 py-10 min-[390px]:px-10 rounded-3xl max-w-sm w-full overflow-hidden shadow-skeu-panel"
          style={{
            background: "linear-gradient(145deg, rgba(36,22,64,0.98) 0%, rgba(50,32,90,0.98) 100%)",
            border: "2px solid rgba(255,201,60,0.6)",
            boxShadow: "0 0 60px rgba(255,201,60,0.25), 0 0 120px rgba(255,201,60,0.1)",
            paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="game-gloss-overlay" aria-hidden style={{ opacity: 0.4 }} />

          {!reduceMotion && (
            <motion.div
              className="absolute inset-0 rounded-3xl pointer-events-none"
              animate={{ boxShadow: ["0 0 30px rgba(255,201,60,0.3)", "0 0 60px rgba(255,201,60,0.6)", "0 0 30px rgba(255,201,60,0.3)"] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            />
          )}

          <motion.div
            initial={reduceMotion ? false : { scale: 0 }}
            animate={{ scale: reduceMotion ? 1 : [0, 1.3, 1] }}
            transition={reduceMotion ? { duration: 0 } : { delay: 0.15, duration: 0.5, times: [0, 0.6, 1] }}
            className="text-6xl mb-3"
            aria-hidden="true"
          >
            🎉
          </motion.div>

          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : { delay: 0.25 }}
            className="text-sm font-semibold mb-1"
            style={{ color: "#2FE6E0" }}
          >
            Thank you for your purchase!
          </motion.p>

          <motion.p
            id="store-purchase-success-title"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : { delay: 0.35 }}
            className="text-lg font-bold mb-1"
            style={{ color: "#AB9F9D" }}
          >
            Points Added!
          </motion.p>

          <motion.p
            initial={reduceMotion ? false : { opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reduceMotion ? { duration: 0 } : { delay: 0.4, type: "spring", stiffness: 280 }}
            className="text-6xl font-black mb-1 break-words"
            style={{ color: "#FFC93C", textShadow: "0 0 30px rgba(255,201,60,0.6)" }}
          >
            +{points.toLocaleString()}
          </motion.p>

          <motion.p
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reduceMotion ? { duration: 0 } : { delay: 0.55 }}
            className="text-sm font-semibold mb-6"
            style={{ color: "#E0960B" }}
          >
            points added to your balance
          </motion.p>

          <motion.button
            ref={buttonRef}
            type="button"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : { delay: 0.65 }}
            whileHover={reduceMotion ? undefined : { scale: 1.05 }}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            onClick={onClose}
            className="px-8 py-3 min-h-[44px] rounded-xl font-extrabold text-sm"
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
    </AnimatePresence>
  );
}
