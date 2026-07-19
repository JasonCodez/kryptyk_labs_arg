"use client";

import type { ReactNode } from "react";
import Link from "next/link";

interface AdminItem {
  href: string;
  title: string;
  desc: string;
  icon: (props: { color: string }) => ReactNode;
}

interface AdminGroup {
  heading: string;
  accentColor: string;
  items: AdminItem[];
}

/* ── inline SVG icons — no icon package, decorative only ─────────────── */
function IconChart({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M4 20V4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 20h16" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 16v-5M12 16V7M16 16v-3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconPuzzlePlus({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <rect x="3.5" y="3.5" width="13" height="13" rx="2" stroke={color} strokeWidth="1.8" />
      <path d="M10 7v6M7 10h6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M20.5 9v9.5a2 2 0 01-2 2H9" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
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
function IconFlag({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M5 21V4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 4h13l-2.5 4L18 12H5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconBug({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <ellipse cx="12" cy="14" rx="5" ry="6" stroke={color} strokeWidth="1.8" />
      <path d="M9 6.5a3 3 0 016 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 8.5V20M4 14h3M17 14h3M5.5 8.5L8 10.5M18.5 8.5L16 10.5M5.5 19.5L8 17.5M18.5 19.5L16 17.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
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

const GROUPS: AdminGroup[] = [
  {
    heading: "Manage",
    accentColor: "var(--pw-brand-primary)",
    items: [
      {
        href: "/admin/analytics",
        title: "Analytics",
        desc: "View platform statistics and puzzle analytics.",
        icon: IconChart,
      },
      {
        href: "/admin/puzzles",
        title: "Create Puzzle",
        desc: "Add and manage puzzles on the platform.",
        icon: IconPuzzlePlus,
      },
      {
        href: "/admin/frequency",
        title: "Frequency Admin",
        desc: "Schedule questions, reveal results, and merge answers.",
        icon: IconBroadcast,
      },
    ],
  },
  {
    heading: "Moderate",
    accentColor: "var(--pw-brand-accent)",
    items: [
      {
        href: "/admin/reports",
        title: "Abuse Reports",
        desc: "Review player-submitted abuse reports.",
        icon: IconFlag,
      },
      {
        href: "/admin/bug-reports",
        title: "Bug Reports",
        desc: "Review bug reports submitted from puzzles.",
        icon: IconBug,
      },
    ],
  },
];

function AdminRow({ item, accentColor }: { item: AdminItem; accentColor: string }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="flex items-center gap-3 rounded-xl transition-colors hover:brightness-110 active:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        minHeight: 48,
        padding: "10px 12px",
        textDecoration: "none",
        border: "1px solid transparent",
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
        <span style={{ display: "block", fontWeight: 700, fontSize: 14, color: "var(--pw-text-primary)" }}>
          {item.title}
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

function AdminSection({ group }: { group: AdminGroup }) {
  const headingId = `dashboard-admin-${group.heading.toLowerCase()}`;
  return (
    <section
      aria-labelledby={headingId}
      className="pw-bevel"
      style={{
        padding: "16px 14px",
        borderRadius: 16,
        background: "linear-gradient(160deg, var(--pw-surface-hi), var(--pw-surface) 70%)",
        border: "1px solid var(--pw-border-default)",
      }}
    >
      <h3
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
      </h3>
      <div className="flex flex-col gap-1">
        {group.items.map((item) => (
          <AdminRow key={item.href} item={item} accentColor={group.accentColor} />
        ))}
      </div>
    </section>
  );
}

/**
 * Compact grouped Admin Tools hub replacing the old admin card wall. Prop-free
 * and purely presentational — visibility is decided by the dashboard page.
 */
export default function DashboardAdminHub() {
  return (
    <section aria-labelledby="dashboard-admin-tools">
      <h2
        id="dashboard-admin-tools"
        style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--pw-text-secondary)",
          margin: "0 0 14px",
        }}
      >
        Admin Tools
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {GROUPS.map((group) => (
          <AdminSection key={group.heading} group={group} />
        ))}
      </div>
    </section>
  );
}
