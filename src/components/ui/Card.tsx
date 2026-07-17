import type { CSSProperties, ReactNode } from "react";

export type CardAccent = "gold" | "violet" | "teal" | "success" | "none";
export type CardPadding = "sm" | "md" | "lg";

// RGB channels of the candy-palette tokens (globals.css / tailwind.config.ts),
// so the accent border and glow can use valid rgba() with alpha. Appending hex
// alpha to a var() — `var(--pw-gold)55` — produces an invalid color the
// browser silently drops.
const ACCENT_RGB: Record<Exclude<CardAccent, "none">, string> = {
  gold: "255, 201, 60", // #FFC93C
  violet: "139, 61, 255", // #8B3DFF
  teal: "255, 79, 163", // #FF4FA3 (candy-pink — primary action)
  success: "62, 217, 122", // #3ED97A
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
  const accentRgb = accent !== "none" ? ACCENT_RGB[accent] : null;

  return (
    <div
      className={`pw-surface relative overflow-hidden${className ? ` ${className}` : ""}`}
      style={{
        borderRadius: 20,
        padding: PADDING[padding],
        clipPath: bevel
          ? "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))"
          : undefined,
        borderColor: accentRgb ? `rgba(${accentRgb}, 0.33)` : undefined,
        boxShadow: accentRgb ? `0 0 24px -8px rgba(${accentRgb}, 0.4)` : undefined,
        ...style,
      }}
    >
      <span className="game-gloss-overlay" aria-hidden style={{ opacity: 0.5 }} />
      <span className="relative">{children}</span>
    </div>
  );
}
