"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  CircleAlert,
  Coins,
  Crown,
  Grid2X2,
  RotateCcw,
  Scale,
  ShieldX,
  Swords,
} from "lucide-react";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";
import {
  createWarzResultViewModel,
  type WarzResultChallenge,
  type WarzViewerOutcome,
} from "@/lib/warzResult";
import WarzResultScoreboard from "@/components/warz/WarzResultScoreboard";
import WarzResultShare from "@/components/warz/WarzResultShare";

interface WarzBattleResultProps {
  challenge: WarzResultChallenge;
  currentUserId: string;
  challengeUrl: string;
  completionError?: string | null;
  retryingCompletion?: boolean;
  onRetryCompletion?: () => void;
  onReturnToWarz: () => void;
  onBrowsePuzzles: () => void;
}

function OutcomeIcon({
  outcome,
  className,
  color,
}: {
  outcome: WarzViewerOutcome;
  className: string;
  color: string;
}) {
  const props = { "aria-hidden": true as const, className, size: 42, style: { color } };
  if (outcome === "victory") return <Crown {...props} />;
  if (outcome === "defeat") return <ShieldX {...props} />;
  if (outcome === "draw") return <Scale {...props} />;
  if (outcome === "neutral") return <Swords {...props} />;
  return <CircleAlert {...props} />;
}

function outcomeColor(outcome: WarzViewerOutcome) {
  if (outcome === "victory") return "var(--pw-success)";
  if (outcome === "defeat") return "var(--pw-warning)";
  if (outcome === "draw") return "var(--pw-brand-secondary)";
  if (outcome === "neutral") return "var(--pw-brand-primary)";
  return "var(--pw-error-text)";
}

