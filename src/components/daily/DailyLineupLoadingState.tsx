"use client";

/**
 * Static loading skeleton for the Daily Puzzle Lineup — no spinner, shimmer, or
 * animation. Six placeholder rows matching the grid layout of DailyPuzzleLineup.
 */
export default function DailyLineupLoadingState() {
  return (
    <section aria-labelledby="daily-lineup-loading-heading" className="w-full max-w-5xl">
      <h2
        id="daily-lineup-loading-heading"
        style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--pw-text-secondary)",
          margin: "0 0 12px",
        }}
      >
        Today&rsquo;s Challenges
      </h2>

      <p role="status" className="sr-only">
        Loading today&rsquo;s puzzles…
      </p>

      <div aria-hidden="true" className="grid gap-2.5 grid-cols-1 min-[430px]:grid-cols-2 min-[981px]:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="flex flex-col min-[360px]:flex-row items-start min-[360px]:items-center gap-3 rounded-lg"
            style={{
              minHeight: 56,
              padding: "12px 14px",
              background: "linear-gradient(160deg, var(--pw-surface-2), var(--pw-surface-1) 70%)",
              border: "1px solid var(--pw-border-default)",
            }}
          >
            {/* First row: icon + content */}
            <span className="flex items-start gap-3 flex-1 min-w-0">
              {/* Icon placeholder */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  flexShrink: 0,
                  background: "color-mix(in srgb, var(--pw-border-default) 60%, transparent)",
                  border: "1px solid var(--pw-border-default)",
                }}
              />

              {/* Content placeholder */}
              <span className="min-w-0 flex-1">
                <span
                  style={{
                    display: "block",
                    height: 12,
                    borderRadius: 4,
                    background: "color-mix(in srgb, var(--pw-border-default) 50%, transparent)",
                    marginBottom: 8,
                    width: "70%",
                  }}
                />
                <span
                  style={{
                    display: "block",
                    height: 10,
                    borderRadius: 4,
                    background: "color-mix(in srgb, var(--pw-border-default) 30%, transparent)",
                    width: "90%",
                  }}
                />
              </span>
            </span>

            {/* Second row (below 360px) / inline (360px+): Status placeholder */}
            <span
              className="flex items-center gap-2.5 shrink-0 pl-11 mt-2 min-[360px]:pl-0 min-[360px]:mt-0"
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 54,
                  height: 10,
                  borderRadius: 4,
                  background: "color-mix(in srgb, var(--pw-border-default) 40%, transparent)",
                }}
              />
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 2,
                  background: "color-mix(in srgb, var(--pw-border-default) 50%, transparent)",
                }}
              />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
