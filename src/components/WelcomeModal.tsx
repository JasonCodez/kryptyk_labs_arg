"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GameButton from "@/components/game-ui/GameButton";
import { useRegisterModal } from "@/hooks/useRegisterModal";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";
import {
  completeOnboardingStep,
  getOnboardingStorageKey,
  loadOnboardingState,
  skipOnboarding,
  startOnboarding,
} from "@/lib/onboarding";

/* ── Rookie Run progress rail ───────────────────────────────────────── */

type StageState = "active" | "upcoming";

// "Celebrate" is the destination — it carries the trophy-gold treatment even
// while upcoming, so the rail reads start → reward at a glance.
const STAGES: { label: string; state: StageState; gold?: boolean }[] = [
  { label: "Learn", state: "active" },
  { label: "Solve", state: "upcoming" },
  { label: "Celebrate", state: "upcoming", gold: true },
];

function stageNodeStyle(stage: (typeof STAGES)[number]): React.CSSProperties {
  if (stage.state === "active") {
    return {
      background: "color-mix(in srgb, var(--pw-brand-primary) 22%, transparent)",
      border: "2px solid var(--pw-brand-primary)",
      color: "var(--pw-brand-primary)",
      boxShadow: "0 0 12px color-mix(in srgb, var(--pw-brand-primary) 35%, transparent)",
    };
  }
  if (stage.gold) {
    return {
      background: "color-mix(in srgb, var(--pw-brand-secondary) 10%, transparent)",
      border: "2px solid color-mix(in srgb, var(--pw-brand-secondary) 55%, transparent)",
      color: "var(--pw-brand-secondary)",
    };
  }
  return {
    background: "transparent",
    border: "2px solid var(--pw-border-default)",
    color: "var(--pw-text-muted)",
  };
}

