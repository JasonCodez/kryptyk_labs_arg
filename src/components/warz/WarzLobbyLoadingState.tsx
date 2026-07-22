import type { CSSProperties } from "react";

function Placeholder({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      className={`rounded-lg ${className ?? ""}`}
      style={{ background: "var(--pw-surface-2)", border: "1px solid var(--pw-border-subtle)", ...style }}
    />
  );
}

/**
 * Stable, presentational placeholders for the Warz lobby while the initial
 * fetch is pending. Never renders fabricated challenge/user data — only
 * neutral, token-based shapes matching the final layout.
 */
export default function WarzLobbyLoadingState() {
  return (
    <div aria-label="Loading Warz arena" role="status" className="flex flex-col gap-6">
      <ul className="flex flex-wrap items-center justify-center gap-6">
        {[0, 1, 2].map((key) => (
          <li key={key}>
            <Placeholder className="h-4 w-28" />
          </li>
        ))}
      </ul>

      <Placeholder className="h-24 w-full" />

      <div className="flex gap-2">
        <Placeholder className="h-11 flex-1" />
        <Placeholder className="h-11 flex-1" />
        <Placeholder className="h-11 flex-1" />
      </div>

      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((key) => (
          <Placeholder key={key} className="h-24 w-full" />
        ))}
      </div>

      <span className="sr-only">Loading the Warz arena…</span>
    </div>
  );
}
