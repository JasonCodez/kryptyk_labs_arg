"use client";

import Link from "next/link";
import { Palette, X } from "lucide-react";
import { THEME_CONFIGS, getTopBarGradient, resolveThemeKey, type ThemeConfig } from "@/lib/profileThemes";

export interface TeamThemePickerProps {
  activeTheme: string | null | undefined;
  ownedTeamThemes: readonly unknown[];
  theme: ThemeConfig;
  onClose: () => void;
  onSelectTheme: (themeKey: string) => void;
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--pw-brand-primary)]";

export function getAvailableTeamThemeKeys(ownedTeamThemes: readonly unknown[]): string[] {
  const ownedSet = new Set<string>();
  for (const raw of ownedTeamThemes) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (!Object.prototype.hasOwnProperty.call(THEME_CONFIGS, trimmed)) continue;
    ownedSet.add(trimmed);
  }

  const keys: string[] = ["default"];
  for (const key of Object.keys(THEME_CONFIGS)) {
    if (key === "default") continue;
    if (ownedSet.has(key)) keys.push(key);
  }
  return keys;
}

export function formatTeamThemeLabel(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function TeamThemePicker({
  activeTheme,
  ownedTeamThemes,
  theme,
  onClose,
  onSelectTheme,
}: TeamThemePickerProps) {
  const availableKeys = getAvailableTeamThemeKeys(ownedTeamThemes);
  const resolvedActive = resolveThemeKey(activeTheme);
  const activeKey = Object.prototype.hasOwnProperty.call(THEME_CONFIGS, resolvedActive) ? resolvedActive : "default";
  const hasOwnedThemes = availableKeys.length > 1;

  return (
    <section
      id="team-theme-picker"
      data-testid="team-theme-picker"
      aria-labelledby="team-theme-picker-heading"
      className="rounded-2xl border p-5 sm:p-6"
      style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder, boxShadow: theme.cardGlow }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Palette aria-hidden="true" size={20} style={{ color: theme.accentText }} className="mt-0.5 shrink-0" />
          <div>
            <h2 id="team-theme-picker-heading" className="text-base font-bold sm:text-lg" style={{ color: "var(--pw-text-primary)" }}>
              Choose Team Theme
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm" style={{ color: theme.subtleText }}>
              Select from the team themes in your inventory.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close theme picker"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${FOCUS_RING}`}
          style={{ color: theme.subtleText }}
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {availableKeys.map((key) => {
          const tc = THEME_CONFIGS[key]!;
          const isActive = key === activeKey;
          return (
            <button
              key={key}
              type="button"
              data-testid={`team-theme-option-${key}`}
              onClick={() => onSelectTheme(key)}
              aria-pressed={isActive}
              className={`relative flex min-h-12 flex-col items-center gap-1.5 rounded-lg p-3 text-center text-xs font-semibold transition-colors ${FOCUS_RING}`}
              style={{
                backgroundColor: isActive ? tc.primaryMuted : "var(--pw-surface-1)",
                border: `2px solid ${isActive ? tc.primary : "var(--pw-border-default)"}`,
                color: tc.primary,
              }}
            >
              <span aria-hidden="true" className="h-6 w-6 rounded-full" style={{ background: getTopBarGradient(tc) }} />
              <span>{formatTeamThemeLabel(key)}</span>
              {isActive && (
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: tc.primary }}>
                  Active
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!hasOwnedThemes && (
        <div className="mt-4 text-center">
          <p className="text-xs" style={{ color: theme.subtleText }}>No team themes owned yet.</p>
          <Link href="/store" className="text-xs font-semibold" style={{ color: theme.primary }}>
            Visit Store →
          </Link>
        </div>
      )}
    </section>
  );
}
