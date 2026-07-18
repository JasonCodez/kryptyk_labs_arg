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
    // Phase 8.1.1
    "src/components/WelcomeModal.tsx",
    "src/lib/useUserPreferences.ts",
    "src/app/layout.tsx",
    "src/app/manifest.ts",
  ];

  // The unapproved palette: candy pink/purple (and their dims/edges), the
  // purple-tinted surfaces, lavender text tints, and the pre-candy teal.
  const bannedHex = [
    "#8B3DFF", "#B98CFF", "#5B1FB0", "#B24BF3", "#7933A5",
    "#FF4FA3", "#C7157A", "#A80F63", "#FF9FCB", "#C79CFF", "#E4D6FF",
    "#170B26", "#1E1033", "#241640", "#32205A", "#3A2566",
    "#C8B8E0", "#8C7BAD", "#9F8FC9",
    "#2FE6E0", "#0FA6A1", "#3891A6",
    "#020202", "#DDDBF1",
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

  it("the settings apply-path enforces canonical tokens, not the old palette", () => {
    // UserPreferencesSettings.tsx is not fully migrated (its page chrome waits
    // for Phase 8.2), but the values it APPLIES to the document root must be
    // token-based so saving preferences can never restore the teal theme.
    const source = read("src/components/UserPreferencesSettings.tsx");
    expect(source).toContain('bg: "var(--pw-bg-base)"');
    expect(source).toContain('text: "var(--pw-text-primary)"');
    expect(source).not.toContain("#020202");
    expect(source).not.toContain("#DDDBF1");
  });
});

/* ── WCAG contrast — computed from the actual token values ─────────────────── */

