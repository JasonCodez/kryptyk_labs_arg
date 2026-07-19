"use client";

export interface DashboardStatsStripProps {
  puzzlesSolved: number;
  totalPoints: number;
  activeTeams: number;
  rank: number | null;
}

/* ── inline SVG icons — no icon package, decorative only ─────────────── */
function IconPuzzlePiece({ color }: { color: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M9 4h4a1 1 0 011 1v2.2a1.8 1.8 0 002.6 1.6A2.2 2.2 0 0119 11a2.2 2.2 0 01-2.4 2.2A1.8 1.8 0 0014 14.8V17a1 1 0 01-1 1h-2.2a1.8 1.8 0 00-1.6-2.6A2.2 2.2 0 017 17.6 2.2 2.2 0 019.2 15a1.8 1.8 0 002.6-1.6V11a1 1 0 00-1-1H8.8a1.8 1.8 0 00-1.6 2.6A2.2 2.2 0 014.6 11 2.2 2.2 0 017 8.8 1.8 1.8 0 008.6 6.2V5a1 1 0 011-1z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconBolt({ color }: { color: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M13 3L5 13h5l-1 8 8-10h-5l1-8z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
function IconUsers({ color }: { color: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="9" cy="8" r="3" stroke={color} strokeWidth="1.6" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.4" stroke={color} strokeWidth="1.6" />
      <path d="M15.5 14.2c2.9.4 4.9 2.8 4.9 5.8" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function IconTrophy({ color }: { color: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M7 4h10v5a5 5 0 01-10 0V4z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7 6H4a3 3 0 003 3M17 6h3a3 3 0 01-3 3" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 14v3M9 20h6M9.5 20c0-1.7.9-2.5 2.5-3 1.6.5 2.5 1.3 2.5 3" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const HEADING_ID = "dashboard-stats-heading";

/**
 * Compact mobile-first player statistics strip replacing the four large
 * StatCard tiles. Purely presentational — values render immediately with no
 * count-up or entrance animation.
 */
export default function DashboardStatsStrip({
  puzzlesSolved,
  totalPoints,
  activeTeams,
  rank,
}: DashboardStatsStripProps) {
  const items = [
    {
      key: "solved",
      label: "Puzzles Solved",
      value: puzzlesSolved.toLocaleString(),
      icon: IconPuzzlePiece,
      color: "var(--pw-brand-primary)",
    },
    {
      key: "points",
      label: "Total Points",
      value: totalPoints.toLocaleString(),
      icon: IconBolt,
      color: "var(--pw-gold)",
    },
    {
      key: "teams",
      label: "Active Teams",
      value: activeTeams.toLocaleString(),
      icon: IconUsers,
      color: "var(--pw-text-secondary)",
    },
    {
      key: "rank",
      label: "Global Rank",
      value: rank ? `Rank #${rank}` : "Unranked",
      icon: IconTrophy,
      color: "var(--pw-gold)",
    },
  ];

  return (
    <section
      id="tour-stats"
      aria-labelledby={HEADING_ID}
      className="pw-bevel"
      style={{
        marginBottom: 48,
        padding: "16px 14px",
        borderRadius: 16,
        background: "linear-gradient(160deg, var(--pw-surface-hi), var(--pw-surface) 70%)",
        border: "1px solid var(--pw-border-default)",
      }}
    >
      <h2
        id={HEADING_ID}
        style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--pw-brand-primary)",
          margin: "0 0 12px",
        }}
      >
        Your Progress
      </h2>

      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2.5" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li
              key={item.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                minHeight: 76,
                padding: "12px 10px",
                borderRadius: 12,
                background: "color-mix(in srgb, var(--pw-surface-1) 55%, transparent)",
                border: "1px solid var(--pw-border-subtle)",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 30,
                  height: 30,
                  flexShrink: 0,
                  borderRadius: 8,
                  background: `color-mix(in srgb, ${item.color} 16%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${item.color} 35%, transparent)`,
                }}
              >
                <Icon color={item.color} />
              </span>
              <span className="min-w-0">
                <span
                  style={{
                    display: "block",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--pw-text-muted)",
                  }}
                >
                  {item.label}
                </span>
                <span style={{ display: "block", fontSize: 16, fontWeight: 800, color: "var(--pw-text-primary)" }}>
                  {item.value}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
