"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GameButton from "@/components/game-ui/GameButton";
import {
  loadOnboardingState,
  type OnboardingState,
  type OnboardingStep,
} from "@/lib/onboarding";

/** The four Starter Path milestones, in order. Deliberately excludes the
 *  welcome and first_puzzle_started steps — those don't count toward the
 *  "X of 4" progress shown on the dashboard. */
const MILESTONES: readonly {
  step: OnboardingStep;
  objective: string;
  supporting: string;
  buttonLabel: string;
  destination: string;
}[] = [
  {
    step: "first_puzzle_completed",
    objective: "Complete your first guided solve",
    supporting: "Finish the short practice puzzle to learn the core loop.",
    buttonLabel: "Resume Rookie Run",
    destination: "/rookie-run",
  },
  {
    step: "daily_introduced",
    objective: "Discover today’s Daily Puzzle",
    supporting: "Try the featured challenge and begin building your daily rhythm.",
    buttonLabel: "Open Daily Puzzle",
    destination: "/daily",
  },
  {
    step: "library_puzzle_completed",
    objective: "Solve a puzzle from the library",
    supporting: "Choose a puzzle type that looks interesting and complete one.",
    buttonLabel: "Browse Puzzles",
    destination: "/puzzles",
  },
  {
    step: "leaderboard_introduced",
    objective: "See where your score lands",
    supporting: "Visit the leaderboard and see how PuzzleWarz competition works.",
    buttonLabel: "View Leaderboard",
    destination: "/leaderboards",
  },
];

interface StarterPathCardProps {
  userId: string;
}

/**
 * Compact dashboard mission card showing Starter Path progress and the next
 * objective. Read-only over onboarding state — it never records a step; the
 * destination surfaces do that when the player actually gets there.
 */
export default function StarterPathCard({ userId }: StarterPathCardProps) {
  const router = useRouter();
  // Loaded post-mount: localStorage isn't available during SSR.
  const [state, setState] = useState<OnboardingState | null>(null);

  useEffect(() => {
    setState(loadOnboardingState(userId));
  }, [userId]);

  if (!state) return null;
  if (state.status !== "active" && state.status !== "paused") return null;

  const completedCount = MILESTONES.filter((m) =>
    state.completedSteps.includes(m.step),
  ).length;
  if (completedCount >= MILESTONES.length) return null;

  const next = MILESTONES.find((m) => !state.completedSteps.includes(m.step))!;

  return (
    <section
      aria-label="Starter Path"
      className="pw-bevel"
      style={{
        marginBottom: 40,
        padding: "20px 22px",
        borderRadius: 16,
        background: "linear-gradient(170deg, var(--pw-surface-2) 0%, var(--pw-bg-elevated) 100%)",
        border: "1px solid color-mix(in srgb, var(--pw-brand-primary) 35%, var(--pw-border-default))",
        boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <h2
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--pw-brand-primary)",
            margin: 0,
          }}
        >
          Starter Path
        </h2>
        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--pw-text-muted)",
            margin: 0,
          }}
        >
          {completedCount} of {MILESTONES.length} complete
        </p>
      </div>

      {/* Four-segment progress indicator */}
      <ol
        aria-label={`Starter Path progress: ${completedCount} of ${MILESTONES.length} complete`}
        style={{
          display: "flex",
          gap: 6,
          listStyle: "none",
          margin: "0 0 16px",
          padding: 0,
        }}
      >
        {MILESTONES.map((m) => {
          const complete = state.completedSteps.includes(m.step);
          const current = m.step === next.step;
          const status = complete ? "complete" : current ? "current" : "upcoming";
          return (
            <li
              key={m.step}
              aria-label={`${m.objective} (${status})`}
              aria-current={current ? "step" : undefined}
              style={{
                flex: 1,
                minWidth: 0,
                height: 22,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 800,
                background: complete
                  ? "color-mix(in srgb, var(--pw-gold) 18%, transparent)"
                  : current
                    ? "color-mix(in srgb, var(--pw-brand-primary) 22%, transparent)"
                    : "color-mix(in srgb, var(--pw-border-default) 40%, transparent)",
                border: complete
                  ? "1px solid color-mix(in srgb, var(--pw-gold) 65%, transparent)"
                  : current
                    ? "1px solid color-mix(in srgb, var(--pw-brand-primary) 70%, transparent)"
                    : "1px solid var(--pw-border-default)",
                color: complete ? "var(--pw-gold)" : "var(--pw-brand-primary)",
              }}
            >
              <span aria-hidden>{complete ? "✓" : current ? "●" : ""}</span>
            </li>
          );
        })}
      </ol>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <p
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--pw-brand-accent)",
              margin: "0 0 3px",
            }}
          >
            Next Objective
          </p>
          <p
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: "var(--pw-text-primary)",
              margin: "0 0 3px",
            }}
          >
            {next.objective}
          </p>
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--pw-text-muted)",
              margin: 0,
            }}
          >
            {next.supporting}
          </p>
        </div>
        <GameButton
          variant="primary"
          size="sm"
          onClick={() => router.push(next.destination)}
          className="focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ outlineColor: "var(--pw-brand-secondary)" }}
        >
          {next.buttonLabel}
        </GameButton>
      </div>
    </section>
  );
}
