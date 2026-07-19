"use client";

import { useEffect, useRef } from "react";
import GameButton from "@/components/game-ui/GameButton";
import { useRegisterModal } from "@/hooks/useRegisterModal";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { OnboardingState } from "@/lib/onboarding";

export interface LibraryCompletionHandoffProps {
  open: boolean;
  onViewLeaderboard: () => void;
  onBrowseMore: () => void;
}

export function isLibraryCompletionHandoffEligible(state: OnboardingState): boolean {
  return (
    (state.status === "active" || state.status === "paused") &&
    state.completedSteps.includes("first_puzzle_completed") &&
    state.completedSteps.includes("daily_introduced") &&
    state.completedSteps.includes("library_puzzle_completed") &&
    !state.completedSteps.includes("leaderboard_introduced")
  );
}

const HEADING_ID = "library-completion-handoff-heading";

/**
 * Read-only Starter Path handoff shown as a compact modal after a genuine
 * catalog library-puzzle completion, once the existing XP -> comparison ->
 * rating sequence has been exited. Never writes onboarding state —
 * leaderboard_introduced is recorded only by LeaderboardIntroCard.
 */
export default function LibraryCompletionHandoff({
  open,
  onViewLeaderboard,
  onBrowseMore,
}: LibraryCompletionHandoffProps) {
  useRegisterModal("library-completion-handoff", open);
  useBodyScrollLock(open);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    primaryButtonRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onBrowseMore();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onBrowseMore]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={HEADING_ID}
        className="pw-bevel w-full max-w-sm"
        style={{
          padding: "20px 22px",
          borderRadius: 16,
          background: "linear-gradient(170deg, var(--pw-surface-2) 0%, var(--pw-bg-elevated) 100%)",
          border: "1px solid color-mix(in srgb, var(--pw-brand-primary) 35%, var(--pw-border-default))",
          boxShadow: "0 12px 34px rgba(0,0,0,0.45)",
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
          Starter Path // Step 3 Complete
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          {/* Static completed checkmark — completion is conveyed by the glyph
              and text, independent of color. */}
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
          <h2 id={HEADING_ID} style={{ fontSize: 18, fontWeight: 900, color: "var(--pw-brand-primary)", margin: 0 }}>
            Library puzzle complete.
          </h2>
        </div>

        <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--pw-text-secondary)", margin: "0 0 10px" }}>
          You&rsquo;ve completed a puzzle from the library. One final stop remains.
        </p>

        <p style={{ fontSize: 12, fontWeight: 800, color: "var(--pw-gold)", margin: "0 0 14px" }}>
          Starter Path • 3 of 4 complete
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
            Final Step
          </p>
          <p style={{ fontSize: 14, fontWeight: 800, color: "var(--pw-text-primary)", margin: "0 0 3px" }}>
            See where your score lands
          </p>
          <p style={{ fontSize: 12, lineHeight: 1.5, color: "var(--pw-text-muted)", margin: 0 }}>
            Open the Leaderboard to see how your points and completed puzzles compare with other players.
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <GameButton
            ref={primaryButtonRef}
            variant="primary"
            size="sm"
            onClick={onViewLeaderboard}
            className="focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ outlineColor: "var(--pw-brand-secondary)" }}
          >
            View Leaderboard
          </GameButton>
          <GameButton
            variant="secondary"
            size="sm"
            onClick={onBrowseMore}
            className="focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ outlineColor: "var(--pw-brand-secondary)" }}
          >
            Browse More Puzzles
          </GameButton>
        </div>
      </div>
    </div>
  );
}
