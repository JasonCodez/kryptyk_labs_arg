"use client";

import React, { useState, useEffect } from "react";

interface UserPreferences {
  themeBrightness: "light" | "medium" | "dark";
  fontSize: "small" | "medium" | "large" | "extra-large";
  spacingMode: "compact" | "comfortable" | "spacious";
  reduceAnimations: boolean;
  colorContrast: "normal" | "high";
}

const THEME_BRIGHTNESS_OPTIONS = [
  { value: "light", label: "Light", description: "Bright, light theme" },
  { value: "medium", label: "Medium", description: "Balanced brightness" },
  { value: "dark", label: "Dark", description: "Dark, eye-friendly theme" },
];

const FONT_SIZE_OPTIONS = [
  { value: "small", label: "Small", className: "text-sm" },
  { value: "medium", label: "Medium", className: "text-base" },
  { value: "large", label: "Large", className: "text-lg" },
  { value: "extra-large", label: "Extra Large", className: "text-xl" },
];

const SPACING_MODE_OPTIONS = [
  { value: "compact", label: "Compact", description: "Minimal spacing, more content" },
  { value: "comfortable", label: "Comfortable", description: "Balanced spacing (default)" },
  { value: "spacious", label: "Spacious", description: "Extra spacing, relaxed layout" },
];

