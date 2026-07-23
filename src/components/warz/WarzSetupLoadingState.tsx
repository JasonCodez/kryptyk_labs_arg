function Placeholder({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-lg ${className ?? ""}`}
      style={{ background: "var(--pw-surface-2)", border: "1px solid var(--pw-border-subtle)" }}
    />
  );
}

/**
 * Stable, presentational placeholders for the Warz challenge-setup screen
 * while the initial puzzle/user/eligibility fetch is pending. Never renders
 * fabricated puzzle, balance, or wager data — only neutral, token-based shapes
 * matching the final setup layout.
 */
export default function WarzSetupLoadingState() {
  return (
    <div aria-label="Loading challenge setup" role="status" className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <span className="sr-only">Loading challenge setup…</span>
      <Placeholder className="h-24 w-full" />
      <Placeholder className="h-20 w-full" />
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Placeholder className="h-11 flex-1" />
          <Placeholder className="h-11 flex-1" />
          <Placeholder className="h-11 flex-1" />
        </div>
        <Placeholder className="h-11 w-full" />
      </div>
      <Placeholder className="h-11 w-full" />
      <Placeholder className="h-32 w-full" />
      <Placeholder className="h-16 w-full" />
      <Placeholder className="h-14 w-full" />
    </div>
  );
}