function tokenHex(name: string): string {
  const match = globalsCss.match(new RegExp(`${name}\\s*:\\s*(#[0-9A-Fa-f]{6})`));
  if (!match) throw new Error(`token ${name} not found as a hex value in globals.css`);
  return match[1];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(hex.slice(1).slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("WCAG contrast of canonical pairings", () => {
  const normalText: [fg: string, bg: string][] = [
    ["--pw-text-primary", "--pw-bg-base"],
    ["--pw-text-secondary", "--pw-bg-base"],
    ["--pw-text-muted", "--pw-bg-base"],
    ["--pw-text-on-primary", "--pw-brand-primary"],
    ["--pw-text-on-secondary", "--pw-brand-secondary"],
    ["--pw-text-on-accent", "--pw-brand-accent"],
    ["--pw-text-on-success", "--pw-success"],
    ["--pw-text-on-warning", "--pw-warning"],
    ["--pw-text-on-error", "--pw-error"],
    ["--pw-text-on-info", "--pw-info"],
    ["--pw-error-text", "--pw-bg-base"],
    // Action-state fills keep their ink text at AA in every state.
    ["--pw-text-on-primary", "--pw-action-primary-hover"],
    ["--pw-text-on-primary", "--pw-action-primary-pressed"],
    ["--pw-text-on-secondary", "--pw-action-secondary-hover"],
    ["--pw-text-on-secondary", "--pw-action-secondary-pressed"],
  ];

  it.each(normalText)("%s on %s meets 4.5:1 (normal text)", (fg, bg) => {
    expect(contrastRatio(tokenHex(fg), tokenHex(bg))).toBeGreaterThanOrEqual(4.5);
  });

  const nonText: [fg: string, bg: string][] = [
    ["--pw-focus-ring", "--pw-bg-base"],
    ["--pw-focus-ring", "--pw-bg-elevated"],
    ["--pw-focus-ring", "--pw-surface-2"],
    ["--pw-focus-ring", "--pw-surface-3"],
    ["--pw-border-strong", "--pw-bg-base"],
  ];

  it.each(nonText)("%s against %s meets 3:1 (non-text boundary)", (fg, bg) => {
    expect(contrastRatio(tokenHex(fg), tokenHex(bg))).toBeGreaterThanOrEqual(3);
  });
});

/* ── Default foreground/background pairing ─────────────────────────────────── */

describe("default app pairing", () => {
  it("repoints the template variables at the brand tokens", () => {
    expect(globalsCss).toMatch(/--background:\s*var\(--pw-bg-base\)/);
    expect(globalsCss).toMatch(/--foreground:\s*var\(--pw-text-primary\)/);
  });

  it("never re-defines the pairing behind an OS color-scheme media query", () => {
    // Readability must not depend on prefers-color-scheme: dark. Guard against
    // reintroducing the Next.js template's light/dark split.
    expect(globalsCss).not.toContain("prefers-color-scheme");
  });

  it("resolves to light text on the dark navy base (the pairing itself)", () => {
    const ratio = contrastRatio(tokenHex("--pw-text-primary"), tokenHex("--pw-bg-base"));
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    // And the foreground is the LIGHT side of the pair — a dark-on-dark
    // regression (e.g. #171717 text) would flip this.
    expect(relativeLuminance(tokenHex("--pw-text-primary"))).toBeGreaterThan(
      relativeLuminance(tokenHex("--pw-bg-base"))
    );
  });
});

/* ── PWA / TWA / Android metadata synchronization ──────────────────────────── */

describe("platform metadata stays synchronized with brand tokens", () => {
  // JSON, TS metadata, and Gradle cannot consume CSS variables, so these
  // literals are unavoidable duplication — this suite is the drift guard.
  const BRAND_PRIMARY = "#03ACF4";
  const BG_BASE = "#0A0E17";

  it("the canonical tokens still hold the values the metadata duplicates", () => {
    expect(tokenHex("--pw-brand-primary").toUpperCase()).toBe(BRAND_PRIMARY);
    expect(tokenHex("--pw-bg-base").toUpperCase()).toBe(BG_BASE);
  });

  it("layout.tsx viewport themeColor is the brand primary", () => {
    expect(read("src/app/layout.tsx")).toContain(`themeColor: "${BRAND_PRIMARY}"`);
  });

  it("manifest.ts uses brand primary + navy background", () => {
    const source = read("src/app/manifest.ts");
    expect(source).toContain(`theme_color: "${BRAND_PRIMARY}"`);
    expect(source).toContain(`background_color: "${BG_BASE}"`);
  });

  it("twa-manifest.json is synchronized", () => {
    const twa = JSON.parse(read("twa-manifest.json"));
    expect(twa.themeColor).toBe(BRAND_PRIMARY);
    expect(twa.themeColorDark).toBe(BG_BASE);
    expect(twa.navigationColor).toBe(BG_BASE);
    expect(twa.navigationColorDark).toBe(BG_BASE);
    expect(twa.backgroundColor).toBe(BG_BASE);
  });

  it("android build.gradle is synchronized", () => {
    const gradle = read("android-app/build.gradle");
    expect(gradle).toContain(`themeColor: '${BRAND_PRIMARY}'`);
    expect(gradle).toContain(`themeColorDark: '${BG_BASE}'`);
    expect(gradle).toContain(`navigationColor: '${BG_BASE}'`);
    expect(gradle).toContain(`backgroundColor: '${BG_BASE}'`);
    expect(gradle).not.toContain("#3891A6");
    expect(gradle).not.toContain("#020202");
  });

  it("the bundled android web manifest is synchronized", () => {
    const bundled = JSON.parse(read("android-app/src/main/res/raw/web_app_manifest.json"));
    expect(bundled.theme_color).toBe(BRAND_PRIMARY);
    expect(bundled.background_color).toBe(BG_BASE);
  });
});

/* ── Reduced motion + interactive state wiring (source-level) ──────────────── */

describe("shared motion and button-state CSS", () => {
  it("candy pulse/spark stop under both reduced-motion signals", () => {
    expect(globalsCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{[^}]*\.animate-candy-breathe,[^}]*\.animate-candy-spark \{[^}]*animation: none !important;/
    );
    expect(globalsCss).toMatch(
      /\[data-reduce-animations="true"\] \.animate-candy-breathe,\s*\[data-reduce-animations="true"\] \.animate-candy-spark \{\s*animation: none !important;/
    );
  });

  it("button variants wire the canonical action-state tokens", () => {
    const gameUi = read("src/styles/game-ui.css");
    expect(gameUi).toContain("--btn-mid: var(--pw-action-primary)");
    expect(gameUi).toContain("--btn-mid-hover: var(--pw-action-primary-hover)");
    expect(gameUi).toContain("--btn-mid-pressed: var(--pw-action-primary-pressed)");
    expect(gameUi).toContain("--btn-disabled: var(--pw-action-primary-disabled)");
    expect(gameUi).toContain("--btn-mid: var(--pw-action-secondary)");
    expect(gameUi).toContain("--btn-mid-hover: var(--pw-action-secondary-hover)");
    expect(gameUi).toContain("--btn-mid-pressed: var(--pw-action-secondary-pressed)");
    expect(gameUi).toContain("--btn-disabled: var(--pw-action-secondary-disabled)");
    // Shared mechanics exist for hover / pressed / disabled.
    expect(gameUi).toMatch(/:hover:not\(:disabled\)/);
    expect(gameUi).toMatch(/:active:not\(:disabled\)/);
    expect(gameUi).toMatch(/:disabled \{\s*background-image: none;\s*background-color: var\(--btn-disabled\);/);
  });
});
