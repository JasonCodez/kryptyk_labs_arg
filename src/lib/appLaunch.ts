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
  sessionSeen: boolean;
  storedVersion: string | null;
  reducedMotion: boolean;
}

export function resolveAppLaunchMode({
  launchCandidate,
  standalone,
  sessionSeen,
  storedVersion,
  reducedMotion,
}: AppLaunchInputs): AppLaunchMode {
  if (!launchCandidate) return "none";
  if (!standalone) return "none";
  if (sessionSeen) return "none";
  if (reducedMotion) return "reduced";
  if (storedVersion !== APP_LAUNCH_VERSION) return "full";
  return "compact";
}
