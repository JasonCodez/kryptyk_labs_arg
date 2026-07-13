"use client";

// Small, tasteful particle effects for micro-celebrations — the moments too small
// for the full-screen fireworks in celebrationEffects.tsx (which remains the big-win
// layer). All effects are pointer-events-none overlays; mount them inside a
// position:relative parent. Every effect no-ops under reduced motion.

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import confetti from "canvas-confetti";
import { prefersReducedMotion } from "@/lib/juice";

// Jewel-tone celebration palette (matches --pw-gold / --pw-violet / --pw-success / --pw-teal)
const SPARK_COLORS = ["#FFC94A", "#B24BF3", "#2ED991", "#3D7FFF", "#FFFFFF"];

/**
 * Fire a small confetti burst centered on a DOM element — the "anticipation"
 * beat between a correct answer and the reward modal. Deliberately modest
 * (~24 particles) so the XP modal's fireworks still land as the crescendo.
 */
export function confettiBurstAt(el: Element | null, opts?: { particleCount?: number; spread?: number }) {
  if (!el || prefersReducedMotion()) return;
  const rect = el.getBoundingClientRect();
  confetti({
    particleCount: opts?.particleCount ?? 24,
    spread: opts?.spread ?? 60,
    startVelocity: 22,
    scalar: 0.8,
    ticks: 90,
    gravity: 1.1,
    colors: SPARK_COLORS,
    origin: {
      x: (rect.left + rect.width / 2) / window.innerWidth,
      y: (rect.top + rect.height / 2) / window.innerHeight,
    },
    disableForReducedMotion: true,
  });
}

interface BurstProps {
  /** Increment to re-fire the effect; 0 (or unchanged) renders nothing. */
  trigger: number;
  color?: string;
}

/** Ten sparks flying outward from the center of the parent, then fading. */
export function SparkleBurst({ trigger, color }: BurstProps) {
  const reduceMotion = useReducedMotion();
  // Random directions per burst — regenerated only when the trigger changes
  const sparks = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 32 + Math.random() * 36;
        return {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          size: 4 + Math.random() * 4,
          color: color ?? SPARK_COLORS[i % SPARK_COLORS.length],
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trigger, color],
  );

  if (trigger === 0 || reduceMotion) return null;
  return (
    <div key={trigger} className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      {sparks.map((s, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
          animate={{ opacity: 0, scale: 0.2, x: s.x, y: s.y }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: s.size,
            height: s.size,
            marginLeft: -s.size / 2,
            marginTop: -s.size / 2,
            borderRadius: "50%",
            background: s.color,
            boxShadow: `0 0 6px ${s.color}`,
          }}
        />
      ))}
    </div>
  );
}

/** A ring expanding outward from the parent's center — good for taps and unlocks. */
export function SuccessRing({ trigger, color = "#2ED991" }: BurstProps) {
  const reduceMotion = useReducedMotion();
  if (trigger === 0 || reduceMotion) return null;
  return (
    <motion.span
      key={trigger}
      className="pointer-events-none absolute inset-0"
      aria-hidden
      initial={{ opacity: 0.8, scale: 0.6 }}
      animate={{ opacity: 0, scale: 1.5 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      style={{ borderRadius: "inherit", border: `2px solid ${color}`, boxShadow: `0 0 16px ${color}66` }}
    />
  );
}

/** Checkmark that draws itself in — the universal "confirmed" beat. */
export function AnimatedCheck({ size = 28, color = "#2ED991" }: { size?: number; color?: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <motion.path
        d="M4 12.5l5 5L20 6.5"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
      />
    </svg>
  );
}
