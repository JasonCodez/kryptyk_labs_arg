// Haptic feedback via the Vibration API (Android/Chrome; silently unsupported on
// iOS Safari). Patterns are short by design — haptics should whisper, not buzz.

import { isHapticsEnabled } from "./prefs";

export type HapticCue = "tap" | "success" | "error" | "reward";

const patterns: Record<HapticCue, number | number[]> = {
  tap: 8,
  success: [12, 40, 24],
  error: [35, 50, 35],
  reward: [12, 30, 12, 30, 45],
};

/** Fire a named haptic pattern. No-ops when unsupported or disabled. */
export function haptic(cue: HapticCue) {
  if (!isHapticsEnabled()) return;
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(patterns[cue]);
  } catch {
    // never let feedback break the interaction
  }
}
