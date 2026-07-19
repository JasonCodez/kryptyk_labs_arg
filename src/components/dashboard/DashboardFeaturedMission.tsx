"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export interface DebriefTeaser {
  caseNumber: number;
  classification: string;
  totalPlays: number;
  completed: boolean;
}

type FetchStatus = "loading" | "loaded" | "error";

/** Decorative incident-report emblem — replaces the magnifying-glass emoji. */
function IconReport({ color }: { color: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M7 3h7l4 4v14a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 3v4h4" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9 12h6M9 15h6M9 9h2" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Compact mobile-first Featured Mission card for The Debrief — replaces the
 * old oversized FeaturedBanner. Keeps the same /api/debrief/today data
 * interpretation and destination; presentational only, no local hover state.
 */
export default function DashboardFeaturedMission() {
  const [status, setStatus] = useState<FetchStatus>("loading");
  const [teaser, setTeaser] = useState<DebriefTeaser | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/debrief/today")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setStatus("error");
          return;
        }
        setTeaser({
          caseNumber: data.caseNumber ?? data.scenario?.caseNumber ?? 0,
          classification: data.classification ?? data.scenario?.classification ?? "CLASSIFIED",
          totalPlays: data.stats?.totalPlays ?? 0,
          completed: Boolean(data.completed),
        });
        setStatus("loaded");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A confirmed-complete mission has nothing left to feature.
  if (status === "loaded" && teaser?.completed) return null;

  const showLive = status === "loaded" && !!teaser;
  const showParticipation = showLive && (teaser as DebriefTeaser).totalPlays > 0;

  return (
    <Link
      href="/debrief"
      className="pw-bevel pw-press block hover:border-[var(--pw-brand-primary)] focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        textDecoration: "none",
        borderRadius: 16,
        padding: "18px 20px",
        marginBottom: 40,
        minHeight: 48,
        background: "linear-gradient(150deg, var(--pw-surface-2) 0%, var(--pw-bg-elevated) 100%)",
        border: "1px solid color-mix(in srgb, var(--pw-brand-primary) 28%, var(--pw-border-default))",
        outlineColor: "var(--pw-brand-secondary)",
      }}
    >
      <article className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <span
            aria-hidden="true"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: 12,
              flexShrink: 0,
              background: "color-mix(in srgb, var(--pw-brand-primary) 14%, transparent)",
              border: "1px solid color-mix(in srgb, var(--pw-brand-primary) 35%, transparent)",
            }}
          >
            <IconReport color="var(--pw-brand-primary)" />
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--pw-brand-accent)",
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "color-mix(in srgb, var(--pw-brand-accent) 14%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--pw-brand-accent) 32%, transparent)",
                }}
              >
                Featured Mission
              </span>
              {showLive && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--pw-brand-accent)",
                  }}
                >
                  Live Today
                </span>
              )}
            </div>

            <h2 style={{ fontSize: 18, fontWeight: 900, color: "var(--pw-brand-primary)", margin: "0 0 4px" }}>
              The Debrief
            </h2>

            {showLive && (
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  color: "var(--pw-brand-accent)",
                  margin: "0 0 6px",
                }}
              >
                CASE #{String((teaser as DebriefTeaser).caseNumber).padStart(4, "0")} •{" "}
                {(teaser as DebriefTeaser).classification.toUpperCase()}
              </p>
            )}

            <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--pw-text-secondary)", margin: 0, maxWidth: 440 }}>
              Memorize the incident report before it disappears, then answer five recall questions.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:items-end sm:shrink-0">
          {showParticipation && (
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--pw-gold)", whiteSpace: "nowrap" }}>
              {(teaser as DebriefTeaser).totalPlays.toLocaleString()} investigators
            </span>
          )}
          <span
            className="w-full sm:w-auto"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              minHeight: 44,
              padding: "10px 18px",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 13,
              color: "var(--pw-brand-primary)",
              background: "color-mix(in srgb, var(--pw-brand-primary) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--pw-brand-primary) 35%, transparent)",
              whiteSpace: "nowrap",
            }}
          >
            Enter the Case
          </span>
        </div>
      </article>
    </Link>
  );
}
