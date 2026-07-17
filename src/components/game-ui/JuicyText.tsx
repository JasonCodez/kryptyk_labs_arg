import type { ElementType, ReactNode } from "react";

export type JuicyTextVariant =
  | "gold"
  | "candy"
  | "blue-glass"
  | "purple"
  | "grass"
  | "ember";

const VARIANT_CLASS: Record<JuicyTextVariant, string> = {
  gold: "juicy-text--gold",
  candy: "juicy-text--candy",
  "blue-glass": "juicy-text--blue-glass",
  purple: "juicy-text--purple",
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
  variant = "candy",
  className = "",
}: JuicyTextProps) {
  return (
    <Tag className={`juicy-text font-display ${VARIANT_CLASS[variant]}${className ? ` ${className}` : ""}`}>
      {children}
    </Tag>
  );
}
