// Puzzle board skin definitions
// Each skin provides CSS-in-JS tokens used by puzzle components.

export type SkinKey =
  | "default"
  | "retro"    | "skin_retro"
  | "minimal"  | "skin_minimal"
  | "neon"     | "skin_neon"
  | "lava"     | "skin_lava"
  | "galaxy"   | "skin_galaxy"
  | "christmas"| "skin_christmas"
  | "ice"      | "skin_ice";

export interface PuzzleSkinTokens {
  _key?: string;
  // Board wrapper
  boardBg: string;
  boardBorder: string;
  boardShadow: string;
  boardRadius: string;
  // Background readability layer applied above animated canvases
  backdropScrim: string;
  // Tile / cell
  tileBg: string;
  tileBorder: string;
  tileText: string;
  tileFontFamily: string;
  // Accent colors (correct, wrong, active)
  accentCorrect: string;
  accentWrong: string;
  accentActive: string;
  // Input
  inputBg: string;
  inputBorder: string;
  inputText: string;
  // Button (primary action)
  btnBg: string;
  btnText: string;
  // Label / secondary text
  labelColor: string;
}

const DEFAULT: PuzzleSkinTokens = {
  boardBg: "rgba(15,18,25,0.55)",
  boardBorder: "rgba(56,145,166,0.3)",
  boardShadow: "none",
  boardRadius: "1rem",
  backdropScrim: "linear-gradient(180deg, rgba(1,2,6,0.24), rgba(1,2,6,0.28))",
  tileBg: "rgba(56,145,166,0.12)",
  tileBorder: "rgba(56,145,166,0.35)",
  tileText: "#ffffff",
  tileFontFamily: "inherit",
  accentCorrect: "rgba(74,222,128,0.35)",
  accentWrong: "rgba(248,113,113,0.35)",
  accentActive: "rgba(253,231,76,0.25)",
  inputBg: "rgba(255,255,255,0.06)",
  inputBorder: "rgba(56,145,166,0.4)",
  inputText: "#ffffff",
  btnBg: "linear-gradient(135deg,#FDE74C,#FFB86B)",
  btnText: "#1a1400",
  labelColor: "#9ca3af",
};

// ── RETRO: 80s/90s arcade neon ──────────────────────────────────────────────
const RETRO: PuzzleSkinTokens = {
  boardBg: "rgba(10,0,32,0.5)",
  boardBorder: "#B43CFF",
  boardShadow: "0 0 0 3px #B43CFF, 0 0 30px rgba(180,60,255,0.55), 0 0 70px rgba(180,60,255,0.18), inset 0 0 20px rgba(180,60,255,0.05)",
  boardRadius: "0",
  backdropScrim: "linear-gradient(180deg, rgba(8,0,24,0.24), rgba(8,0,24,0.28))",
  tileBg: "rgba(18,0,48,0.4)",
  tileBorder: "#B43CFF",
  tileText: "#00FF88",
  tileFontFamily: "'Courier New', monospace",
  accentCorrect: "rgba(0,255,136,0.55)",
  accentWrong: "rgba(255,51,102,0.55)",
  accentActive: "rgba(255,170,0,0.45)",
  inputBg: "#120030",
  inputBorder: "#B43CFF",
  inputText: "#00FF88",
  btnBg: "linear-gradient(135deg,#B43CFF,#FF55AA)",
  btnText: "#ffffff",
  labelColor: "#B43CFF",
};

// ── MINIMAL: Polished obsidian ─────────────────────────────────────────────
const MINIMAL: PuzzleSkinTokens = {
  boardBg: "rgba(8,8,8,0.55)",
  boardBorder: "rgba(255,255,255,0.1)",
  boardShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 24px rgba(0,0,0,0.6)",
  boardRadius: "0.5rem",
  backdropScrim: "linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.18))",
  tileBg: "rgba(255,255,255,0.035)",
  tileBorder: "rgba(255,255,255,0.1)",
  tileText: "#f0f0f0",
  tileFontFamily: "'Inter', 'SF Pro Display', sans-serif",
  accentCorrect: "rgba(255,255,255,0.2)",
  accentWrong: "rgba(180,180,180,0.14)",
  accentActive: "rgba(255,255,255,0.12)",
  inputBg: "rgba(255,255,255,0.04)",
  inputBorder: "rgba(255,255,255,0.14)",
  inputText: "#f0f0f0",
  btnBg: "#ffffff",
  btnText: "#080808",
  labelColor: "#555555",
};

// ── NEON: Electric cyberpunk ───────────────────────────────────────────────
const NEON: PuzzleSkinTokens = {
  boardBg: "rgba(7,13,29,0.5)",
  boardBorder: "rgba(79,229,255,0.62)",
  boardShadow: "0 0 0 1px rgba(79,229,255,0.55), 0 14px 45px rgba(0,8,28,0.72), 0 0 28px rgba(79,229,255,0.24), inset 0 0 24px rgba(217,77,255,0.11)",
  boardRadius: "0.875rem",
  backdropScrim: "linear-gradient(180deg, rgba(3,8,22,0.22), rgba(3,8,22,0.3))",
  tileBg: "rgba(9,22,40,0.45)",
  tileBorder: "rgba(79,229,255,0.42)",
  tileText: "#e7fbff",
  tileFontFamily: "'Rajdhani', 'Segoe UI', 'Trebuchet MS', sans-serif",
  accentCorrect: "rgba(79,255,170,0.44)",
  accentWrong: "rgba(255,88,146,0.42)",
  accentActive: "rgba(217,77,255,0.36)",
  inputBg: "rgba(8,18,34,0.86)",
  inputBorder: "rgba(100,232,255,0.5)",
  inputText: "#e7fbff",
  btnBg: "linear-gradient(135deg,#35ddff,#d74dff)",
  btnText: "#061222",
  labelColor: "#8fdff7",
};

