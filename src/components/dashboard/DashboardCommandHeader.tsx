"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { resolveGameButtonVariant, type GameButtonVariant } from "@/components/game-ui/GameButton";

export interface DashboardCommandHeaderProps {
  displayName: string;
  initials: string;
  avatarUrl?: string | null;
  totalPoints: number;
  rank: number | null;
  isAdmin?: boolean;
}

/** Renders a real Next.js Link styled with GameButton's semantic classes —
 *  GameButton itself is a <button>, and these two actions must be genuine
 *  anchors (no router.push) so they behave like normal navigation. */
function CommandLinkButton({
  href,
  variant,
  children,
}: {
  href: string;
  variant: GameButtonVariant;
  children: ReactNode;
}) {
  const semantic = resolveGameButtonVariant(variant);
  return (
    <Link
      href={href}
      className={[
        "relative inline-flex items-center justify-center gap-2 select-none",
        "font-extrabold uppercase tracking-wide game-text-stroke game-text-pop",
        "border-b-4 transition-shadow duration-100",
        `game-btn--${semantic}`,
        "shadow-skeu-raised-sm active:shadow-skeu-pressed",
        "min-h-11 px-5 text-sm rounded-2xl",
        "w-full sm:w-auto",
        "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2",
      ].join(" ")}
      style={{ textDecoration: "none", outlineColor: "var(--pw-brand-secondary)" }}
    >
      <span className="game-gloss-overlay" aria-hidden />
      <span className="relative">{children}</span>
    </Link>
  );
}

/**
 * Mobile-first command header for the dashboard's "Player Hub" — replaces
 * the old inline welcome-header block. Purely presentational: it reads
 * session-derived props and renders real links, no state of its own.
 */
export default function DashboardCommandHeader({
  displayName,
  initials,
  avatarUrl,
  totalPoints,
  rank,
  isAdmin = false,
}: DashboardCommandHeaderProps) {
  const trimmedName = displayName.trim();
  const firstName = trimmedName ? trimmedName.split(/\s+/)[0] : "Player";
  const formattedPoints = totalPoints.toLocaleString();
  const rankLabel = rank ? `Rank #${rank}` : "Unranked";

  return (
    <header
      className="pw-bevel w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 p-4 sm:px-[22px] sm:py-5 mb-6 sm:mb-12"
      style={{
        borderRadius: 18,
        background: "linear-gradient(170deg, var(--pw-surface-2) 0%, var(--pw-bg-elevated) 100%)",
        border: "1px solid color-mix(in srgb, var(--pw-brand-primary) 30%, var(--pw-border-default))",
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
      }}
    >
      <div className="flex items-start gap-3 sm:gap-4 min-w-0">
        {/* Avatar */}
        <Link
          href="/profile"
          aria-label="Open player profile"
          className="relative flex items-center justify-center shrink-0 w-12 h-12 sm:w-14 sm:h-14"
          style={{
            borderRadius: "50%",
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--pw-brand-primary) 35%, transparent) 0%, color-mix(in srgb, var(--pw-brand-primary) 15%, transparent) 100%)",
            border: "2px solid color-mix(in srgb, var(--pw-brand-primary) 45%, transparent)",
            fontSize: 18,
            fontWeight: 800,
            color: "var(--pw-text-primary)",
            textDecoration: "none",
            overflow: "hidden",
          }}
        >
          {/* Initials fallback — stays in the DOM beneath the background image. */}
          <span className="relative">{initials}</span>
          {avatarUrl && (
            <span
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                backgroundImage: `url(${avatarUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          )}
          {/* Online indicator */}
          <span
            aria-hidden
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "var(--pw-success)",
              border: "2px solid var(--pw-bg-elevated)",
              boxShadow: "0 0 6px color-mix(in srgb, var(--pw-success) 60%, transparent)",
            }}
          />
        </Link>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 4 }}>
            <p
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--pw-brand-accent)",
                margin: 0,
              }}
            >
              <span className="hidden sm:inline">PuzzleWarz // </span>Player Hub
            </p>
            {isAdmin && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  padding: "3px 8px",
                  borderRadius: 999,
                  background: "color-mix(in srgb, var(--pw-gold) 18%, transparent)",
                  color: "var(--pw-gold)",
                  border: "1px solid color-mix(in srgb, var(--pw-gold) 45%, transparent)",
                }}
              >
                Admin
              </span>
            )}
          </div>

          <h1
            className="text-[17px] leading-[1.25] sm:text-[length:clamp(18px,3vw,24px)] sm:leading-normal"
            style={{ fontWeight: 900, color: "var(--pw-brand-primary)", margin: 0 }}
          >
            Ready for another round, {firstName}?
          </h1>

          <p style={{ fontSize: 13, color: "var(--pw-text-secondary)", margin: "4px 0 8px" }}>
            Your next puzzle is waiting.
          </p>

          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--pw-gold)", margin: 0 }}>
            {rankLabel} · {formattedPoints} pts
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
        <CommandLinkButton href="/daily" variant="primary">
          Play Daily
        </CommandLinkButton>
        <CommandLinkButton href="/puzzles" variant="secondary">
          Browse Puzzles
        </CommandLinkButton>
      </div>
    </header>
  );
}