export default function WarzBattleResult({
  challenge,
  currentUserId,
  challengeUrl,
  completionError = null,
  retryingCompletion = false,
  onRetryCompletion,
  onReturnToWarz,
  onBrowsePuzzles,
}: WarzBattleResultProps) {
  const reduceMotion = useAppReducedMotion();
  const model = createWarzResultViewModel(challenge, currentUserId);
  const accent = completionError ? "var(--pw-error-text)" : outcomeColor(model.viewerOutcome);
  const entrance = reduceMotion ? undefined : { opacity: 0, y: 14, scale: 0.985 };
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.28 };

  if (completionError) {
    return (
      <motion.main
        data-testid="warz-battle-result"
        initial={entrance}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={transition}
        className="mx-auto w-full max-w-2xl rounded-3xl p-5 text-center shadow-xl sm:p-8"
        style={{ background: "var(--pw-surface-1)", border: "1px solid var(--pw-error)" }}
      >
        <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: "var(--pw-brand-secondary)" }}>
          Puzzle Warz
        </p>
        <OutcomeIcon outcome="unavailable" className="mx-auto mt-5" color={accent} />
        <h1 className="mt-4 text-2xl font-black uppercase sm:text-3xl" style={{ color: "var(--pw-text-primary)" }}>
          Result Not Recorded
        </h1>
        <p className="mt-3 text-sm font-semibold" style={{ color: "var(--pw-text-secondary)" }}>
          Your battle result has not been confirmed yet.
        </p>
        <p
          role="alert"
          className="mx-auto mt-5 max-w-lg rounded-xl p-3 text-sm"
          style={{
            color: "var(--pw-error-text)",
            background: "color-mix(in srgb, var(--pw-error) 10%, var(--pw-surface-2))",
          }}
        >
          {completionError}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {onRetryCompletion && (
            <button
              type="button"
              onClick={onRetryCompletion}
              disabled={retryingCompletion}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-50"
              style={{ minHeight: 48, color: "var(--pw-bg-base)", background: "var(--pw-brand-secondary)" }}
            >
              <RotateCcw aria-hidden="true" size={18} />
              {retryingCompletion ? "Retrying…" : "Retry Submission"}
            </button>
          )}
          <button
            type="button"
            onClick={onReturnToWarz}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold"
            style={{
              minHeight: 48,
              color: "var(--pw-text-primary)",
              background: "var(--pw-surface-2)",
              border: "1px solid var(--pw-border-default)",
            }}
          >
            <ArrowLeft aria-hidden="true" size={18} />
            Return to Warz
          </button>
        </div>
      </motion.main>
    );
  }

  const unavailable = model.viewerOutcome === "unavailable";

  return (
    <motion.main
      data-testid="warz-battle-result"
      data-viewer-outcome={model.viewerOutcome}
      initial={entrance}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={transition}
      className="mx-auto w-full max-w-3xl rounded-3xl p-4 shadow-xl sm:p-7 lg:p-8"
      style={{
        background: "var(--pw-surface-1)",
        border: `1px solid color-mix(in srgb, ${accent} 45%, var(--pw-border-default))`,
      }}
    >
      <header className="text-center">
        <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: "var(--pw-brand-secondary)" }}>
          Puzzle Warz
        </p>
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.22 }}
        >
          <OutcomeIcon outcome={model.viewerOutcome} className="mx-auto mt-4" color={accent} />
        </motion.div>
        <h1
          data-testid="result-headline"
          className="mt-3 break-words text-3xl font-black sm:text-4xl"
          style={{ color: "var(--pw-text-primary)" }}
        >
          {model.headline}
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm sm:text-base" style={{ color: "var(--pw-text-secondary)" }}>
          {model.supportingCopy}
        </p>
        <div className="mt-5">
          <p className="break-words text-base font-extrabold" style={{ color: "var(--pw-text-primary)" }}>
            {model.puzzleTitle}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--pw-brand-primary)" }}>
            {model.puzzleTypeLabel}
          </p>
        </div>
      </header>

      {!unavailable && (
        <motion.div
          className="mt-7"
          initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.22, delay: 0.05 }}
        >
          <WarzResultScoreboard
            challenger={model.challenger}
            opponent={model.opponent}
            battleOutcome={model.battleOutcome}
          />
        </motion.div>
      )}

      <motion.section
        data-testid="result-economy"
        aria-labelledby="warz-economy-heading"
        className="mt-6 rounded-2xl p-5 text-center"
        initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.22, delay: 0.1 }}
        style={{
          background: "var(--pw-surface-2)",
          border: "1px solid var(--pw-border-default)",
        }}
      >
        <Coins aria-hidden="true" className="mx-auto" size={24} style={{ color: accent }} />
        <h2
          id="warz-economy-heading"
          className="mt-2 text-xs font-black uppercase tracking-[0.18em]"
          style={{ color: "var(--pw-text-muted)" }}
        >
          {model.economyLabel}
        </h2>
        <p className="mt-1 text-2xl font-black tabular-nums" style={{ color: "var(--pw-text-primary)" }}>
          {model.economyValue}
        </p>
        <p className="mt-2 text-xs sm:text-sm" style={{ color: "var(--pw-text-secondary)" }}>
          {model.economySupport}
        </p>
      </motion.section>

      <motion.div
        data-testid="result-actions"
        className="mt-6 flex flex-col gap-3"
        initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.22, delay: 0.15 }}
      >
        {!unavailable && (
          <WarzResultShare
            title={model.shareTitle}
            text={model.shareText}
            url={challengeUrl}
          />
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onReturnToWarz}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold"
            style={{
              minHeight: 48,
              color: "var(--pw-bg-base)",
              background: "var(--pw-brand-primary)",
            }}
          >
            <ArrowLeft aria-hidden="true" size={18} />
            Return to Warz
          </button>
          <button
            type="button"
            onClick={onBrowsePuzzles}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold"
            style={{
              minHeight: 44,
              color: "var(--pw-text-primary)",
              background: "var(--pw-surface-2)",
              border: "1px solid var(--pw-border-default)",
            }}
          >
            <Grid2X2 aria-hidden="true" size={18} />
            Browse Puzzles
          </button>
        </div>
      </motion.div>
    </motion.main>
  );
}
