"use client";

function IconCompletionBadge() {
  return (
    <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5 11 15l4.5-5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export type JigsawCompletionCardProps = {
  awardedPoints: number | null;
  funFact?: string;
};

export default function JigsawCompletionCard({ awardedPoints, funFact }: JigsawCompletionCardProps) {
  const trimmedFact = funFact?.trim();
  const hasFact = !!trimmedFact;
  const hasPoints = awardedPoints !== null;

  return (
    <section className="jigsaw-completion-card" aria-label="Puzzle completion reward">
      <div className="jigsaw-completion-card-icon"><IconCompletionBadge /></div>

      <div className="jigsaw-completion-card-eyebrow">PUZZLE COMPLETE</div>

      <h2 className="jigsaw-completion-card-title">Beautiful work!</h2>

      <p className="jigsaw-completion-card-support">Every piece is in place.</p>

      <div className="jigsaw-completion-reward">
        <span className="jigsaw-completion-reward-amount">
          {hasPoints ? `+${awardedPoints}` : "…"}
        </span>
        <span className="jigsaw-completion-reward-label">POINTS</span>
      </div>

      <p className="jigsaw-completion-reward-support">
        {hasPoints ? "Added to your PuzzleWarz total." : "Confirming your reward."}
      </p>

      {hasFact && (
        <div className="jigsaw-completion-fact">
          <div className="jigsaw-completion-fact-label">FUN FACT</div>
          <div className="jigsaw-completion-fact-text">{trimmedFact}</div>
        </div>
      )}
    </section>
  );
}