export default function UserPreferencesSettings() {
  const [preferences, setPreferences] = useState<UserPreferences>({
    themeBrightness: "dark",
    fontSize: "medium",
    spacingMode: "comfortable",
    reduceAnimations: false,
    colorContrast: "normal",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch preferences on mount
  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/user/settings");
      if (!response.ok) {
        throw new Error("Failed to fetch preferences");
      }
      const data = await response.json();
      setPreferences(data);
      applyPreferences(data);
      setError(null);
    } catch (err) {
      console.error("Error fetching preferences:", err);
      setError("Failed to load preferences");
    } finally {
      setLoading(false);
    }
  };

  const applyPreferences = (prefs: UserPreferences) => {
    // Apply theme brightness
    const root = document.documentElement;
    root.setAttribute("data-theme-brightness", prefs.themeBrightness);
    root.setAttribute("data-font-size", prefs.fontSize);
    root.setAttribute("data-spacing-mode", prefs.spacingMode);
    root.setAttribute("data-reduce-animations", String(prefs.reduceAnimations));
    root.setAttribute("data-color-contrast", prefs.colorContrast);

    // Store in localStorage for persistence
    localStorage.setItem("userPreferences", JSON.stringify(prefs));

    // Apply CSS variables for styling
    applyThemeVariables(prefs);
  };

  const applyThemeVariables = (prefs: UserPreferences) => {
    const root = document.documentElement;

    // Theme brightness colors
    const brightnessVars = {
      light: {
        bg: "#f9fafb",
        text: "#1f2937",
        border: "#e5e7eb",
      },
      medium: {
        bg: "#f3f4f6",
        text: "#111827",
        border: "#d1d5db",
      },
      dark: {
        bg: "#0f172a",
        text: "#f1f5f9",
        border: "#334155",
      },
    };

    const brightness = brightnessVars[prefs.themeBrightness];
    root.style.setProperty("--color-bg-primary", brightness.bg);
    root.style.setProperty("--color-text-primary", brightness.text);
    root.style.setProperty("--color-border", brightness.border);

    // Font size multipliers
    const fontSizeMultipliers = {
      small: 0.875,
      medium: 1,
      large: 1.125,
      "extra-large": 1.25,
    };
    root.style.setProperty(
      "--font-size-multiplier",
      String(fontSizeMultipliers[prefs.fontSize])
    );

    // Spacing multipliers
    const spacingMultipliers = {
      compact: 0.75,
      comfortable: 1,
      spacious: 1.5,
    };
    root.style.setProperty(
      "--spacing-multiplier",
      String(spacingMultipliers[prefs.spacingMode])
    );

    // Animation settings
    const animationDuration = prefs.reduceAnimations ? "0.05s" : "0.3s";
    root.style.setProperty("--animation-duration", animationDuration);

    // Color contrast
    if (prefs.colorContrast === "high") {
      root.style.setProperty("--color-text-primary", brightness.text === "#1f2937" ? "#000000" : "#ffffff");
      root.style.setProperty("--border-width", "2px");
    } else {
      root.style.setProperty("--border-width", "1px");
    }
  };

  const handlePreferenceChange = (
    key: keyof UserPreferences,
    value: string | boolean
  ) => {
    const updatedPreferences = { ...preferences, [key]: value };
    setPreferences(updatedPreferences);
    applyPreferences(updatedPreferences);
  };

  const savePreferences = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      // Do not send themeBrightness - theme color is fixed globally
      const payload = {
        fontSize: preferences.fontSize,
        spacingMode: preferences.spacingMode,
        reduceAnimations: preferences.reduceAnimations,
        colorContrast: preferences.colorContrast,
      };

      const response = await fetch("/api/user/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to save preferences");
      }

      const data = await response.json();
      setPreferences(data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving preferences:", err);
      setError("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <p className="text-gray-500">Loading preferences...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          User Preferences
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Customize your experience with font size and spacing settings
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-green-800 dark:text-green-200">
          ✓ Preferences saved successfully
        </div>
      )}

      {/* Font Size */}
      <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Font Size
        </h3>
        <div className="space-y-3">
          {FONT_SIZE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handlePreferenceChange("fontSize", option.value)}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all flex items-center justify-between ${
                preferences.fontSize === option.value
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-800 hover:border-gray-300"
              }`}
            >
              <div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {option.label}
                </div>
                <div className={`text-gray-600 dark:text-gray-400 mt-1 ${option.className}`}>
                  Sample Text
                </div>
              </div>
              {preferences.fontSize === option.value && (
                <div className="text-blue-500">✓</div>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Spacing Mode */}
      <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Spacing Mode
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SPACING_MODE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() =>
                handlePreferenceChange("spacingMode", option.value)
              }
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                preferences.spacingMode === option.value
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-800 hover:border-gray-300"
              }`}
            >
              <div className="font-medium text-gray-900 dark:text-white">
                {option.label}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {option.description}
              </div>
              {/* Visual representation */}
              <div className="mt-3 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-2 bg-gray-400 rounded ${
                      option.value === "compact"
                        ? "my-1"
                        : option.value === "comfortable"
                        ? "my-2"
                        : "my-3"
                    }`}
                  />
                ))}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Additional Options */}
      <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Accessibility
        </h3>
        <div className="space-y-4">
          {/* Reduce Animations */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                Reduce Animations
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Minimize motion effects for reduced motion preference
              </div>
            </div>
            <button
              onClick={() =>
                handlePreferenceChange(
                  "reduceAnimations",
                  !preferences.reduceAnimations
                )
              }
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                preferences.reduceAnimations
                  ? "bg-green-600"
                  : "bg-red-600"
              }`}
              title={preferences.reduceAnimations ? "Enabled" : "Disabled"}
            >
              <span
                className={`absolute text-white text-xs font-bold transition-opacity ${
                  preferences.reduceAnimations ? "opacity-0" : "opacity-100"
                }`}
              >
                OFF
              </span>
              <span
                className={`absolute text-white text-xs font-bold transition-opacity ${
                  preferences.reduceAnimations ? "opacity-100" : "opacity-0"
                }`}
              >
                ON
              </span>
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  preferences.reduceAnimations
                    ? "translate-x-7"
                    : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Color Contrast */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                High Contrast
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Increase contrast for better visibility
              </div>
            </div>
            <button
              onClick={() =>
                handlePreferenceChange(
                  "colorContrast",
                  preferences.colorContrast === "high" ? "normal" : "high"
                )
              }
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                preferences.colorContrast === "high"
                  ? "bg-green-600"
                  : "bg-red-600"
              }`}
              title={preferences.colorContrast === "high" ? "Enabled" : "Disabled"}
            >
              <span
                className={`absolute text-white text-xs font-bold transition-opacity ${
                  preferences.colorContrast === "high" ? "opacity-0" : "opacity-100"
                }`}
              >
                OFF
              </span>
              <span
                className={`absolute text-white text-xs font-bold transition-opacity ${
                  preferences.colorContrast === "high" ? "opacity-100" : "opacity-0"
                }`}
              >
                ON
              </span>
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  preferences.colorContrast === "high"
                    ? "translate-x-7"
                    : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Save Button */}
      <div className="flex gap-4">
        <button
          onClick={savePreferences}
          disabled={saving}
          className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
        >
          {saving ? "Saving..." : "Save Preferences"}
        </button>
        <button
          onClick={() => {
            fetchPreferences();
            setError(null);
          }}
          className="px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-lg transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
