import type { CSSProperties, ReactNode } from "react";

/** Semantic discovery roles — the preferred API. */
export type CardSemanticAccent = "primary" | "secondary" | "accent" | "success" | "neutral";
/** @deprecated Palette-named accents from the pre-brand system; they map onto
 * semantic roles (gold→secondary, violet/teal→primary). Use semantic names in
 * new call sites. */
export type CardLegacyAccent = "gold" | "violet" | "teal";
export type CardAccent = CardSemanticAccent | CardLegacyAccent | "none";
export type CardPadding = "sm" | "md" | "lg";

const LEGACY_TO_SEMANTIC: Record<CardLegacyAccent, CardSemanticAccent> = {
  gold: "secondary",
  violet: "primary",
  teal: "primary",
};

// RGB channels of the logo-derived brand tokens (globals.css), so the accent
// border and glow can use valid rgba() with alpha. Appending hex alpha to a
// var() — `var(--pw-brand-secondary)55` — produces an invalid color the
// browser silently drops. These literals must stay in sync with the tokens.
const ACCENT_RGB: Record<Exclude<CardSemanticAccent, "neutral">, string> = {
  primary: "3, 172, 244", // --pw-brand-primary #03ACF4
  secondary: "254, 208, 7", // --pw-brand-secondary #FED007
  accent: "249, 113, 2", // --pw-brand-accent #F97102
  success: "59, 196, 106", // --pw-success #3BC46A
};

export function resolveCardAccent(accent: CardAccent): CardSemanticAccent | "none" {
  if (accent === "none" || accent === "neutral") return accent === "neutral" ? "neutral" : "none";
  return (LEGACY_TO_SEMANTIC as Partial<Record<CardAccent, CardSemanticAccent>>)[accent] ?? (accent as CardSemanticAccent);
}

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
  const semantic = resolveCardAccent(accent);
  const accentRgb = semantic !== "none" && semantic !== "neutral" ? ACCENT_RGB[semantic] : null;

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
