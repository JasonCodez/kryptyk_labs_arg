"use client";

import { useEffect, useRef, useState } from "react";
import GameButton from "@/components/game-ui/GameButton";
import {
  completeOnboardingStep,
  loadOnboardingState,
  type OnboardingState,
} from "@/lib/onboarding";

interface DailyIntroCardProps {
  userId: string;
}

function isEligible(state: OnboardingState): boolean {
  return (
    (state.status === "active" || state.status === "paused") &&
    state.completedSteps.includes("first_puzzle_completed") &&
    !state.completedSteps.includes("daily_introduced")
  );
}

/**
 * One-time Starter Path introduction shown on first arrival at /daily after
 * Rookie Run's first solve. Records daily_introduced exactly once on mount
 * when eligible, then stays visible for the rest of this page visit off
 * local state — a later visit sees daily_introduced already complete and
 * skips rendering entirely.
 */
export default function DailyIntroCard({ userId }: DailyIntroCardProps) {
  const [visible, setVisible] = useState(false);
  const recordedRef = useRef(false);
  const dismissButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (recordedRef.current) return;
    recordedRef.current = true;
    const state = loadOnboardingState(userId);
    if (!isEligible(state)) return;
    completeOnboardingStep(userId, "daily_introduced");
    // One-time reveal tied to the localStorage write above, not a response to
    // React state — the allowed "synchronize from an external system" case.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true);
  }, [userId]);

  if (!visible) return null;

  return (
    <section
      aria-label="Starter Path"
      className="pw-bevel w-full max-w-5xl mb-6"
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
        Starter Path // Step 2
      </p>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 900,
          color: "var(--pw-brand-primary)",
          margin: "0 0 6px",
        }}
      >
        Fresh puzzles arrive every day.
      </h2>
      <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--pw-text-secondary)", margin: "0 0 10px" }}>
        Choose any Daily Puzzle below. Daily challenges refresh each day, and completing them can build your streak.
      </p>
      <p style={{ fontSize: 12, fontWeight: 800, color: "var(--pw-gold)", margin: "0 0 6px" }}>
        Starter Path • 2 of 4 discovered
      </p>
      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--pw-text-muted)", margin: "0 0 14px" }}>
        Pick the puzzle that looks most interesting.
      </p>
      {/* No Daily-grid ref is threaded in here, so on dismiss focus stays on
          this button rather than jumping to the puzzle grid — moving it there
          would require plumbing a ref through the Daily page's card list. */}
      <GameButton
        ref={dismissButtonRef}
        variant="primary"
        size="sm"
        onClick={() => setVisible(false)}
        className="focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ outlineColor: "var(--pw-brand-secondary)" }}
      >
        Got It — Show Me the Puzzles
      </GameButton>
    </section>
  );
}
