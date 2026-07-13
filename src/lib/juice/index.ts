// The juice API — one import for coordinated feedback (sound + haptics together).
// Use these combos rather than calling playSound/haptic separately so every
// interaction in the app speaks the same feedback language:
//
//   juice.tap()      → any press            (soft click + 8ms tick)
//   juice.tick()     → toggles / detents    (wooden tick)
//   juice.pop()      → card flip / select   (satisfying pop)
//   juice.whoosh()   → menu / panel opens   (paper shuffle)
//   juice.success()  → correct answer       (sparkle triad + double-pulse)
//   juice.error()    → incorrect answer     (soft thud + firm buzz)
//   juice.unlock()   → new content unlocked (lock opening)
//   juice.reward()   → XP / coins / levels  (chime fanfare + celebration buzz)

import { playSound } from "./sound";
import { haptic } from "./haptics";

export { playSound, type SoundCue } from "./sound";
export { haptic, type HapticCue } from "./haptics";
export {
  isSoundEnabled,
  isHapticsEnabled,
  setSoundEnabled,
  setHapticsEnabled,
  prefersReducedMotion,
  JUICE_PREFS_EVENT,
} from "./prefs";

export const juice = {
  tap: () => { playSound("tap"); haptic("tap"); },
  tick: () => { playSound("tick"); haptic("tap"); },
  pop: () => { playSound("pop"); haptic("tap"); },
  whoosh: () => { playSound("whoosh"); },
  success: () => { playSound("success"); haptic("success"); },
  error: () => { playSound("error"); haptic("error"); },
  unlock: () => { playSound("unlock"); haptic("success"); },
  reward: () => { playSound("reward"); haptic("reward"); },
};