// ── LAVA: Volcanic molten rock ─────────────────────────────────────────────
const LAVA: PuzzleSkinTokens = {
  boardBg: "rgba(6,1,0,0.45)",
  boardBorder: "#FF5500",
  boardShadow: "0 0 0 2px #FF5500, 0 0 25px rgba(255,85,0,0.5), 0 0 65px rgba(255,40,0,0.18), inset 0 0 30px rgba(255,20,0,0.07)",
  boardRadius: "0.375rem",
  backdropScrim: "linear-gradient(180deg, rgba(10,2,0,0.24), rgba(10,2,0,0.3))",
  tileBg: "rgba(255,85,0,0.07)",
  tileBorder: "rgba(255,85,0,0.5)",
  tileText: "#FF9030",
  tileFontFamily: "inherit",
  accentCorrect: "rgba(255,200,0,0.55)",
  accentWrong: "rgba(255,0,30,0.55)",
  accentActive: "rgba(255,100,0,0.5)",
  inputBg: "rgba(255,85,0,0.06)",
  inputBorder: "rgba(255,85,0,0.55)",
  inputText: "#FF9030",
  btnBg: "linear-gradient(135deg,#FF5500,#FF9000)",
  btnText: "#060100",
  labelColor: "#FF6030",
};

// ── GALAXY: Deep space nebula ──────────────────────────────────────────────
const GALAXY: PuzzleSkinTokens = {
  boardBg: "rgba(4,0,26,0.45)",
  boardBorder: "#8B5CF6",
  boardShadow: "0 0 0 2px #8B5CF6, 0 0 25px rgba(139,92,246,0.55), 0 0 65px rgba(200,0,255,0.18), inset 0 0 25px rgba(139,92,246,0.06)",
  boardRadius: "1rem",
  backdropScrim: "linear-gradient(180deg, rgba(4,2,18,0.22), rgba(4,2,18,0.28))",
  tileBg: "rgba(139,92,246,0.09)",
  tileBorder: "rgba(139,92,246,0.5)",
  tileText: "#D8B4FE",
  tileFontFamily: "inherit",
  accentCorrect: "rgba(196,245,208,0.42)",
  accentWrong: "rgba(255,100,180,0.5)",
  accentActive: "rgba(200,0,255,0.45)",
  inputBg: "rgba(139,92,246,0.07)",
  inputBorder: "rgba(139,92,246,0.55)",
  inputText: "#D8B4FE",
  btnBg: "linear-gradient(135deg,#7C3AED,#C026D3)",
  btnText: "#ffffff",
  labelColor: "#9B6DFF",
};

// ── CHRISTMAS (legacy: ICE): Crystal frost + winter ambiance ──────────────
const CHRISTMAS: PuzzleSkinTokens = {
  boardBg: "rgba(0,13,31,0.45)",
  boardBorder: "#67E8F9",
  boardShadow: "0 0 0 2px #67E8F9, 0 0 22px rgba(103,232,249,0.45), 0 0 55px rgba(103,232,249,0.12), inset 0 0 22px rgba(103,232,249,0.05)",
  boardRadius: "1.25rem",
  backdropScrim: "linear-gradient(180deg, rgba(0,10,22,0.18), rgba(0,10,22,0.24))",
  tileBg: "rgba(103,232,249,0.05)",
  tileBorder: "rgba(103,232,249,0.38)",
  tileText: "#E0F9FF",
  tileFontFamily: "inherit",
  accentCorrect: "rgba(103,232,249,0.48)",
  accentWrong: "rgba(255,100,100,0.42)",
  accentActive: "rgba(186,230,253,0.4)",
  inputBg: "rgba(103,232,249,0.05)",
  inputBorder: "rgba(103,232,249,0.45)",
  inputText: "#E0F9FF",
  btnBg: "linear-gradient(135deg,#67E8F9,#38BDF8)",
  btnText: "#000d1f",
  labelColor: "#67E8F9",
};

export const SKIN_TOKENS: Record<SkinKey, PuzzleSkinTokens> = {
  default:      DEFAULT,
  retro:        RETRO,   skin_retro:   RETRO,
  minimal:      MINIMAL, skin_minimal: MINIMAL,
  neon:         NEON,    skin_neon:    NEON,
  lava:         LAVA,    skin_lava:    LAVA,
  galaxy:       GALAXY,  skin_galaxy:  GALAXY,
  christmas:    CHRISTMAS, skin_christmas: CHRISTMAS,
  ice:          CHRISTMAS, skin_ice:       CHRISTMAS,
};

export function getSkinTokens(key: string | undefined | null): PuzzleSkinTokens {
  const resolved = (key ?? "default") as SkinKey;
  const tokens = SKIN_TOKENS[resolved] ?? DEFAULT;
  return { ...tokens, _key: resolved };
}
