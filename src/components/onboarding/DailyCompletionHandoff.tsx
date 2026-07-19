"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GameButton from "@/components/game-ui/GameButton";
import { loadOnboardingState, type OnboardingState } from "@/lib/onboarding";

export interface DailyCompletionHandoffProps {
  userId: string | null;
  completed: boolean;
}

function isEligible(state: OnboardingState): boolean {
  return (
    (state.status === "active" || state.status === "paused") &&
    state.completedSteps.includes("first_puzzle_completed") &&
    state.completedSteps.includes("daily_introduced") &&
    !state.completedSteps.includes("library_puzzle_completed")
  );
}

/**
 * Read-only Starter Path handoff shown after completing a standard Daily
 * Puzzle, pointing the player at the puzzle library. Never writes onboarding
 * state — library_puzzle_completed is recorded only by
 * useLibraryStarterPathCompletion once the player actually finishes a
 * catalog puzzle, not by viewing this card.
 */
export default function DailyCompletionHandoff({ userId, completed }: DailyCompletionHandoffProps) {
  const router = useRouter();
  const [eligible, setEligible] = useState(false);

  // Re-derives from the localStorage-backed onboarding state (an external
  // system) each time userId/completed change — the allowed "synchronize
  // from an external system" case, not a response to React state.
  useEffect(() => {
    if (!userId || !completed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEligible(false);
      return;
    }
    setEligible(isEligible(loadOnboardingState(userId)));
  }, [userId, completed]);

  if (!eligible) return null;

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
        Starter Path // Next Objective
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        {/* Static completed checkmark — Daily mission is done, independent of color. */}
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 18,
            height: 18,
            flexShrink: 0,
            borderRadius: "50%",
            fontSize: 11,
            lineHeight: 1,
            background: "color-mix(in srgb, var(--pw-success) 20%, transparent)",
            border: "1px solid color-mix(in srgb, var(--pw-success) 60%, transparent)",
            color: "var(--pw-success)",
          }}
        >
          ✓
        </span>
        <h2 style={{ fontSize: 18, fontWeight: 900, color: "var(--pw-brand-primary)", margin: 0 }}>
          Daily mission complete.
        </h2>
      </div>

      <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--pw-text-secondary)", margin: "0 0 10px" }}>
        You&rsquo;ve seen how Daily Puzzles work. Now choose any puzzle from the library and complete it.
      </p>

      <p style={{ fontSize: 12, fontWeight: 800, color: "var(--pw-gold)", margin: "0 0 14px" }}>
        Starter Path • 2 of 4 complete
      </p>

      <div
        className="rounded-xl px-4 py-3 mb-5 text-left"
        style={{
          background: "color-mix(in srgb, var(--pw-brand-accent) 8%, transparent)",
          border: "1px solid color-mix(in srgb, var(--pw-brand-accent) 40%, transparent)",
        }}
      >
        <p
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--pw-brand-accent)",
            margin: "0 0 3px",
          }}
        >
          Step 3
        </p>
        <p style={{ fontSize: 14, fontWeight: 800, color: "var(--pw-text-primary)", margin: "0 0 3px" }}>
          Solve a puzzle from the library
        </p>
        <p style={{ fontSize: 12, lineHeight: 1.5, color: "var(--pw-text-muted)", margin: 0 }}>
          Pick a puzzle type that looks interesting. Your first completed library puzzle advances the Starter Path.
        </p>
      </div>

      <GameButton
        variant="primary"
        size="sm"
        onClick={() => router.push("/puzzles")}
        className="focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ outlineColor: "var(--pw-brand-secondary)" }}
      >
        Browse Puzzle Library
      </GameButton>
    </section>
  );
}
