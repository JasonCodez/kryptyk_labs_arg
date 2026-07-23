"use client";

import { Skeleton } from "@/components/Skeleton";

/**
 * Loading skeleton for the Daily Puzzle Lineup. Mirrors the final structure:
 * progress overview, recommended challenge region, and a six-card grid.
 */
export default function DailyLineupLoadingState() {
  return (
    <div className="w-full">
      <p role="status" className="sr-only">
        Loading today&rsquo;s puzzles…
      </p>

      <div
        aria-hidden="true"
        className="max-w-5xl mx-auto mb-8 rounded-[20px] p-6"
        style={{ background: "var(--pw-surface-2)", border: "1px solid var(--pw-border-subtle)" }}
      >
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton
                  key={i}
                  className="rounded-xl"
                  style={{ height: 68 }}
                />
              ))}
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
          <div>
            <Skeleton
              style={{
                height: 12,
                width: "40%",
                marginBottom: 10,
                borderRadius: 4,
              }}
            />
            <Skeleton
              style={{
                height: 18,
                width: "70%",
                marginBottom: 14,
                borderRadius: 4,
              }}
            />
            <Skeleton
              style={{
                height: 44,
                width: 140,
                borderRadius: 16,
              }}
            />
          </div>
        </div>
      </div>

      <h2 className="mx-auto mb-4 max-w-5xl text-xl font-extrabold" style={{ color: "var(--pw-text-primary)" }}>
        Today&rsquo;s Challenges
      </h2>

      <div
        data-testid="daily-lineup-loading-grid"
        aria-hidden="true"
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto"
      >
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="rounded-[20px] p-6"
            style={{ background: "var(--pw-surface-2)", border: "1px solid var(--pw-border-subtle)", minHeight: 160 }}
          >
            <div className="flex items-start gap-3">
              <Skeleton
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  flexShrink: 0,
                }}
              />
              <div className="min-w-0 flex-1">
                <Skeleton
                  style={{
                    height: 12,
                    borderRadius: 4,
                    marginBottom: 8,
                    width: "70%",
                  }}
                />
                <Skeleton
                  style={{
                    height: 10,
                    borderRadius: 4,
                    width: "90%",
                  }}
                />
              </div>
            </div>
            <Skeleton className="mt-5 h-2 w-full rounded-full" />
            <Skeleton className="mt-4 h-9 w-28 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
