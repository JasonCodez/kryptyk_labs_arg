"use client";

import { forwardRef } from "react";
import type { ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

/** Semantic roles — the preferred API. */
export type GameButtonSemanticVariant =
  | "primary"
  | "secondary"
  | "accent"
  | "success"
  | "danger";
/** @deprecated Palette-named variants from the pre-brand candy system; they map
 * onto semantic roles below. Use the semantic names in new code. */
export type GameButtonLegacyVariant = "pink" | "purple" | "gold" | "cyan" | "grass" | "ember";
export type GameButtonVariant = GameButtonSemanticVariant | GameButtonLegacyVariant;
export type GameButtonSize = "sm" | "md" | "lg";

// Legacy → semantic mapping: pink/purple/cyan were all "the main action color"
// in practice, so they collapse onto primary; gold was reward/premium
// (secondary), grass success, ember danger.
const LEGACY_TO_SEMANTIC: Record<GameButtonLegacyVariant, GameButtonSemanticVariant> = {
  pink: "primary",
  purple: "primary",
  cyan: "primary",
  gold: "secondary",
  grass: "success",
  ember: "danger",
};

export function resolveGameButtonVariant(variant: GameButtonVariant): GameButtonSemanticVariant {
  return (LEGACY_TO_SEMANTIC as Partial<Record<GameButtonVariant, GameButtonSemanticVariant>>)[variant] ?? (variant as GameButtonSemanticVariant);
}

// Fill gradient + border + ink text live in .game-btn--* (src/styles/game-ui.css),
// built from the logo-derived brand tokens in globals.css.
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
    variant = "primary",
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
  const semantic = resolveGameButtonVariant(variant);
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
        `game-btn--${semantic}`,
        size === "sm" ? "shadow-skeu-raised-sm active:shadow-skeu-pressed" : "shadow-skeu-raised active:shadow-skeu-pressed",
        SIZE_CLASSES[size],
        fullWidth ? "w-full" : "",
        disabled ? "opacity-50 grayscale cursor-not-allowed" : "cursor-pointer",
        pulse && !disabled ? "animate-candy-breathe" : "",
        className,
      ].join(" ")}
      style={style}
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
