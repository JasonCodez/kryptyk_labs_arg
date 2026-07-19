"use client";

import { useEffect, useRef, useState } from "react";
import GameButton from "@/components/game-ui/GameButton";
import {
  completeOnboardingStep,
  loadOnboardingState,
  type OnboardingState,
} from "@/lib/onboarding";

interface LeaderboardIntroCardProps {
  userId: string;
}

function isEligible(state: OnboardingState): boolean {
  return (
    (state.status === "active" || state.status === "paused") &&
    state.completedSteps.includes("first_puzzle_completed") &&
    state.completedSteps.includes("daily_introduced") &&
    state.completedSteps.includes("library_puzzle_completed") &&
    !state.completedSteps.includes("leaderboard_introduced")
  );
}

/**
 * One-time Starter Path introduction shown on first arrival at /leaderboards
 * once the first three milestones are done. Records leaderboard_introduced
 * exactly once on mount when eligible — completing this fourth milestone
 * naturally drives the onboarding state model to "completed" on its own
 * (see completeOnboardingStep), so this never calls completeOnboarding
 * directly. Stays visible for the rest of this page visit off local state;
 * a later visit sees onboarding already completed and skips rendering.
 */
export default function LeaderboardIntroCard({ userId }: LeaderboardIntroCardProps) {
  const [visible, setVisible] = useState(false);
  const recordedRef = useRef(false);
  const dismissButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (recordedRef.current) return;
    recordedRef.current = true;
    const state = loadOnboardingState(userId);
    if (!isEligible(state)) return;
    completeOnboardingStep(userId, "leaderboard_introduced");
    // One-time reveal tied to the localStorage write above, not a response to
    // React state — the allowed "synchronize from an external system" case.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true);
  }, [userId]);

  if (!visible) return null;

  return (
    <section
      aria-label="Starter Path"
      className="pw-bevel w-full mb-6"
      style={{
        padding: "18px 20px",
        borderRadius: 16,
        background: "linear-gradient(170deg, var(--pw-surface-2) 0%, var(--pw-bg-elevated) 100%)",
        border: "1px solid color-mix(in srgb, var(--pw-brand-primary) 35%, var(--pw-border-default))",
        boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
      }}
    >
      <p
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--pw-brand-accent)",
          margin: "0 0 6px",
        }}
      >
        Starter Path // Final Step
      </p>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 900,
          color: "var(--pw-brand-primary)",
          margin: "0 0 6px",
        }}
      >
        This is where every solve counts.
      </h2>
      <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--pw-text-secondary)", margin: "0 0 10px" }}>
        Your points and completed puzzles determine your position. Use the Global, Weekly, Monthly, and Following
        tabs to compare different kinds of progress.
      </p>
      <p
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          fontWeight: 800,
          color: "var(--pw-gold)",
          margin: "0 0 6px",
        }}
      >
        {/* Static checkmark emblem — completion is conveyed by the glyph and
            text, not by color alone. */}
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 16,
            height: 16,
            borderRadius: "50%",
            fontSize: 10,
            lineHeight: 1,
            background: "color-mix(in srgb, var(--pw-gold) 22%, transparent)",
            border: "1px solid color-mix(in srgb, var(--pw-gold) 65%, transparent)",
            color: "var(--pw-gold)",
          }}
        >
          ✓
        </span>
        Starter Path Complete • 4 of 4
      </p>
      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--pw-text-muted)", margin: "0 0 14px" }}>
        Keep solving puzzles to move up the rankings.
      </p>
      {/* Button intentionally does not navigate or change the active tab — it
          only dismisses the card for the rest of this visit. */}
      <GameButton
        ref={dismissButtonRef}
        variant="primary"
        size="sm"
        onClick={() => setVisible(false)}
        className="focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ outlineColor: "var(--pw-brand-secondary)" }}
      >
        Got It — View Rankings
      </GameButton>
    </section>
  );
}
