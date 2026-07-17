"use client";

import { forwardRef } from "react";
import type { ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

export type GameButtonVariant = "pink" | "purple" | "gold" | "cyan" | "grass" | "ember";
export type GameButtonSize = "sm" | "md" | "lg";

const VARIANT_GRADIENTS: Record<GameButtonVariant, string> = {
  pink: "linear-gradient(160deg, #FF8FC7 0%, #FF4FA3 45%, #C7157A 100%)",
  purple: "linear-gradient(160deg, #B98CFF 0%, #8B3DFF 45%, #5B1FB0 100%)",
  gold: "linear-gradient(160deg, #FFE58A 0%, #FFC93C 45%, #E0960B 100%)",
  cyan: "linear-gradient(160deg, #8FF6F3 0%, #2FE6E0 45%, #0FA6A1 100%)",
  grass: "linear-gradient(160deg, #8CF3AE 0%, #3ED97A 45%, #1F9E52 100%)",
  ember: "linear-gradient(160deg, #FF9C9C 0%, #FF5A5A 45%, #C72A2A 100%)",
};

// Border color reads as the "edge" of the plastic/jelly piece — a few shades
// darker than the gradient's midpoint so the shape still pops against similarly
// colored backgrounds.
const VARIANT_BORDER: Record<GameButtonVariant, string> = {
  pink: "#A80F63",
  purple: "#48198F",
  gold: "#B87A08",
  cyan: "#0C827E",
  grass: "#187F41",
  ember: "#A32121",
};

const SIZE_CLASSES: Record<GameButtonSize, string> = {
  // min-h-11 (44px) is the accessibility touch-target floor — never go below it
  // even for the smallest variant.
  sm: "min-h-11 px-4 text-sm rounded-2xl",
  md: "min-h-14 px-6 text-base rounded-2xl",
  lg: "min-h-16 px-8 text-lg rounded-[28px]",
};

export interface GameButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  children: ReactNode;
  variant?: GameButtonVariant;
  size?: GameButtonSize;
  /** Icon or emoji rendered before the label. */
  icon?: ReactNode;
  /** Makes the button constantly pulse/breathe to draw the eye (Play, Buy, Claim). */
  pulse?: boolean;
  fullWidth?: boolean;
}

/**
 * A reusable, highly skeuomorphic action button: shiny-plastic gradient fill,
 * a glass highlight across the top, a chunky bottom "lift" shadow that
 * collapses into an inset dent on press, and a springy tap animation.
 */
const GameButton = forwardRef<HTMLButtonElement, GameButtonProps>(function GameButton(
  {
    children,
    variant = "pink",
    size = "md",
    icon,
    pulse = false,
    fullWidth = false,
    className = "",
    disabled,
    style,
    ...rest
  },
  ref
) {
  return (
    <motion.button
      ref={ref}
      disabled={disabled}
      // The spring tap is the core of the "juice": a fast, slightly overshooting
      // press-down that snaps back on release, rather than a linear scale tween.
      whileTap={disabled ? undefined : { scale: 0.92, y: 3 }}
      whileHover={disabled ? undefined : { scale: 1.035 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className={[
        "relative inline-flex items-center justify-center gap-2 select-none",
        "font-extrabold uppercase tracking-wide game-text-stroke game-text-pop",
        "border-b-4 transition-shadow duration-100",
        size === "sm" ? "shadow-skeu-raised-sm active:shadow-skeu-pressed" : "shadow-skeu-raised active:shadow-skeu-pressed",
        SIZE_CLASSES[size],
        fullWidth ? "w-full" : "",
        disabled ? "opacity-50 grayscale cursor-not-allowed" : "cursor-pointer",
        pulse && !disabled ? "animate-candy-breathe" : "",
        className,
      ].join(" ")}
      style={{
        backgroundImage: VARIANT_GRADIENTS[variant],
        borderColor: VARIANT_BORDER[variant],
        color: "#ffffff",
        ...style,
      }}
      {...rest}
    >
      {/* Glass highlight — decorative, sits above the gradient fill. */}
      <span className="game-gloss-overlay" aria-hidden />
      {/* Pulsing halo ring, only when explicitly requested (Play/Buy/Claim CTAs). */}
      {pulse && !disabled && (
        <span
          className="absolute inset-0 rounded-[inherit] animate-candy-spark"
          aria-hidden
        />
      )}
      {icon && <span className="relative text-xl leading-none drop-shadow-sm">{icon}</span>}
      <span className="relative">{children}</span>
    </motion.button>
  );
});

export default GameButton;
