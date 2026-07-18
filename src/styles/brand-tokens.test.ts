/**
 * Phase 8.1 — logo-derived brand token system guardrails.
 *
 * These are source-level checks: globals.css is the single canonical home of
 * the brand palette, and the files migrated in Phase 8.1 must not reacquire
 * the legacy candy/purple palette. Unmigrated pages still legitimately
 * contain old values, so the banned-color check is scoped to the migrated
 * file list only — do NOT widen it to the whole repo until those pages are
 * migrated in later phases.
 */
import { readFileSync } from "fs";
import { join } from "path";

const root = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

const globalsCss = read("src/app/globals.css");

describe("canonical brand tokens (globals.css)", () => {
  const requiredTokens = [
    // Core brand
    "--pw-brand-primary", "--pw-brand-primary-light", "--pw-brand-primary-dark",
    "--pw-brand-secondary", "--pw-brand-secondary-light", "--pw-brand-secondary-dark",
    "--pw-brand-accent", "--pw-brand-accent-light", "--pw-brand-accent-dark",
    // Surfaces
    "--pw-bg-base", "--pw-bg-elevated",
    "--pw-surface-1", "--pw-surface-2", "--pw-surface-3",
    "--pw-surface-hover", "--pw-surface-pressed", "--pw-surface-disabled",
    // Text
    "--pw-text-primary", "--pw-text-secondary", "--pw-text-muted", "--pw-text-disabled",
    "--pw-text-on-primary", "--pw-text-on-secondary", "--pw-text-on-accent",
    // Borders & depth
    "--pw-border-subtle", "--pw-border-default", "--pw-border-strong",
    "--pw-highlight-top", "--pw-shadow-inner", "--pw-shadow-soft",
    "--pw-shadow-panel", "--pw-shadow-button", "--pw-focus-ring",
    // Semantic
    "--pw-success", "--pw-success-surface", "--pw-success-border", "--pw-text-on-success",
    "--pw-warning", "--pw-warning-surface", "--pw-warning-border", "--pw-text-on-warning",
    "--pw-error", "--pw-error-surface", "--pw-error-border", "--pw-text-on-error",
    "--pw-info", "--pw-info-surface", "--pw-info-border", "--pw-text-on-info",
    // Interactive
    "--pw-action-primary", "--pw-action-primary-hover", "--pw-action-primary-pressed", "--pw-action-primary-disabled",
    "--pw-action-secondary", "--pw-action-secondary-hover", "--pw-action-secondary-pressed", "--pw-action-secondary-disabled",
  ];

  it.each(requiredTokens)("defines %s exactly once", (token) => {
    // A definition is "<token>:" at the start of a declaration; var(<token>)
    // usages don't match because they are preceded by "var(".
    const definitions = globalsCss.match(new RegExp(`(?<![\\w-])${token}\\s*:`, "g")) ?? [];
    expect(definitions.length).toBe(1);
  });

  it("keeps the compatibility aliases pointing at canonical tokens", () => {
    const aliases: Record<string, string> = {
      "--pw-ink": "--pw-bg-base",
      "--pw-ink-2": "--pw-bg-elevated",
      "--pw-surface": "--pw-surface-1",
      "--pw-surface-hi": "--pw-surface-2",
      "--pw-line": "--pw-border-subtle",
      "--pw-line-hi": "--pw-border-default",
      "--pw-gold": "--pw-brand-secondary",
      "--pw-violet": "--pw-brand-primary",
      "--pw-teal": "--pw-action-primary",
      "--pw-ember": "--pw-error",
      "--pw-text": "--pw-text-primary",
      "--pw-text-dim": "--pw-text-secondary",
      "--pw-text-faint": "--pw-text-muted",
    };
    for (const [alias, target] of Object.entries(aliases)) {
      expect(globalsCss).toMatch(new RegExp(`${alias}\\s*:\\s*var\\(${target}\\)`));
    }
  });

  it("has no second :root definition of the old purple surface palette", () => {
    for (const legacyHex of ["#170B26", "#1E1033", "#241640", "#32205A"]) {
      expect(globalsCss.toUpperCase()).not.toContain(legacyHex);
    }
  });
});

describe("legacy candy palette is gone from Phase 8.1-migrated files", () => {
  // Files fully migrated in Phase 8.1. Add files here as later phases migrate
  // them — never remove entries.
  const migratedFiles = [
    "src/app/globals.css",
    "src/styles/game-ui.css",
    "src/styles/crossword.css",
    "tailwind.config.ts",
    "src/components/game-ui/GameButton.tsx",
    "src/components/game-ui/GameHUD.tsx",
    "src/components/game-ui/JuicyText.tsx",
    "src/components/ui/Card.tsx",
    "src/components/Navbar.tsx",
    "src/components/AppBottomNav.tsx",
    "src/components/AppSplashScreen.tsx",
    "src/components/LoadingSpinner.tsx",
    "src/components/app-shell/PuzzleHeader.tsx",
    "src/components/app-shell/PuzzlePlayShell.tsx",
    "src/components/app-shell/AppChrome.tsx",
    "src/components/puzzle/CrosswordPuzzle.tsx",
  ];

  // The unapproved palette: candy pink/purple (and their dims/edges), the
  // purple-tinted surfaces, lavender text tints, and the pre-candy teal.
  const bannedHex = [
    "#8B3DFF", "#B98CFF", "#5B1FB0", "#B24BF3", "#7933A5",
    "#FF4FA3", "#C7157A", "#A80F63", "#FF9FCB", "#C79CFF", "#E4D6FF",
    "#170B26", "#1E1033", "#241640", "#32205A", "#3A2566",
    "#C8B8E0", "#8C7BAD", "#9F8FC9",
    "#2FE6E0", "#0FA6A1", "#3891A6",
  ];
  const bannedRgbChannels = [
    "139, 61, 255", "139,61,255",
    "255, 79, 163", "255,79,163",
    "178, 75, 243", "178,75,243",
    "56, 145, 166", "56,145,166",
  ];

  it.each(migratedFiles)("%s contains no banned legacy color", (rel) => {
    const source = read(rel).toUpperCase();
    for (const hex of bannedHex) {
      expect(source).not.toContain(hex.toUpperCase());
    }
    for (const rgb of bannedRgbChannels) {
      expect(source).not.toContain(rgb.toUpperCase());
    }
  });
});
