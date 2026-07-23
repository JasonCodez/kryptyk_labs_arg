function Placeholder({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-lg ${className ?? ""}`}
      style={{ background: "var(--pw-surface-2)", border: "1px solid var(--pw-border-subtle)" }}
    />
  );
}

/**
 * Stable, presentational placeholders for the Warz battle-briefing screen
 * while the initial challenge/user fetch is pending. Never renders
 * fabricated challenger, puzzle, wager, pot, or balance data — only neutral,
 * token-based shapes matching the final briefing layout.
 */
export default function WarzChallengeLoadingState() {
  return (
    <div aria-label="Loading battle challenge" role="status" className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <span className="sr-only">Loading battle challenge…</span>
      <Placeholder className="h-20 w-full" />
      <Placeholder className="h-24 w-full" />
      <Placeholder className="h-24 w-full" />
      <Placeholder className="h-16 w-full" />
      <Placeholder className="h-32 w-full" />
      <Placeholder className="h-14 w-full" />
    </div>
  );
}
