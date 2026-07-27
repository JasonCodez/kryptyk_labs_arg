/**
 * Pure launch-mode resolver for the branded PWA launch sequence
 * (AppSplashScreen). No browser globals, no React — inputs in, mode out, so
 * the decision logic can be unit-tested without jsdom.
 */

// Bumped so devices that previously persisted version "1" move onto the
// corrected launch-sequence version. The resolver now plays the full sequence
// on every eligible document launch rather than only once per stored version.
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

// storedVersion/localStorageAvailable remain part of AppLaunchInputs (and are
// still read/persisted by AppSplashScreen) but no longer affect the decision
// below — every eligible launch now gets the full tile-assembly animation,
// not just the first one per device. "compact" is kept as a valid
// AppLaunchMode (and AppSplashScreen still knows how to render it) purely so
// that mode isn't a breaking type change if a leaner repeat-visit mode is
// reintroduced later; resolveAppLaunchMode itself never produces it anymore.
export function resolveAppLaunchMode({
  launchCandidate,
  alreadyPlayedInDocument,
  reducedMotion,
}: AppLaunchInputs): AppLaunchMode {
  if (!launchCandidate) return "none";
  // A document-lifetime guard, not session storage — Trusted Web Activity
  // and Chrome process reuse make sessionStorage an unreliable proxy for
  // "has this app launch already been shown."
  if (alreadyPlayedInDocument) return "none";
  if (reducedMotion) return "reduced";
  return "full";
}
