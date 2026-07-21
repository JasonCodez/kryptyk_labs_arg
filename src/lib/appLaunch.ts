/**
 * Pure launch-mode resolver for the branded PWA launch sequence
 * (AppSplashScreen). No browser globals, no React — inputs in, mode out, so
 * the decision logic can be unit-tested without jsdom.
 */

// Bumped so a real phone that already silently persisted version "1" during
// the invisible-behind-the-native-splash failure receives the corrected
// sequence in full at least once after this fix ships.
export const APP_LAUNCH_VERSION = "2";

export const APP_LAUNCH_VERSION_KEY = "pw_app_launch_version";

export type AppLaunchMode = "none" | "full" | "compact" | "reduced";

export interface AppLaunchInputs {
  launchCandidate: boolean;
  /** True once a launch has already visibly played in this loaded document. */
  alreadyPlayedInDocument: boolean;
  storedVersion: string | null;
  localStorageAvailable: boolean;
  reducedMotion: boolean;
}

export function resolveAppLaunchMode({
  launchCandidate,
  alreadyPlayedInDocument,
  storedVersion,
  localStorageAvailable,
  reducedMotion,
}: AppLaunchInputs): AppLaunchMode {
  if (!launchCandidate) return "none";
  // A document-lifetime guard, not session storage — Trusted Web Activity
  // and Chrome process reuse make sessionStorage an unreliable proxy for
  // "has this app launch already been shown."
  if (alreadyPlayedInDocument) return "none";
  if (reducedMotion) return "reduced";
  // A storage failure must fail open to the safe compact presentation, never
  // to "full" (which would wrongly assume a first-time visitor).
  if (!localStorageAvailable) return "compact";
  if (storedVersion !== APP_LAUNCH_VERSION) return "full";
  return "compact";
}
