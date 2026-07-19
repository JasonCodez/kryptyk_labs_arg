/**
 * Single source of truth for Hidden Word result tile colors and markers, shared
 * by the game board (HiddenWordPuzzle) and the briefing legend
 * (HiddenWordInstructionsModal) so the two cannot visually drift apart.
 */

export type HiddenWordResultMarker = "filled" | "ring" | "none";

export interface HiddenWordResultVisual {
  background: string;
  border: string;
  glow: string;
  text: string;
  marker: HiddenWordResultMarker;
}

export const HIDDEN_WORD_RESULT_VISUALS = {
  correct: {
    background: "#38D399",
    border: "#10b981",
    glow: "rgba(56,211,153,0.65)",
    text: "#04190f",
    marker: "filled",
  },
  present: {
    background: "#a78bfa",
    border: "#7c3aed",
    glow: "rgba(167,139,250,0.65)",
    text: "#1e1147",
    marker: "ring",
  },
  absent: {
    background: "rgba(56,145,166,0.22)",
    border: "rgba(56,145,166,0.5)",
    glow: "none",
    text: "#E2E8F0",
    marker: "none",
  },
} as const satisfies Record<"correct" | "present" | "absent", HiddenWordResultVisual>;
