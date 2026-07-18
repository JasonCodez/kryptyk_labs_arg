import type { CSSProperties, ReactNode } from "react";

export type CardAccent = "gold" | "violet" | "teal" | "success" | "none";
export type CardPadding = "sm" | "md" | "lg";

// RGB channels of the logo-derived brand tokens (globals.css), so the accent
// border and glow can use valid rgba() with alpha. Appending hex alpha to a
// var() — `var(--pw-gold)55` — produces an invalid color the browser silently
// drops. Accent names are legacy ("violet"/"teal" pre-date the brand system);
// both now resolve to the brand primary blue — prefer "teal" in new call sites
// until the names are migrated in a later phase.
const ACCENT_RGB: Record<Exclude<CardAccent, "none">, string> = {
  gold: "254, 208, 7", // --pw-brand-secondary #FED007
  violet: "3, 172, 244", // --pw-brand-primary #03ACF4
  teal: "3, 172, 244", // --pw-brand-primary #03ACF4 (primary action)
  success: "59, 196, 106", // --pw-success #3BC46A
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
