"use client";

import type { ReactNode } from "react";
import Link from "next/link";

interface NavItem {
  href: string;
  title: string;
  desc: string;
  icon: (props: { color: string }) => ReactNode;
  tourId?: string;
  chip?: string;
  featured?: boolean;
}

interface NavGroup {
  heading: string;
  accentColor: string;
  items: NavItem[];
}

/* ── inline SVG icons — no icon package, decorative only ─────────────── */
function IconCalendar({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke={color} strokeWidth="1.8" />
      <path d="M3 9.5h18M8 3v4M16 3v4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconGrid({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" stroke={color} strokeWidth="1.8" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" stroke={color} strokeWidth="1.8" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" stroke={color} strokeWidth="1.8" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" stroke={color} strokeWidth="1.8" />
    </svg>
  );
}
function IconLayers({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M12 3l9 5-9 5-9-5 9-5z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M3 13l9 5 9-5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconSword({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M4 20L15 9M15 9l5-5-3.5-.5L15 5l-1.5 1.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 11l3 3M4 20l1.5-3.5L8 15" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconTrophy({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M7 4h10v5a5 5 0 01-10 0V4z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M7 6H4a3 3 0 003 3M17 6h3a3 3 0 01-3 3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 14v3M9 20h6M9.5 20c0-1.7.9-2.5 2.5-3 1.6.5 2.5 1.3 2.5 3" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconUsers({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="9" cy="8" r="3" stroke={color} strokeWidth="1.8" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.4" stroke={color} strokeWidth="1.8" />
      <path d="M15.5 14.2c2.9.4 4.9 2.8 4.9 5.8" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconBroadcast({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="2.2" stroke={color} strokeWidth="1.8" />
      <path d="M7.8 7.8a6 6 0 000 8.4M16.2 7.8a6 6 0 010 8.4M4.6 4.6a10.5 10.5 0 000 14.8M19.4 4.6a10.5 10.5 0 010 14.8" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function IconMedal({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="12" cy="14" r="6" stroke={color} strokeWidth="1.8" />
      <path d="M9 3h6l-2.2 6.5h-1.6L9 3z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 11v6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconUser({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="12" cy="8" r="3.6" stroke={color} strokeWidth="1.8" />
      <path d="M4.5 20c0-4.1 3.4-7.5 7.5-7.5s7.5 3.4 7.5 7.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconActivity({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M3 12h4l2-7 4 14 2-7h6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconQuestion({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
      <path d="M9.5 9.3a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="17" r="0.9" fill={color} />
    </svg>
  );
}
function IconChevron({ color }: { color: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M9 5l7 7-7 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const GROUPS: NavGroup[] = [
  {
    heading: "Play",
    accentColor: "var(--pw-brand-primary)",
    items: [
      {
        href: "/daily",
        title: "Daily Challenge",
        desc: "Build your streak with today’s featured puzzles.",
        icon: IconCalendar,
        tourId: "tour-card-daily",
        chip: "Today",
        featured: true,
      },
      {
        href: "/puzzles",
        title: "Puzzle Library",
        desc: "Choose a puzzle and start solving.",
        icon: IconGrid,
        tourId: "tour-card-puzzles",
      },
      {
        href: "/categories",
        title: "Browse Categories",
        desc: "Explore puzzles by type and difficulty.",
        icon: IconLayers,
      },
    ],
  },
  {
    heading: "Compete",
    accentColor: "var(--pw-brand-accent)",
    items: [
      {
        href: "/warz",
        title: "Warz",
        desc: "Challenge another player in a head-to-head puzzle battle.",
        icon: IconSword,
        tourId: "tour-card-warz",
        chip: "Live",
      },
      {
        href: "/leaderboards",
        title: "Leaderboards",
        desc: "Compare your score and rank.",
        icon: IconTrophy,
        tourId: "tour-card-leaderboards",
      },
      {
        href: "/teams",
        title: "My Teams",
        desc: "Collaborate and compete with your groups.",
        icon: IconUsers,
        tourId: "tour-card-teams",
      },
      {
        href: "/frequency",
        title: "Frequency",
        desc: "Predict how the crowd will answer.",
        icon: IconBroadcast,
        tourId: "tour-card-frequency",
        chip: "New",
      },
    ],
  },
  {
    heading: "Progress",
    accentColor: "var(--pw-gold)",
    items: [
      {
        href: "/achievements",
        title: "Achievements",
        desc: "Track badges, milestones, and completed goals.",
        icon: IconMedal,
        tourId: "tour-card-achievements",
      },
      {
        href: "/profile",
        title: "My Profile",
        desc: "View your stats and customize your identity.",
        icon: IconUser,
        tourId: "tour-card-profile",
      },
      {
        href: "/dashboard/activity",
        title: "Activity Feed",
        desc: "Review your recent PuzzleWarz activity.",
        icon: IconActivity,
      },
    ],
  },
  {
    heading: "More",
    accentColor: "var(--pw-text-muted)",
    items: [
      {
        href: "/faq",
        title: "FAQ",
        desc: "Learn how puzzles, scoring, teams, and competition work.",
        icon: IconQuestion,
      },
    ],
  },
];

function NavRow({ item, accentColor }: { item: NavItem; accentColor: string }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      id={item.tourId}
      className="flex items-center gap-3 rounded-xl transition-colors hover:brightness-110 active:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        minHeight: 48,
        padding: item.featured ? "12px 12px" : "10px 12px",
        textDecoration: "none",
        background: item.featured ? "color-mix(in srgb, var(--pw-brand-primary) 10%, transparent)" : "transparent",
        border: item.featured
          ? "1px solid color-mix(in srgb, var(--pw-brand-primary) 35%, transparent)"
          : "1px solid transparent",
        outlineColor: "var(--pw-brand-secondary)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 34,
          height: 34,
          borderRadius: 10,
          flexShrink: 0,
          background: `color-mix(in srgb, ${accentColor} 16%, transparent)`,
          border: `1px solid color-mix(in srgb, ${accentColor} 35%, transparent)`,
        }}
      >
        <Icon color={accentColor} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span style={{ fontWeight: 700, fontSize: 14, color: "var(--pw-text-primary)" }}>{item.title}</span>
          {item.featured && <span className="sr-only"> (Featured)</span>}
          {item.chip && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "2px 7px",
                borderRadius: 999,
                color: accentColor,
                background: `color-mix(in srgb, ${accentColor} 16%, transparent)`,
                border: `1px solid color-mix(in srgb, ${accentColor} 40%, transparent)`,
              }}
            >
              {item.chip}
            </span>
          )}
        </span>
        <span style={{ display: "block", fontSize: 12, color: "var(--pw-text-muted)", marginTop: 2, lineHeight: 1.4 }}>
          {item.desc}
        </span>
      </span>

      <span aria-hidden="true" style={{ flexShrink: 0, display: "flex" }}>
        <IconChevron color="var(--pw-text-muted)" />
      </span>
    </Link>
  );
}

function NavSection({ group }: { group: NavGroup }) {
  const headingId = `dashboard-nav-${group.heading.toLowerCase()}`;
  return (
    <section aria-labelledby={headingId} className="pw-bevel" style={{
      padding: "16px 14px",
      borderRadius: 16,
      background: "linear-gradient(160deg, var(--pw-surface-hi), var(--pw-surface) 70%)",
      border: "1px solid var(--pw-border-default)",
    }}>
      <h2
        id={headingId}
        style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: group.accentColor,
          margin: "0 0 10px",
        }}
      >
        {group.heading}
      </h2>
      <div className="flex flex-col gap-1">
        {group.items.map((item) => (
          <NavRow key={item.href} item={item} accentColor={group.accentColor} />
        ))}
      </div>
    </section>
  );
}

interface DashboardNavigationHubProps {
  /**
   * "full" (default) is byte-for-byte the original behavior: all four
   * groups, two-column responsive grid. "starter" is used by New-Player
   * Focus Mode — it selects the existing "Play" group only, from the same
   * GROUPS data (no alternate copies of any destination), in a single
   * column at every viewport.
   */
  mode?: "full" | "starter";
}

/**
 * Mobile-first grouped navigation hub replacing the old eleven equal-sized
 * "Navigate" cards. Purely presentational — every destination, copy string,
 * and tour ID is fixed data owned by this component.
 */
export default function DashboardNavigationHub({ mode = "full" }: DashboardNavigationHubProps) {
  const groups = mode === "starter" ? GROUPS.filter((group) => group.heading === "Play") : GROUPS;

  return (
    <nav
      aria-label={mode === "starter" ? "Starter dashboard navigation" : "Dashboard navigation"}
      data-testid={mode === "starter" ? "dashboard-navigation-starter" : "dashboard-navigation-full"}
      className={mode === "starter" ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 md:grid-cols-2 gap-4"}
    >
      {groups.map((group) => (
        <NavSection key={group.heading} group={group} />
      ))}
    </nav>
  );
}
