"use client";

// Pressable — the standard juicy button. Drop-in replacement for <button> that adds:
//   • squash on press (scale 0.96) with a springy overshoot on release
//   • gentle lift on hover
//   • a ripple expanding from the actual touch/click point
//   • coordinated sound + haptic feedback (configurable cue, default "tap")
// Honors reduced-motion (app setting and OS) by dropping the motion but keeping
// the instant visual state change so presses still feel acknowledged.

import { useCallback, useRef, useState, type ButtonHTMLAttributes, type PointerEvent, type Ref } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { juice, prefersReducedMotion } from "@/lib/juice";

type JuiceCue = keyof typeof juice;

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

export interface PressableProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onAnimationStart" | "onDragStart" | "onDragEnd" | "onDrag"> {
  /** Feedback combo fired on press. Pass null to silence this button. */
  cue?: JuiceCue | null;
  /** Ripple tint — defaults to soft white; use "dark" on light/yellow buttons. */
  ripple?: "light" | "dark" | "none";
  /** Disable the hover lift (for tightly packed lists where lift causes jitter). */
  noLift?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export default function Pressable({
  cue = "tap",
  ripple = "light",
  noLift = false,
  children,
  disabled,
  onPointerDown,
  ...rest
}: PressableProps) {
  const reduceMotion = useReducedMotion() || prefersReducedMotion();
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const rippleId = useRef(0);

  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      onPointerDown?.(e);
      if (disabled) return;
      if (cue) juice[cue]();
      if (ripple !== "none" && !reduceMotion) {
        const rect = e.currentTarget.getBoundingClientRect();
        // Ripple must reach the farthest corner from the touch point
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const size = 2 * Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y));
        const id = ++rippleId.current;
        setRipples((prev) => [...prev, { id, x, y, size }]);
      }
    },
    [cue, disabled, onPointerDown, reduceMotion, ripple],
  );

  return (
    <motion.button
      whileTap={disabled || reduceMotion ? undefined : { scale: 0.96 }}
      whileHover={disabled || reduceMotion || noLift ? undefined : { scale: 1.02, y: -1 }}
      transition={{ type: "spring", stiffness: 550, damping: 28 }}
      {...rest}
      disabled={disabled}
      data-juiced // opts out of JuiceClickLayer's global tap — Pressable fires its own cue
      onPointerDown={handlePointerDown}
      style={{ position: "relative", overflow: "hidden", ...rest.style }}
    >
      {children}
      <AnimatePresence>
        {ripples.map((r) => (
          <motion.span
            key={r.id}
            initial={{ opacity: 0.35, scale: 0 }}
            animate={{ opacity: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            onAnimationComplete={() => setRipples((prev) => prev.filter((p) => p.id !== r.id))}
            style={{
              position: "absolute",
              left: r.x - r.size / 2,
              top: r.y - r.size / 2,
              width: r.size,
              height: r.size,
              borderRadius: "50%",
              pointerEvents: "none",
              background: ripple === "dark" ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.6)",
            }}
          />
        ))}
      </AnimatePresence>
    </motion.button>
  );
}