function ProgressRail() {
  return (
    <ol aria-label="Rookie Run progress" className="flex items-start justify-center mb-7 list-none p-0 m-0">
      {STAGES.map((stage, i) => (
        <li
          key={stage.label}
          aria-current={stage.state === "active" ? "step" : undefined}
          className="flex items-start"
        >
          {i > 0 && (
            <span
              aria-hidden
              className="block w-6 sm:w-10 h-[2px] mt-[15px]"
              style={{
                background:
                  stage.gold
                    ? "linear-gradient(90deg, var(--pw-border-default), color-mix(in srgb, var(--pw-brand-secondary) 45%, transparent))"
                    : "var(--pw-border-default)",
              }}
            />
          )}
          <span className="flex flex-col items-center gap-1.5 w-16">
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black"
              style={stageNodeStyle(stage)}
            >
              {stage.gold ? "🏆" : i + 1}
            </span>
            <span
              className="text-[10px] font-bold tracking-widest uppercase"
              style={{
                color:
                  stage.state === "active"
                    ? "var(--pw-brand-primary)"
                    : stage.gold
                      ? "color-mix(in srgb, var(--pw-brand-secondary) 75%, var(--pw-text-muted))"
                      : "var(--pw-text-muted)",
              }}
            >
              {stage.label}
            </span>
            <span className="sr-only">{stage.state === "active" ? "(active)" : "(upcoming)"}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/* ── Main component ─────────────────────────────────────────────────── */

interface WelcomeModalProps {
  userId: string;
}

/**
 * Rookie Run mission briefing — shown once to genuinely new users (v1
 * onboarding state "not_started"). Legacy users who already dismissed the old
 * welcome flow (pw_welcomed_<userId>) but have no v1 record are migrated to
 * "skipped" so onboarding never resurfaces for them; the legacy key itself is
 * left untouched.
 */
export default function WelcomeModal({ userId }: WelcomeModalProps) {
  const [visible, setVisible] = useState(false);
  useRegisterModal("welcome-modal", visible);
  const reduceMotion = useAppReducedMotion();

  useEffect(() => {
    let hasOnboardingRecord = false;
    let legacyWelcomed = false;
    try {
      hasOnboardingRecord = localStorage.getItem(getOnboardingStorageKey(userId)) !== null;
      legacyWelcomed = localStorage.getItem(`pw_welcomed_${userId}`) !== null;
    } catch {
      return; // storage blocked — never show rather than re-welcoming on every visit
    }
    if (!hasOnboardingRecord && legacyWelcomed) {
      skipOnboarding(userId);
      return;
    }
    if (loadOnboardingState(userId).status !== "not_started") return;
    // Short delay so the dashboard can render first
    const t = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(t);
  }, [userId]);

  function beginRookieRun() {
    startOnboarding(userId);
    completeOnboardingStep(userId, "welcome");
    setVisible(false);
  }

  function exploreOnMyOwn() {
    skipOnboarding(userId);
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[200] overflow-y-auto"
          style={{ backgroundColor: "color-mix(in srgb, var(--pw-bg-base) 60%, transparent)", backdropFilter: "blur(4px)" }}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.25 }}
        >
          <div className="flex min-h-[100dvh] items-center justify-center px-4 py-8">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="rookie-run-heading"
              className="relative w-full rounded-3xl overflow-hidden text-center"
              style={{
                maxWidth: 440,
                background: "linear-gradient(170deg, var(--pw-surface-2) 0%, var(--pw-bg-elevated) 100%)",
                border: "1px solid var(--pw-border-default)",
                boxShadow: "var(--pw-shadow-panel)",
              }}
              initial={reduceMotion ? false : { scale: 0.94, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { scale: 0.97, opacity: 0, y: 12 }}
              transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 24 }}
            >
              {/* Static top hairline — brand blue into trophy gold */}
              <div
                aria-hidden
                className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ background: "linear-gradient(90deg, transparent, var(--pw-brand-primary), var(--pw-brand-secondary), transparent)", opacity: 0.8 }}
              />

              <div className="px-6 sm:px-8 pt-9 pb-8">
                {/* Emblem */}
                <div className="flex justify-center mb-5">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{
                      background: "color-mix(in srgb, var(--pw-brand-primary) 12%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--pw-brand-primary) 35%, transparent)",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/puzzle_warz_logo.png" alt="" className="w-11 h-11 object-contain" />
                  </div>
                </div>

                {/* Mission header */}
                <p
                  className="text-[11px] font-bold tracking-[0.22em] uppercase mb-3"
                  style={{ color: "var(--pw-brand-primary)" }}
                >
                  Rookie Run // Mission 01
                </p>
                <h1
                  id="rookie-run-heading"
                  className="text-2xl sm:text-3xl font-black mb-3 leading-tight"
                  style={{ letterSpacing: "-0.02em", color: "var(--pw-text-primary)" }}
                >
                  Your first solve starts here.
                </h1>
                <p className="text-sm leading-relaxed mb-7 mx-auto" style={{ color: "var(--pw-text-secondary)", maxWidth: 340 }}>
                  Learn the basics through one short guided puzzle. No pressure, no complicated setup—just solve and see how PuzzleWarz works.
                </p>

                <ProgressRail />

                {/* Objective panel — orange reserved for the small mission accent */}
                <div
                  className="rounded-2xl text-left px-5 py-4 mb-7"
                  style={{
                    background: "color-mix(in srgb, var(--pw-surface-3) 55%, transparent)",
                    border: "1px solid var(--pw-border-subtle)",
                  }}
                >
                  <p
                    className="text-[10px] font-bold tracking-[0.2em] uppercase mb-1.5"
                    style={{ color: "var(--pw-brand-accent)" }}
                  >
                    First Objective
                  </p>
                  <p className="text-sm font-bold mb-1" style={{ color: "var(--pw-text-primary)" }}>
                    Complete a guided starter puzzle
                  </p>
                  <p className="text-xs" style={{ color: "var(--pw-text-secondary)" }}>
                    Practice run • About 2 minutes • No timer pressure
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3">
                  <GameButton variant="primary" fullWidth onClick={beginRookieRun}>
                    Begin Rookie Run
                  </GameButton>
                  <button
                    onClick={exploreOnMyOwn}
                    className="text-xs font-semibold py-2 transition-opacity duration-150 opacity-80 hover:opacity-100"
                    style={{ color: "var(--pw-text-secondary)", background: "none", border: "none", cursor: "pointer" }}
                  >
                    Explore on My Own
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
