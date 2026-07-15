import type { CSSProperties, ReactNode } from "react";

export type CardAccent = "gold" | "violet" | "teal" | "success" | "none";
export type CardPadding = "sm" | "md" | "lg";

const ACCENT_VARS: Record<Exclude<CardAccent, "none">, string> = {
  gold: "var(--pw-gold)",
  violet: "var(--pw-violet)",
  teal: "var(--pw-teal)",
  success: "var(--pw-success)",
};

const PADDING: Record<CardPadding, number> = {
  sm: 16, // 2 x 8pt
  md: 24, // 3 x 8pt
  lg: 32, // 4 x 8pt
};

interface CardProps {
  children: ReactNode;
  accent?: CardAccent;
  padding?: CardPadding;
  bevel?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Base surface card — one border, jewel-tone accent, 8pt padding scale.
 * Shared by all home-screen hero/feature cards to avoid nested-border stacking.
 */
export default function Card({
  children,
  accent = "none",
  padding = "md",
  bevel = false,
  className,
  style,
}: CardProps) {
  const accentColor = accent !== "none" ? ACCENT_VARS[accent] : null;

  return (
    <div
      className={`pw-surface${className ? ` ${className}` : ""}`}
      style={{
        borderRadius: 20,
        padding: PADDING[padding],
        clipPath: bevel
          ? "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))"
          : undefined,
        borderColor: accentColor ? `${accentColor}55` : undefined,
        boxShadow: accentColor ? `0 0 24px -8px ${accentColor}66` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
