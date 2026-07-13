// The juice API — one import for coordinated feedback (haptics). Use these
// combos rather than calling haptic directly so every interaction in the app
// speaks the same feedback language:
//
//   juice.tap()      → any press            (8ms tick)
//   juice.tick()     → toggles / detents    (8ms tick)
//   juice.pop()      → card flip / select   (8ms tick)
//   juice.whoosh()   → menu / panel opens   (no haptic — motion carries it)
//   juice.success()  → correct answer       (double-pulse)
//   juice.error()    → incorrect answer     (firm buzz)
//   juice.unlock()   → new content unlocked (double-pulse)
//   juice.reward()   → XP / coins / levels  (celebration buzz)

import { haptic } from "./haptics";

export { haptic, type HapticCue } from "./haptics";
export {
  isHapticsEnabled,
  setHapticsEnabled,
  prefersReducedMotion,
  JUICE_PREFS_EVENT,
} from "./prefs";

export const juice = {
  tap: () => haptic("tap"),
  tick: () => haptic("tap"),
  pop: () => haptic("tap"),
  whoosh: () => {},
  success: () => haptic("success"),
  error: () => haptic("error"),
  unlock: () => haptic("success"),
  reward: () => haptic("reward"),
};
