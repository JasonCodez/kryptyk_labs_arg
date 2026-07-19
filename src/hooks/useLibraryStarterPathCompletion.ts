import { useEffect, useRef } from "react";
import { completeOnboardingStep, loadOnboardingState } from "@/lib/onboarding";

export interface UseLibraryStarterPathCompletionOptions {
  userId: string | null;
  completed: boolean;
  enabled?: boolean;
}

/**
 * Records library_puzzle_completed the first time an eligible Starter Path
 * player successfully completes a normal catalog puzzle. Purely a
 * side-effecting hook — it renders nothing and never touches points, XP,
 * streaks, or the puzzle's own completion flow.
 */
export function useLibraryStarterPathCompletion(
  options: UseLibraryStarterPathCompletionOptions,
): void {
  const { userId, completed, enabled = true } = options;
  const recordedRef = useRef(false);

  useEffect(() => {
    if (recordedRef.current) return;
    if (!userId || !completed || !enabled) return;

    const state = loadOnboardingState(userId);
    const eligible =
      (state.status === "active" || state.status === "paused") &&
      state.completedSteps.includes("first_puzzle_completed") &&
      state.completedSteps.includes("daily_introduced") &&
      !state.completedSteps.includes("library_puzzle_completed");
    if (!eligible) return;

    recordedRef.current = true;
    completeOnboardingStep(userId, "library_puzzle_completed");
  }, [userId, completed, enabled]);
}
