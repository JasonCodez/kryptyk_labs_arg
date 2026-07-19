"use client";

export interface HiddenWordRoundStatusProps {
  wordLength: number;
  guessesUsed: number;
  maxGuesses: number;
  showHelp: boolean;
  finalAttempt: boolean;
  onHelp: () => void;
}

/** Decorative question-mark emblem for the Help control. */
function IconHelp({ color }: { color: string }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
      <path
        d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.29c-.73.33-1 .77-1 1.46v.25"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="17" r="0.9" fill={color} />
    </svg>
  );
}

/**
 * Compact single-row status bar for the Hidden Word puzzle — replaces the
 * old large gradient "HIDDEN WORD" heading and the separate ATTEMPT METER
 * bar. Presentational only; the puzzle owns the guess/round state.
 */
export default function HiddenWordRoundStatus({
  wordLength,
  guessesUsed,
  maxGuesses,
  showHelp,
  finalAttempt,
  onHelp,
}: HiddenWordRoundStatusProps) {
  return (
    <div className="w-full px-2" style={{ maxWidth: 420 }}>
      <div
        className="flex items-center justify-between gap-2 w-full"
        style={{
          minHeight: 44,
          padding: "4px 8px",
          borderRadius: 10,
          background: "rgba(10,16,28,0.55)",
          border: "1px solid var(--skin-board-border, rgba(148,163,184,0.3))",
        }}
      >
        <span
          className="text-[11px] font-bold uppercase tracking-widest whitespace-nowrap"
          style={{ color: "var(--pw-info)" }}
        >
          {wordLength} letters
        </span>

        <span
          className="text-[11px] font-bold uppercase tracking-widest whitespace-nowrap"
          style={{ color: "var(--pw-text-primary)" }}
        >
          {guessesUsed} / {maxGuesses} guesses
        </span>

        {showHelp && (
          <button
            type="button"
            onClick={onHelp}
            aria-label="How to play Hidden Word"
            className="flex items-center justify-center rounded-full shrink-0"
            style={{
              width: 44,
              height: 44,
              minWidth: 44,
              minHeight: 44,
              background: "color-mix(in srgb, var(--pw-info) 12%, transparent)",
              border: "1px solid var(--pw-info-border)",
            }}
          >
            <IconHelp color="var(--pw-info)" />
          </button>
        )}
      </div>

      {finalAttempt && (
        <p
          className="text-[10px] mt-1 text-center font-semibold uppercase tracking-wide"
          style={{ color: "#f97316" }}
        >
          Final attempt — rewards halved
        </p>
      )}
    </div>
  );
}
