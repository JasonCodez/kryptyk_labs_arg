/**
 * Hook to manage user preferences persistence and application
 * Loads preferences from localStorage and applies them on component mount
 */

import { useEffect } from "react";

interface UserPreferences {
  themeBrightness: "light" | "medium" | "dark";
  fontSize: "small" | "medium" | "large" | "extra-large";
  spacingMode: "compact" | "comfortable" | "spacious";
  reduceAnimations: boolean;
  colorContrast: "normal" | "high";
}

const DEFAULT_PREFERENCES: UserPreferences = {
  themeBrightness: "dark",
  fontSize: "medium",
  spacingMode: "comfortable",
  reduceAnimations: false,
  colorContrast: "normal",
};

export function useUserPreferences() {
  useEffect(() => {
    // Load preferences from localStorage on mount
    const loadPreferences = () => {
      try {
        const stored = localStorage.getItem("userPreferences");
        let preferences = stored
          ? JSON.parse(stored)
          : DEFAULT_PREFERENCES;

        // Force themeBrightness to 'dark' to prevent user color changes from taking effect
        preferences.themeBrightness = 'dark';

        // Apply preferences to DOM
        applyPreferencesToDOM(preferences);
      } catch (error) {
        console.error("Error loading preferences:", error);
        // Fall back to defaults
        applyPreferencesToDOM(DEFAULT_PREFERENCES);
      }
    };

    // Load on mount
    loadPreferences();

    // Listen for storage changes (from other tabs/windows)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "userPreferences" && e.newValue) {
        const preferences = JSON.parse(e.newValue);
        preferences.themeBrightness = 'dark';
        applyPreferencesToDOM(preferences);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);
}

/**
 * Apply preferences to DOM and CSS variables
 */
function applyPreferencesToDOM(preferences: UserPreferences) {
  const root = document.documentElement;

  // Set data attributes
  root.setAttribute("data-theme-brightness", preferences.themeBrightness);
  root.setAttribute("data-font-size", preferences.fontSize);
  root.setAttribute("data-spacing-mode", preferences.spacingMode);
  root.setAttribute("data-reduce-animations", String(preferences.reduceAnimations));
  root.setAttribute("data-color-contrast", preferences.colorContrast);

  // Set CSS variables for theme brightness (enforce original dark theme)
  // NOTE: we intentionally enforce the original site theme to avoid accidental user changes to theme colors.
  const enforced = {
    bg: "#020202",
    text: "#DDDBF1",
    border: "#3891A6",
    accent: "#FDE74C",
    accentBg: "rgba(253, 231, 76, 0.06)",
  };

  root.style.setProperty("--color-bg-primary", enforced.bg);
  root.style.setProperty("--color-text-primary", enforced.text);
  root.style.setProperty("--color-border", enforced.border);
  root.style.setProperty("--accent-color", enforced.accent);
  root.style.setProperty("--accent-bg", enforced.accentBg);

  // Backwards compatibility: also apply accent to commonly used CSS variables
  root.style.setProperty("--color-highlight", enforced.accent);
  root.style.setProperty("--color-highlight-bg", enforced.accentBg);

  // Set font size multiplier
  const fontSizeMultipliers = {
    small: 0.875,
    medium: 1,
    large: 1.125,
    "extra-large": 1.25,
  };
  root.style.setProperty(
    "--font-size-multiplier",
    String(fontSizeMultipliers[preferences.fontSize])
  );

  // Set spacing multiplier
  const spacingMultipliers = {
    compact: 0.75,
    comfortable: 1,
    spacious: 1.5,
  };
  root.style.setProperty(
    "--spacing-multiplier",
    String(spacingMultipliers[preferences.spacingMode])
  );

  // Set animation duration
  const animationDuration = preferences.reduceAnimations ? "0.05s" : "0.3s";
  root.style.setProperty("--animation-duration", animationDuration);

  // Set color contrast
  if (preferences.colorContrast === "high") {
    // For enforced dark theme, high contrast uses bright white text
    root.style.setProperty("--color-text-primary", "#FFFFFF");
    root.style.setProperty("--border-width", "2px");
  } else {
    root.style.setProperty("--border-width", "1px");
  }
}

/**
 * Save preferences to localStorage and apply them
 */
export function saveUserPreferences(preferences: UserPreferences) {
  try {
    // Do not persist user-provided themeBrightness; force it to 'dark'
    const prefsToStore: UserPreferences = { ...preferences, themeBrightness: 'dark' } as UserPreferences;
    localStorage.setItem("userPreferences", JSON.stringify(prefsToStore));
    applyPreferencesToDOM(prefsToStore);
  } catch (error) {
    console.error("Error saving preferences:", error);
  }
}

/**
 * Get preferences from localStorage
 */
export function getUserPreferences(): UserPreferences {
  try {
    const stored = localStorage.getItem("userPreferences");
    return stored ? JSON.parse(stored) : DEFAULT_PREFERENCES;
  } catch (error) {
    console.error("Error getting preferences:", error);
    return DEFAULT_PREFERENCES;
  }
}
