/**
 * Pure launch-mode resolver for the branded PWA launch sequence
 * (AppSplashScreen). No browser globals, no React — inputs in, mode out, so
 * the decision logic can be unit-tested without jsdom.
 */

export const APP_LAUNCH_VERSION = "1";

export const APP_LAUNCH_SESSION_KEY = "pw_app_launch_session";
export const APP_LAUNCH_VERSION_KEY = "pw_app_launch_version";

export type AppLaunchMode = "none" | "full" | "compact" | "reduced";

export interface AppLaunchInputs {
  launchCandidate: boolean;
  standalone: boolean;
  /** Only meaningful when sessionStorageAvailable is true. */
  sessionSeen: boolean;
  sessionStorageAvailable: boolean;
  storedVersion: string | null;
  localStorageAvailable: boolean;
  reducedMotion: boolean;
}

export function resolveAppLaunchMode({
  launchCandidate,
  standalone,
  sessionSeen,
  sessionStorageAvailable,
  storedVersion,
  localStorageAvailable,
  reducedMotion,
}: AppLaunchInputs): AppLaunchMode {
  if (!launchCandidate) return "none";
  if (!standalone) return "none";
  // Unreadable session storage must never be treated as "already seen" — an
  // unreadable store can never suppress an otherwise-eligible launch.
  if (sessionStorageAvailable && sessionSeen) return "none";
  if (reducedMotion) return "reduced";
  // A storage failure must fail open to the safe compact presentation, never
  // to "full" (which would wrongly assume a first-time visitor) and never to
  // silence (which would wrongly suppress an eligible launch).
  if (!sessionStorageAvailable || !localStorageAvailable) return "compact";
  if (storedVersion !== APP_LAUNCH_VERSION) return "full";
  return "compact";
}
