// Client-side feedback preferences for the juice system (haptics).
// Stored in localStorage so they apply instantly with no network round trip,
// and broadcast via a custom event so open components react to toggles live.

const HAPTICS_KEY = "pw-juice-haptics";
export const JUICE_PREFS_EVENT = "pw-juice-prefs-changed";

function readFlag(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    // Default ON — only an explicit "0" disables.
    return localStorage.getItem(key) !== "0";
  } catch {
    return true;
  }
}

function writeFlag(key: string, enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, enabled ? "1" : "0");
  } catch {
    // localStorage unavailable (private mode) — preference just won't persist
  }
  window.dispatchEvent(new CustomEvent(JUICE_PREFS_EVENT));
}

export function isHapticsEnabled(): boolean {
  return readFlag(HAPTICS_KEY);
}

export function setHapticsEnabled(enabled: boolean) {
  writeFlag(HAPTICS_KEY, enabled);
}

/** True when the user has asked the app (or OS) to minimize motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  if (document.documentElement.getAttribute("data-reduce-animations") === "true") return true;
  return typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
