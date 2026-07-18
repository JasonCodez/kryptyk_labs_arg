import type { ElementType, ReactNode } from "react";

/** Semantic display roles — the preferred API. */
export type JuicyTextSemanticVariant =
  | "brand"    /* logo shield blue — default display treatment */
  | "reward"   /* logo trophy gold — XP, prizes, premium */
  | "success"  /* solved / correct celebrations */
  | "danger";  /* failed / destructive display text */
/** @deprecated Palette-named variants from the pre-brand candy system. "candy"
 * and "purple" now render the brand-blue treatment (they are not logo colors);
 * the rest map onto their semantic equivalents. */
export type JuicyTextLegacyVariant = "gold" | "candy" | "blue-glass" | "purple" | "grass" | "ember";
export type JuicyTextVariant = JuicyTextSemanticVariant | JuicyTextLegacyVariant;

const VARIANT_CLASS: Record<JuicyTextVariant, string> = {
  brand: "juicy-text--brand",
  reward: "juicy-text--gold",
  success: "juicy-text--grass",
  danger: "juicy-text--ember",
  // Legacy names — kept so existing call sites still render, on-brand.
  gold: "juicy-text--gold",
  candy: "juicy-text--brand",
  "blue-glass": "juicy-text--blue-glass",
  purple: "juicy-text--brand",
  grass: "juicy-text--grass",
  ember: "juicy-text--ember",
};

export interface JuicyTextProps {
  children: ReactNode;
  /** Semantic tag — pick the one that's actually correct for this heading level, not just "h1" by default. */
  as?: ElementType;
  variant?: JuicyTextVariant;
  className?: string;
}

/**
 * Physical, shiny-candy display text: a vertical gradient fill clipped to the
 * glyphs, a thick outer stroke, and a hard (non-blurred) drop shadow for 3D
 * weight — pure CSS (see .juicy-text* in src/styles/game-ui.css), real text
 * throughout, so it stays selectable, scalable, and screen-reader friendly.
 */
export default function JuicyText({
  children,
  as: Tag = "span",
  variant = "brand",
  className = "",
}: JuicyTextProps) {
  return (
    <Tag className={`juicy-text font-display ${VARIANT_CLASS[variant]}${className ? ` ${className}` : ""}`}>
      {children}
    </Tag>
  );
}
